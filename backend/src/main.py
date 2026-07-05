import logging

import uvicorn
from fastapi import FastAPI

from src.config import Settings
from src.domain.models import StitchMode
from src.infra.opencv.cv_codec import CvImageCodec
from src.infra.opencv.cv_stitcher import CvImageStitcher
from src.infra.opencv.sample_images import make_overlapping_tiles
from src.presentation.app import create_app
from src.usecase.stitch_images import StitchImagesUseCase

logger = logging.getLogger(__name__)


def _warmup(usecase: StitchImagesUseCase) -> None:
    """初回スティッチの内部初期化コスト (実測で約 6 倍の遅延) を起動時に払う。"""
    output = usecase.execute(make_overlapping_tiles(), StitchMode.SCANS.value)
    if output.is_success:
        logger.info("ウォームアップ完了")
    else:
        logger.warning("ウォームアップのスティッチが失敗しました: %s", output.failure)


def create_application() -> FastAPI:
    settings = Settings.from_env()
    usecase = StitchImagesUseCase(codec=CvImageCodec(), stitcher=CvImageStitcher())
    return create_app(usecase=usecase, settings=settings, warmup=lambda: _warmup(usecase))


app = create_application()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    uvicorn.run(app, host="0.0.0.0", port=Settings.from_env().port)
