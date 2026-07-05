from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from src.domain.models import StitchFailureReason, StitchMode
from src.domain.ports import ImageCodec, ImageStitcher


@dataclass(frozen=True)
class StitchImagesOutput:
    png: bytes | None
    failure: StitchFailureReason | None

    @property
    def is_success(self) -> bool:
        return self.png is not None


class StitchImagesUseCase:
    def __init__(self, codec: ImageCodec, stitcher: ImageStitcher) -> None:
        self._codec = codec
        self._stitcher = stitcher

    def execute(self, image_files: Sequence[bytes], mode_label: str) -> StitchImagesOutput:
        """画像バイト列群を合成し、PNG バイト列を返す。

        Raises:
            ImageDecodeError: いずれかの画像がデコードできない場合。
        """
        decoded = [self._codec.decode(data) for data in image_files]
        result = self._stitcher.stitch(decoded, StitchMode.from_label(mode_label))
        if result.image is None:
            return StitchImagesOutput(png=None, failure=result.failure)
        return StitchImagesOutput(png=self._codec.encode_png(result.image), failure=None)
