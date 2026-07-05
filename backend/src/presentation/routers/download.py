import logging
import secrets
from typing import Annotated

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse, Response

from src.config import Settings
from src.presentation.schemas import ErrorResponse
from src.usecase.get_stitch_result import GetStitchResultUseCase

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get(
    "/stitch/{result_id}/download",
    responses={
        200: {"content": {"image/png": {}}, "description": "フル解像度 PNG"},
        401: {"model": ErrorResponse, "description": "パスワードが必要 / 不一致"},
        404: {"model": ErrorResponse, "description": "結果が見つからないか期限切れ"},
    },
)
def download(
    request: Request,
    result_id: str,
    x_download_password: Annotated[str | None, Header()] = None,
) -> Response:
    settings: Settings = request.app.state.settings
    usecase: GetStitchResultUseCase = request.app.state.get_result_usecase

    # パスワード検証はキャッシュ参照・エンコードより前に行う(不正試行のコストを最小化)
    required = settings.download_password
    if required is not None and (
        x_download_password is None or not secrets.compare_digest(x_download_password, required)
    ):
        return JSONResponse(status_code=401, content={"error": "パスワードが違います"})

    png = usecase.execute(result_id)
    if png is None:
        return JSONResponse(
            status_code=404, content={"error": "結果が見つからないか有効期限切れです"}
        )
    return Response(content=png, media_type="image/png")
