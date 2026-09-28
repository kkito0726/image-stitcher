from __future__ import annotations

import time

import structlog

from src.domain.models import DownloadFormat
from src.domain.ports import ImageCodec, StitchResultCache

logger = structlog.stdlib.get_logger(__name__)


class GetStitchResultUseCase:
    """キャッシュされた合成結果をフル解像度で、指定形式にエンコードして取り出す。"""

    def __init__(self, codec: ImageCodec, cache: StitchResultCache, jpeg_quality: int) -> None:
        self._codec = codec
        self._cache = cache
        self._jpeg_quality = jpeg_quality

    def execute(self, result_id: str, fmt: DownloadFormat = DownloadFormat.JPEG) -> bytes | None:
        """result_id に対応するフル解像度画像を返す。存在しなければ None。"""
        image = self._cache.get(result_id)
        if image is None:
            return None
        started = time.perf_counter()
        if fmt is DownloadFormat.PNG:
            encoded = self._codec.encode_png(image)
        else:
            encoded = self._codec.encode_jpeg(image, self._jpeg_quality)
        logger.info(
            "download.completed",
            format=fmt.value,
            bytes=len(encoded),
            encode_ms=round((time.perf_counter() - started) * 1000),
        )
        return encoded
