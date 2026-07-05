import cv2
import numpy as np
import pytest

from src.domain.errors import ImageDecodeError
from src.infra.opencv.cv_codec import CvImageCodec
from src.infra.opencv.cv_image import CvImage


def _sample_mat(width: int = 32, height: int = 24) -> np.ndarray:
    rng = np.random.default_rng(0)
    return rng.integers(0, 255, (height, width, 3), dtype=np.uint8)


class TestCvImageCodec:
    def test_pngエンコードとデコードのラウンドトリップ(self) -> None:
        codec = CvImageCodec()
        original = CvImage(mat=_sample_mat())

        png = codec.encode_png(original)
        decoded = codec.decode(png)

        assert decoded.width == original.width
        assert decoded.height == original.height
        # PNG はロスレスなのでピクセル一致する
        assert isinstance(decoded, CvImage)
        assert np.array_equal(decoded.mat, original.mat)

    def test_jpegもデコードできる(self) -> None:
        codec = CvImageCodec()
        ok, buffer = cv2.imencode(".jpg", _sample_mat())
        assert ok

        decoded = codec.decode(buffer.tobytes())

        assert decoded.width == 32
        assert decoded.height == 24

    def test_壊れたバイト列はImageDecodeError(self) -> None:
        codec = CvImageCodec()
        with pytest.raises(ImageDecodeError):
            codec.decode(b"this is not an image")

    def test_空のバイト列はImageDecodeError(self) -> None:
        codec = CvImageCodec()
        with pytest.raises(ImageDecodeError):
            codec.decode(b"")

    def test_プレビューは幅を上限まで縮小する(self) -> None:
        codec = CvImageCodec()
        wide = CvImage(mat=_sample_mat(width=4000, height=2000))

        jpeg = codec.encode_preview_jpeg(wide, max_width=1920, quality=80)
        decoded = codec.decode(jpeg)

        assert decoded.width == 1920
        assert decoded.height == 960  # アスペクト比を保つ

    def test_プレビューは上限より小さい画像を拡大しない(self) -> None:
        codec = CvImageCodec()
        small = CvImage(mat=_sample_mat(width=800, height=600))

        jpeg = codec.encode_preview_jpeg(small, max_width=1920, quality=80)
        decoded = codec.decode(jpeg)

        assert decoded.width == 800
        assert decoded.height == 600

    def test_プレビューjpegはフルpngより小さい(self) -> None:
        codec = CvImageCodec()
        image = CvImage(mat=_sample_mat(width=4000, height=2000))

        preview = codec.encode_preview_jpeg(image, max_width=1920, quality=80)
        full = codec.encode_png(image)

        assert len(preview) < len(full)
