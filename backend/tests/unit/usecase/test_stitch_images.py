from collections.abc import Sequence
from typing import Any

import pytest

from src.domain.errors import ImageDecodeError, ImageTooLargeError
from src.domain.models import DecodedImage, StitchFailureReason, StitchMode, StitchResult
from src.usecase.stitch_images import StitchImagesUseCase


class FakeImage:
    def __init__(self, name: str, width: int = 1, height: int = 1) -> None:
        self.name = name
        self._width = width
        self._height = height

    @property
    def width(self) -> int:
        return self._width

    @property
    def height(self) -> int:
        return self._height


class FakeCodec:
    def decode(self, data: bytes) -> DecodedImage:
        if data == b"broken":
            raise ImageDecodeError("decode failed")
        # "name:WxH" 形式ならその寸法の画像として扱う
        name, _, size = data.decode().partition(":")
        if size:
            width, height = (int(v) for v in size.split("x"))
            return FakeImage(name, width, height)
        return FakeImage(name)

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


def _usecase(
    stitcher: FakeStitcher,
    cache: FakeCache | None = None,
    max_total_pixels: int = 1_000_000,
) -> StitchImagesUseCase:
    return StitchImagesUseCase(
        codec=FakeCodec(),
        stitcher=stitcher,
        cache=cache or FakeCache(),
        preview_max_width=1920,
        preview_quality=80,
        max_total_pixels=max_total_pixels,
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

    def test_合計画素数が上限ちょうどなら合成する(self) -> None:
        stitcher = FakeStitcher(StitchResult.succeeded(FakeImage("s")))
        usecase = _usecase(stitcher, max_total_pixels=200)

        output = usecase.execute([b"a:10x10", b"b:10x10"], "Scans")

        assert output.is_success

    def test_合計画素数が上限を超えるとImageTooLargeErrorを送出し合成しない(self) -> None:
        stitcher = FakeStitcher(StitchResult.succeeded(FakeImage("s")))
        usecase = _usecase(stitcher, max_total_pixels=199)

        with pytest.raises(ImageTooLargeError):
            usecase.execute([b"a:10x10", b"b:10x10"], "Scans")

        assert stitcher.received_images is None

    def test_上限を超えた時点で残りの画像をデコードしない(self) -> None:
        stitcher = FakeStitcher(StitchResult.succeeded(FakeImage("s")))
        usecase = _usecase(stitcher, max_total_pixels=150)

        # 2 枚目で上限超過するため、3 枚目の壊れた画像には到達しない
        with pytest.raises(ImageTooLargeError, match="画素"):
            usecase.execute([b"a:10x10", b"b:10x10", b"broken"], "Scans")

    def test_合成の所要時間と規模をログに出す(self, log_events: list[dict[str, Any]]) -> None:
        stitched = FakeImage("s", 30, 20)
        usecase = _usecase(FakeStitcher(StitchResult.succeeded(stitched)))

        usecase.execute([b"a:10x10", b"b:10x10"], "Scans")

        [event] = [e for e in log_events if e["event"] == "stitch.completed"]
        assert event["log_level"] == "info"
        assert event["mode"] == "Scans"
        assert event["image_count"] == 2
        assert event["total_pixels"] == 200
        assert event["stitched"] is True
        assert event["output_width"] == 30
        assert event["output_height"] == 20
        for key in ("decode_ms", "stitch_ms", "preview_ms"):
            assert isinstance(event[key], int)

    def test_合成できなかったときも失敗理由と所要時間をログに出す(
        self, log_events: list[dict[str, Any]]
    ) -> None:
        usecase = _usecase(FakeStitcher(StitchResult.failed(StitchFailureReason.NEED_MORE_IMAGES)))

        usecase.execute([b"a:10x10", b"b:10x10"], "Scans")

        [event] = [e for e in log_events if e["event"] == "stitch.completed"]
        assert event["stitched"] is False
        assert event["failure"] == "need_more_images"
        assert isinstance(event["stitch_ms"], int)
