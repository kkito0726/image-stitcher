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

    def encode_png(self, image: DecodedImage) -> bytes: ...


class ImageStitcher(Protocol):
    def stitch(self, images: Sequence[DecodedImage], mode: StitchMode) -> StitchResult: ...
