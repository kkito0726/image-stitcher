from dataclasses import dataclass

import numpy as np
import numpy.typing as npt

from src.domain.models import DecodedImage


@dataclass(frozen=True)
class CvImage:
    """DecodedImage の OpenCV 実装。np.ndarray への依存を infra 層に閉じ込める。"""

    mat: npt.NDArray[np.uint8]

    @property
    def width(self) -> int:
        return int(self.mat.shape[1])

    @property
    def height(self) -> int:
        return int(self.mat.shape[0])


def require_cv_image(image: DecodedImage) -> CvImage:
    if not isinstance(image, CvImage):
        raise TypeError(f"CvImage 以外の画像は扱えません: {type(image).__name__}")
    return image
