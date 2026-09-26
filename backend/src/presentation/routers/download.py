import logging
from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, Response

from src.domain.models import DownloadFormat
from src.presentation.schemas import ErrorResponse
from src.usecase.get_stitch_result import GetStitchResultUseCase

router = APIRouter()
logger = logging.getLogger(__name__)

_MEDIA_TYPES = {DownloadFormat.JPEG: "image/jpeg", DownloadFormat.PNG: "image/png"}


@router.get(
    "/stitch/{result_id}/download",
    responses={
        200: {
            "content": {"image/jpeg": {}, "image/png": {}},
            "description": "フル解像度画像 (既定 JPEG、format=png でロスレス PNG)",
        },
        404: {"model": ErrorResponse, "description": "結果が見つからないか期限切れ"},
    },
)
def download(
    request: Request,
    result_id: str,
    fmt: Annotated[DownloadFormat, Query(alias="format")] = DownloadFormat.JPEG,
) -> Response:
    usecase: GetStitchResultUseCase = request.app.state.get_result_usecase
    image = usecase.execute(result_id, fmt)
    if image is None:
        return JSONResponse(
            status_code=404, content={"error": "結果が見つからないか有効期限切れです"}
        )
    return Response(content=image, media_type=_MEDIA_TYPES[fmt])
