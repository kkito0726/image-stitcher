from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from src.domain.errors import ImageTooLargeError
from src.domain.models import DecodedImage, StitchFailureReason, StitchMode
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
        max_total_pixels: int,
    ) -> None:
        self._codec = codec
        self._stitcher = stitcher
        self._cache = cache
        self._preview_max_width = preview_max_width
        self._preview_quality = preview_quality
        self._max_total_pixels = max_total_pixels

    def execute(self, image_files: Sequence[bytes], mode_label: str) -> StitchImagesOutput:
        """画像バイト列群を合成し、プレビュー JPEG と結果 ID を返す。

        フル解像度はキャッシュに保持し、ダウンロード要求時にのみエンコードする。

        Raises:
            ImageDecodeError: いずれかの画像がデコードできない場合。
            ImageTooLargeError: デコード後の合計画素数が上限を超える場合。
        """
        decoded = self._decode_within_budget(image_files)
        result = self._stitcher.stitch(decoded, StitchMode.from_label(mode_label))
        if result.image is None:
            return StitchImagesOutput(preview_jpeg=None, result_id=None, failure=result.failure)

        result_id = self._cache.put(result.image)
        preview = self._codec.encode_preview_jpeg(
            result.image, self._preview_max_width, self._preview_quality
        )
        return StitchImagesOutput(preview_jpeg=preview, result_id=result_id, failure=None)

    def _decode_within_budget(self, image_files: Sequence[bytes]) -> list[DecodedImage]:
        """デコード後の合計画素数が上限を超えた時点で打ち切る。

        圧縮後バイト数の上限だけでは、高圧縮な画像の展開によるメモリ枯渇を防げない。
        """
        decoded: list[DecodedImage] = []
        total_pixels = 0
        for data in image_files:
            image = self._codec.decode(data)
            total_pixels += image.width * image.height
            if total_pixels > self._max_total_pixels:
                raise ImageTooLargeError(
                    f"画像の合計画素数は {self._max_total_pixels:,} 画素までです"
                )
            decoded.append(image)
        return decoded
