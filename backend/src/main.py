import time

import structlog
import uvicorn
from fastapi import FastAPI

from src.config import Settings
from src.domain.models import StitchMode
from src.infra.cache.in_memory_result_cache import InMemoryResultCache
from src.infra.logging_config import LogSettings, configure_logging
from src.infra.opencv.cv_codec import CvImageCodec
from src.infra.opencv.cv_stitcher import CvImageStitcher
from src.infra.opencv.sample_images import make_overlapping_tiles
from src.presentation.app import create_app
from src.usecase.get_stitch_result import GetStitchResultUseCase
from src.usecase.stitch_images import StitchImagesUseCase

logger = structlog.stdlib.get_logger(__name__)


def _warmup(usecase: StitchImagesUseCase) -> None:
    """初回スティッチの内部初期化コスト (実測で約 6 倍の遅延) を起動時に払う。"""
    started = time.perf_counter()
    output = usecase.execute(make_overlapping_tiles(), StitchMode.SCANS.value)
    duration_ms = round((time.perf_counter() - started) * 1000)
    if output.is_success:
        logger.info("warmup.completed", duration_ms=duration_ms)
    else:
        failure = output.failure.value if output.failure is not None else None
        logger.warning("warmup.failed", failure=failure, duration_ms=duration_ms)


def create_application() -> FastAPI:
    settings = Settings.from_env()
    codec = CvImageCodec()
    cache = InMemoryResultCache(
        ttl_seconds=settings.cache_ttl_seconds,
        max_entries=settings.cache_max_entries,
        clock=time.monotonic,
    )
    stitch_usecase = StitchImagesUseCase(
        codec=codec,
        stitcher=CvImageStitcher(),
        cache=cache,
        preview_max_width=settings.preview_max_width,
        preview_quality=settings.preview_quality,
        max_total_pixels=settings.max_total_pixels,
    )
    get_result_usecase = GetStitchResultUseCase(
        codec=codec, cache=cache, jpeg_quality=settings.download_jpeg_quality
    )
    return create_app(
        stitch_usecase=stitch_usecase,
        get_result_usecase=get_result_usecase,
        settings=settings,
        warmup=lambda: _warmup(stitch_usecase),
    )


configure_logging(LogSettings.from_env())
app = create_application()

if __name__ == "__main__":
    # log_config=None: uvicorn 独自のログ設定で configure_logging() を上書きさせない
    uvicorn.run(app, host="0.0.0.0", port=Settings.from_env().port, log_config=None)
