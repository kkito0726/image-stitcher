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

    def encode_preview_jpeg(self, image: DecodedImage, max_width: int, quality: int) -> bytes:
        return f"jpeg:{getattr(image, 'name', '?')}:{max_width}:{quality}".encode()


class FakeStitcher:
    def __init__(self, result: StitchResult) -> None:
        self._result = result
        self.received_images: Sequence[DecodedImage] | None = None
        self.received_mode: StitchMode | None = None

    def stitch(self, images: Sequence[DecodedImage], mode: StitchMode) -> StitchResult:
        self.received_images = images
        self.received_mode = mode
        return self._result


class FakeCache:
    def __init__(self) -> None:
        self.stored: dict[str, DecodedImage] = {}

    def put(self, image: DecodedImage) -> str:
        result_id = f"id-{len(self.stored)}"
        self.stored[result_id] = image
        return result_id

    def get(self, result_id: str) -> DecodedImage | None:
        return self.stored.get(result_id)


def _usecase(stitcher: FakeStitcher, cache: FakeCache | None = None) -> StitchImagesUseCase:
    return StitchImagesUseCase(
        codec=FakeCodec(),
        stitcher=stitcher,
        cache=cache or FakeCache(),
        preview_max_width=1920,
        preview_quality=80,
    )


class TestStitchImagesUseCase:
    def test_成功時はプレビューjpegと結果idを返す(self) -> None:
        stitched = FakeImage("stitched")
        usecase = _usecase(FakeStitcher(StitchResult.succeeded(stitched)))

        output = usecase.execute([b"img1", b"img2"], "Scans")

        assert output.is_success
        assert output.preview_jpeg == b"jpeg:stitched:1920:80"
        assert output.result_id is not None
        assert output.failure is None

    def test_成功時はフル解像度画像をキャッシュに格納する(self) -> None:
        stitched = FakeImage("stitched")
        cache = FakeCache()
        usecase = _usecase(FakeStitcher(StitchResult.succeeded(stitched)), cache)

        output = usecase.execute([b"img1", b"img2"], "Scans")

        assert output.result_id is not None
        assert cache.get(output.result_id) is stitched

    def test_全画像をデコードしてスティッチャーに渡す(self) -> None:
        stitcher = FakeStitcher(StitchResult.succeeded(FakeImage("s")))
        usecase = _usecase(stitcher)

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
        _usecase(stitcher).execute([b"img1"], "Panorama")

        assert stitcher.received_mode is StitchMode.PANORAMA

    def test_スティッチ失敗時は理由を返しキャッシュしない(self) -> None:
        cache = FakeCache()
        usecase = _usecase(
            FakeStitcher(StitchResult.failed(StitchFailureReason.NEED_MORE_IMAGES)), cache
        )

        output = usecase.execute([b"img1", b"img2"], "Scans")

        assert not output.is_success
        assert output.preview_jpeg is None
        assert output.result_id is None
        assert output.failure is StitchFailureReason.NEED_MORE_IMAGES
        assert cache.stored == {}

    def test_デコード失敗はImageDecodeErrorを送出する(self) -> None:
        usecase = _usecase(FakeStitcher(StitchResult.succeeded(FakeImage("s"))))

        with pytest.raises(ImageDecodeError):
            usecase.execute([b"img1", b"broken"], "Scans")
