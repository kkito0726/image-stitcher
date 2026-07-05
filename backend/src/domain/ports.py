from collections.abc import Sequence
from typing import Protocol

from src.domain.models import DecodedImage, StitchMode, StitchResult


class ImageCodec(Protocol):
    def decode(self, data: bytes) -> DecodedImage:
        """画像バイト列をデコードする。

        Raises:
            ImageDecodeError: 画像として解釈できない場合。
        """
        ...

    def encode_png(self, image: DecodedImage) -> bytes:
        """フル解像度のロスレス PNG にエンコードする。"""
        ...

    def encode_preview_jpeg(self, image: DecodedImage, max_width: int, quality: int) -> bytes:
        """表示用に縮小した非可逆 JPEG にエンコードする。

        画像が max_width より広い場合のみ縮小する(拡大はしない)。
        """
        ...


class ImageStitcher(Protocol):
    def stitch(self, images: Sequence[DecodedImage], mode: StitchMode) -> StitchResult: ...


class StitchResultCache(Protocol):
    """合成結果(フル解像度画像)を一時保持し、後からダウンロード可能にする。"""

    def put(self, image: DecodedImage) -> str:
        """画像を格納し、取り出し用の ID を返す。"""
        ...

    def get(self, result_id: str) -> DecodedImage | None:
        """ID に対応する画像を返す。存在しない/期限切れの場合は None。"""
        ...
