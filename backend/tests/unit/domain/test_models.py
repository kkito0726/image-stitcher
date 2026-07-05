import dataclasses

import pytest

from src.domain.models import StitchFailureReason, StitchMode, StitchResult


class FakeImage:
    @property
    def width(self) -> int:
        return 10

    @property
    def height(self) -> int:
        return 20


class TestStitchMode:
    def test_scansラベルはscansになる(self) -> None:
        assert StitchMode.from_label("Scans") is StitchMode.SCANS

    def test_panoramaラベルはpanoramaになる(self) -> None:
        assert StitchMode.from_label("Panorama") is StitchMode.PANORAMA

    def test_未知のラベルはpanoramaとして扱う(self) -> None:
        # 現行 Python 実装と同一挙動: "Scans" 以外はすべて Panorama
        assert StitchMode.from_label("unknown") is StitchMode.PANORAMA


class TestStitchResult:
    def test_成功結果は画像を持ち失敗理由を持たない(self) -> None:
        image = FakeImage()
        result = StitchResult.succeeded(image)
        assert result.is_success
        assert result.image is image
        assert result.failure is None

    def test_失敗結果は理由を持ち画像を持たない(self) -> None:
        result = StitchResult.failed(StitchFailureReason.NEED_MORE_IMAGES)
        assert not result.is_success
        assert result.image is None
        assert result.failure is StitchFailureReason.NEED_MORE_IMAGES

    def test_イミュータブルである(self) -> None:
        result = StitchResult.failed(StitchFailureReason.NEED_MORE_IMAGES)
        with pytest.raises(dataclasses.FrozenInstanceError):
            result.image = FakeImage()  # type: ignore[misc]
