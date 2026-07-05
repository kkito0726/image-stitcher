from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Protocol


class StitchMode(Enum):
    SCANS = "Scans"
    PANORAMA = "Panorama"

    @classmethod
    def from_label(cls, label: str) -> StitchMode:
        # 互換仕様: "Scans" 以外のラベルはすべて Panorama として扱う
        return cls.SCANS if label == cls.SCANS.value else cls.PANORAMA


class StitchFailureReason(Enum):
    NEED_MORE_IMAGES = "need_more_images"
    HOMOGRAPHY_ESTIMATION_FAILED = "homography_estimation_failed"
    CAMERA_PARAMS_ADJUST_FAILED = "camera_params_adjust_failed"


class DecodedImage(Protocol):
    """デコード済み画像の抽象。実データ表現(np.ndarray 等)は infra 層に閉じる。"""

    @property
    def width(self) -> int: ...

    @property
    def height(self) -> int: ...


@dataclass(frozen=True)
class StitchResult:
    image: DecodedImage | None
    failure: StitchFailureReason | None

    @classmethod
    def succeeded(cls, image: DecodedImage) -> StitchResult:
        return cls(image=image, failure=None)

    @classmethod
    def failed(cls, reason: StitchFailureReason) -> StitchResult:
        return cls(image=None, failure=reason)

    @property
    def is_success(self) -> bool:
        return self.image is not None
