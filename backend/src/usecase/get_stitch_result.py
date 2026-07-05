from __future__ import annotations

from src.domain.ports import ImageCodec, StitchResultCache


class GetStitchResultUseCase:
    """キャッシュされた合成結果をフル解像度 PNG として取り出す。"""

    def __init__(self, codec: ImageCodec, cache: StitchResultCache) -> None:
        self._codec = codec
        self._cache = cache

    def execute(self, result_id: str) -> bytes | None:
        """result_id に対応するフル解像度 PNG を返す。存在しなければ None。"""
        image = self._cache.get(result_id)
        if image is None:
            return None
        return self._codec.encode_png(image)
