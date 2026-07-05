from collections.abc import Sequence
from typing import cast

import cv2
import numpy as np
import numpy.typing as npt

from src.domain.models import DecodedImage, StitchFailureReason, StitchMode, StitchResult
from src.infra.opencv.cv_image import CvImage, require_cv_image

_MODE_MAP = {
    StitchMode.SCANS: cv2.Stitcher_SCANS,
    StitchMode.PANORAMA: cv2.Stitcher_PANORAMA,
}

_FAILURE_MAP = {
    cv2.Stitcher_ERR_NEED_MORE_IMGS: StitchFailureReason.NEED_MORE_IMAGES,
    cv2.Stitcher_ERR_HOMOGRAPHY_EST_FAIL: StitchFailureReason.HOMOGRAPHY_ESTIMATION_FAILED,
    cv2.Stitcher_ERR_CAMERA_PARAMS_ADJUST_FAIL: StitchFailureReason.CAMERA_PARAMS_ADJUST_FAILED,
}


class CvImageStitcher:
    """ImageStitcher の OpenCV 実装。

    cv2.Stitcher はステートフルなためリクエストごとに生成する。
    画像は list のまま渡す(サイズの異なる画像を np.array で束ねると壊れるため)。
    """

    def stitch(self, images: Sequence[DecodedImage], mode: StitchMode) -> StitchResult:
        mats = [require_cv_image(image).mat for image in images]
        stitcher = cv2.Stitcher.create(_MODE_MAP[mode])
        status, stitched = stitcher.stitch(mats)
        if status == cv2.Stitcher_OK:
            return StitchResult.succeeded(CvImage(mat=cast(npt.NDArray[np.uint8], stitched)))
        reason = _FAILURE_MAP.get(status, StitchFailureReason.NEED_MORE_IMAGES)
        return StitchResult.failed(reason)
