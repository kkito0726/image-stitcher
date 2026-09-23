import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from src.presentation.schemas import ErrorResponse
from src.usecase.get_stitch_result import GetStitchResultUseCase

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get(
    "/stitch/{result_id}/download",
    responses={
        200: {"content": {"image/png": {}}, "description": "フル解像度 PNG"},
        404: {"model": ErrorResponse, "description": "結果が見つからないか期限切れ"},
    },
)
def download(request: Request, result_id: str) -> Response:
    usecase: GetStitchResultUseCase = request.app.state.get_result_usecase
    png = usecase.execute(result_id)
    if png is None:
        return JSONResponse(
            status_code=404, content={"error": "結果が見つからないか有効期限切れです"}
        )
    return Response(content=png, media_type="image/png")
