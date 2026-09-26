from typing import Annotated

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, Response

from src.config import Settings
from src.domain.errors import ImageDecodeError, ImageTooLargeError
from src.domain.models import StitchFailureReason
from src.presentation.error_reason import ErrorReason
from src.presentation.request_logging import record_form, record_reason, summarize_upload
from src.presentation.schemas import ErrorResponse, StitchFailureResponse
from src.usecase.stitch_images import StitchImagesUseCase

router = APIRouter()


def _bad_request(message: str, reason: ErrorReason) -> JSONResponse:
    record_reason(reason)
    return JSONResponse(status_code=400, content={"error": message})


@router.post(
    "/stitch",
    responses={
        200: {
            "content": {"image/jpeg": {}},
            "description": "プレビュー JPEG。X-Result-Id ヘッダーにフル解像度の取得 ID を返す",
        },
        400: {"model": ErrorResponse, "description": "リクエスト不正"},
        422: {"model": StitchFailureResponse, "description": "合成失敗 (特徴点不足など)"},
        500: {"model": ErrorResponse, "description": "内部エラー"},
    },
)
def stitch(
    request: Request,
    mode: Annotated[str, Form()],
    images: Annotated[list[UploadFile], File()],
) -> Response:
    # CPU バウンド処理のため同期エンドポイントとし、FastAPI のスレッドプールで実行させる
    settings: Settings = request.app.state.settings
    usecase: StitchImagesUseCase = request.app.state.stitch_usecase

    record_form(
        {"mode": mode},
        [summarize_upload("images", f.filename, f.content_type, f.size) for f in images],
    )

    if len(images) > settings.max_images:
        return _bad_request(
            f"画像は最大 {settings.max_images} 枚までです", ErrorReason.TOO_MANY_IMAGES
        )

    payloads: list[bytes] = []
    total_bytes = 0
    for upload in images:
        data = upload.file.read()
        total_bytes += len(data)
        if total_bytes > settings.max_body_bytes:
            limit_mb = settings.max_body_bytes // (1024 * 1024)
            return _bad_request(
                f"リクエストボディは合計 {limit_mb}MB までです", ErrorReason.BODY_TOO_LARGE
            )
        payloads.append(data)

    try:
        output = usecase.execute(payloads, mode)
    except ImageTooLargeError as exc:
        return _bad_request(str(exc), ErrorReason.IMAGE_TOO_LARGE)
    except ImageDecodeError as exc:
        return _bad_request(str(exc), ErrorReason.INVALID_IMAGE)

    if output.preview_jpeg is None or output.result_id is None:
        failure = output.failure or StitchFailureReason.NEED_MORE_IMAGES
        record_reason(ErrorReason(failure.value))
        return JSONResponse(status_code=422, content={"isStitched": 1, "reason": failure.value})

    return Response(
        content=output.preview_jpeg,
        media_type="image/jpeg",
        headers={"X-Result-Id": output.result_id},
    )
