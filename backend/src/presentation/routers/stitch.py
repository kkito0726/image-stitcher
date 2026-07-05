import logging
from typing import Annotated

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, Response

from src.config import Settings
from src.domain.errors import ImageDecodeError
from src.domain.models import StitchFailureReason
from src.presentation.schemas import ErrorResponse, StitchFailureResponse
from src.usecase.stitch_images import StitchImagesUseCase

router = APIRouter()
logger = logging.getLogger(__name__)


def _bad_request(message: str) -> JSONResponse:
    return JSONResponse(status_code=400, content={"error": message})


@router.post(
    "/stitch",
    responses={
        200: {"content": {"image/png": {}}, "description": "合成画像 (PNG バイナリ)"},
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
    usecase: StitchImagesUseCase = request.app.state.usecase

    if len(images) > settings.max_images:
        return _bad_request(f"画像は最大 {settings.max_images} 枚までです")

    payloads: list[bytes] = []
    total_bytes = 0
    for upload in images:
        data = upload.file.read()
        total_bytes += len(data)
        if total_bytes > settings.max_body_bytes:
            limit_mb = settings.max_body_bytes // (1024 * 1024)
            return _bad_request(f"リクエストボディは合計 {limit_mb}MB までです")
        payloads.append(data)

    try:
        output = usecase.execute(payloads, mode)
    except ImageDecodeError as exc:
        return _bad_request(str(exc))

    if output.png is None:
        failure = output.failure or StitchFailureReason.NEED_MORE_IMAGES
        return JSONResponse(status_code=422, content={"isStitched": 1, "reason": failure.value})
    return Response(content=output.png, media_type="image/png")
