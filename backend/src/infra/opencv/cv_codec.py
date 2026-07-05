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

    def encode_preview_jpeg(self, image: DecodedImage, max_width: int, quality: int) -> bytes:
        mat = require_cv_image(image).mat
        width = mat.shape[1]
        if width > max_width:
            scale = max_width / width
            new_size = (max_width, max(1, round(mat.shape[0] * scale)))
            mat = cast(
                npt.NDArray[np.uint8],
                cv2.resize(mat, new_size, interpolation=cv2.INTER_AREA),
            )
        ok, buffer = cv2.imencode(".jpg", mat, [cv2.IMWRITE_JPEG_QUALITY, quality])
        if not ok:
            raise RuntimeError("JPEG エンコードに失敗しました")
        return bytes(buffer.tobytes())
