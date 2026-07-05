from typing import cast

import cv2
import numpy as np
import numpy.typing as npt

from src.domain.errors import ImageDecodeError
from src.domain.models import DecodedImage
from src.infra.opencv.cv_image import CvImage, require_cv_image


class CvImageCodec:
    """ImageCodec の OpenCV 実装。"""

    def decode(self, data: bytes) -> DecodedImage:
        buffer = np.frombuffer(data, dtype=np.uint8)
        try:
            mat = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
        except cv2.error as exc:
            raise ImageDecodeError("画像データをデコードできませんでした") from exc
        if mat is None:
            raise ImageDecodeError("画像データをデコードできませんでした")
        return CvImage(mat=cast(npt.NDArray[np.uint8], mat))

    def encode_png(self, image: DecodedImage) -> bytes:
        mat = require_cv_image(image).mat
        ok, buffer = cv2.imencode(".png", mat)
        if not ok:
            raise RuntimeError("PNG エンコードに失敗しました")
        return bytes(buffer.tobytes())
