from collections.abc import Sequence

import pytest

from src.domain.errors import ImageDecodeError
from src.domain.models import DecodedImage, StitchFailureReason, StitchMode, StitchResult
from src.usecase.stitch_images import StitchImagesUseCase


class FakeImage:
    def __init__(self, name: str) -> None:
        self.name = name

    @property
    def width(self) -> int:
        return 1

    @property
    def height(self) -> int:
        return 1


class FakeCodec:
    def decode(self, data: bytes) -> DecodedImage:
        if data == b"broken":
            raise ImageDecodeError("decode failed")
        return FakeImage(data.decode())

    def encode_png(self, image: DecodedImage) -> bytes:
        return b"png:" + getattr(image, "name", "?").encode()


class FakeStitcher:
    def __init__(self, result: StitchResult) -> None:
        self._result = result
        self.received_images: Sequence[DecodedImage] | None = None
        self.received_mode: StitchMode | None = None

    def stitch(self, images: Sequence[DecodedImage], mode: StitchMode) -> StitchResult:
        self.received_images = images
        self.received_mode = mode
        return self._result


class TestStitchImagesUseCase:
    def test_成功時はpngバイト列を返す(self) -> None:
        stitched = FakeImage("stitched")
        stitcher = FakeStitcher(StitchResult.succeeded(stitched))
        usecase = StitchImagesUseCase(codec=FakeCodec(), stitcher=stitcher)

        output = usecase.execute([b"img1", b"img2"], "Scans")

        assert output.is_success
        assert output.png == b"png:stitched"
        assert output.failure is None

    def test_全画像をデコードしてスティッチャーに渡す(self) -> None:
        stitcher = FakeStitcher(StitchResult.succeeded(FakeImage("s")))
        usecase = StitchImagesUseCase(codec=FakeCodec(), stitcher=stitcher)

        usecase.execute([b"img1", b"img2", b"img3"], "Scans")

        assert stitcher.received_images is not None
        assert [getattr(i, "name", "?") for i in stitcher.received_images] == [
            "img1",
            "img2",
            "img3",
        ]
        assert stitcher.received_mode is StitchMode.SCANS

    def test_モードラベルが変換されて渡される(self) -> None:
        stitcher = FakeStitcher(StitchResult.succeeded(FakeImage("s")))
        usecase = StitchImagesUseCase(codec=FakeCodec(), stitcher=stitcher)

        usecase.execute([b"img1"], "Panorama")

        assert stitcher.received_mode is StitchMode.PANORAMA

    def test_スティッチ失敗時は理由を返す(self) -> None:
        stitcher = FakeStitcher(StitchResult.failed(StitchFailureReason.NEED_MORE_IMAGES))
        usecase = StitchImagesUseCase(codec=FakeCodec(), stitcher=stitcher)

        output = usecase.execute([b"img1", b"img2"], "Scans")

        assert not output.is_success
        assert output.png is None
        assert output.failure is StitchFailureReason.NEED_MORE_IMAGES

    def test_デコード失敗はImageDecodeErrorを送出する(self) -> None:
        stitcher = FakeStitcher(StitchResult.succeeded(FakeImage("s")))
        usecase = StitchImagesUseCase(codec=FakeCodec(), stitcher=stitcher)

        with pytest.raises(ImageDecodeError):
            usecase.execute([b"img1", b"broken"], "Scans")
