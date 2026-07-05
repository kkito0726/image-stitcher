import numpy as np

from src.domain.models import StitchFailureReason, StitchMode
from src.infra.opencv.cv_codec import CvImageCodec
from src.infra.opencv.cv_stitcher import CvImageStitcher
from src.infra.opencv.sample_images import make_overlapping_tiles


class TestCvImageStitcher:
    def test_重なりのあるタイルはscansモードで合成できる(self) -> None:
        codec = CvImageCodec()
        tiles = [codec.decode(data) for data in make_overlapping_tiles()]
        stitcher = CvImageStitcher()

        result = stitcher.stitch(tiles, StitchMode.SCANS)

        assert result.is_success
        assert result.image is not None
        # 合成結果は 1 タイルより横に広い
        assert result.image.width > tiles[0].width

    def test_特徴点のない画像は失敗理由付きで失敗する(self) -> None:
        codec = CvImageCodec()
        flat = np.full((120, 160, 3), 128, dtype=np.uint8)
        images = [codec.decode(_encode_png(flat)), codec.decode(_encode_png(flat))]
        stitcher = CvImageStitcher()

        result = stitcher.stitch(images, StitchMode.SCANS)

        assert not result.is_success
        assert result.failure is StitchFailureReason.NEED_MORE_IMAGES

    def test_サイズの異なる画像でも例外にならない(self) -> None:
        # 旧実装の np.array(read_img) はサイズ違いで壊れた。list のまま渡せば動く
        codec = CvImageCodec()
        rng = np.random.default_rng(1)
        small = rng.integers(0, 255, (100, 140, 3), dtype=np.uint8)
        large = rng.integers(0, 255, (160, 200, 3), dtype=np.uint8)
        images = [codec.decode(_encode_png(small)), codec.decode(_encode_png(large))]
        stitcher = CvImageStitcher()

        # ランダムノイズ同士なので合成は失敗してよい。例外にならないことが重要
        result = stitcher.stitch(images, StitchMode.SCANS)
        assert result.failure is not None or result.is_success


def _encode_png(mat: np.ndarray) -> bytes:
    import cv2

    ok, buffer = cv2.imencode(".png", mat)
    assert ok
    return bytes(buffer.tobytes())
