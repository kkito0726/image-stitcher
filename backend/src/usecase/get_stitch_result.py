from __future__ import annotations

from src.domain.models import DownloadFormat
from src.domain.ports import ImageCodec, StitchResultCache


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
        if fmt is DownloadFormat.PNG:
            return self._codec.encode_png(image)
        return self._codec.encode_jpeg(image, self._jpeg_quality)
