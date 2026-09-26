from enum import StrEnum


class ErrorReason(StrEnum):
    """4xx / 5xx の理由コード。ログの集計用で、利用者に返すメッセージとは別に持つ。

    追加・変更したら docs/logging-design.md の表も更新する。
    """

    INVALID_PARAMS = "invalid_params"  # 必須項目の欠落・format 不正 (RequestValidationError)
    TOO_MANY_IMAGES = "too_many_images"
    BODY_TOO_LARGE = "body_too_large"
    INVALID_IMAGE = "invalid_image"  # デコードできない
    IMAGE_TOO_LARGE = "image_too_large"  # デコード後の画素数が上限超過
    NEED_MORE_IMAGES = "need_more_images"  # 以下 3 つは StitchFailureReason と同じ値 (422)
    HOMOGRAPHY_ESTIMATION_FAILED = "homography_estimation_failed"
    CAMERA_PARAMS_ADJUST_FAILED = "camera_params_adjust_failed"
    RESULT_NOT_FOUND = "result_not_found"  # 期限切れ・存在しない結果 ID
    INTERNAL_ERROR = "internal_error"
