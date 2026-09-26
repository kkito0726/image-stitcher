from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from src.domain.models import StitchFailureReason, StitchMode
from src.domain.ports import ImageCodec, ImageStitcher, StitchResultCache


@dataclass(frozen=True)
class StitchImagesOutput:
    preview_jpeg: bytes | None
    result_id: str | None
    failure: StitchFailureReason | None

    @property
    def is_success(self) -> bool:
        return self.preview_jpeg is not None


class StitchImagesUseCase:
    def __init__(
        self,
        codec: ImageCodec,
        stitcher: ImageStitcher,
        cache: StitchResultCache,
        preview_max_width: int,
        preview_quality: int,
    ) -> None:
        self._codec = codec
        self._stitcher = stitcher
        self._cache = cache
        self._preview_max_width = preview_max_width
        self._preview_quality = preview_quality

    def execute(self, image_files: Sequence[bytes], mode_label: str) -> StitchImagesOutput:
        """画像バイト列群を合成し、プレビュー JPEG と結果 ID を返す。

        フル解像度はキャッシュに保持し、ダウンロード要求時にのみエンコードする。

        Raises:
            ImageDecodeError: いずれかの画像がデコードできない場合。
        """
        decoded = [self._codec.decode(data) for data in image_files]
        result = self._stitcher.stitch(decoded, StitchMode.from_label(mode_label))
        if result.image is None:
            return StitchImagesOutput(preview_jpeg=None, result_id=None, failure=result.failure)

        result_id = self._cache.put(result.image)
        preview = self._codec.encode_preview_jpeg(
            result.image, self._preview_max_width, self._preview_quality
        )
        return StitchImagesOutput(preview_jpeg=preview, result_id=result_id, failure=None)
