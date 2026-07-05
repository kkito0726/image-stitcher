import logging
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.config import Settings
from src.presentation.routers import download, health, stitch
from src.usecase.get_stitch_result import GetStitchResultUseCase
from src.usecase.stitch_images import StitchImagesUseCase

logger = logging.getLogger(__name__)


def create_app(
    stitch_usecase: StitchImagesUseCase,
    get_result_usecase: GetStitchResultUseCase,
    settings: Settings,
    warmup: Callable[[], None] | None = None,
) -> FastAPI:
    """アプリケーションを構築する。依存の生成は行わない (Composition Root は main.py)。"""

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        # ウォームアップ完了までヘルスチェックは応答しない (readiness の保証)
        if warmup is not None:
            await run_in_threadpool(warmup)
        yield

    app = FastAPI(title="image-stitcher-backend", lifespan=lifespan)
    app.state.stitch_usecase = stitch_usecase
    app.state.get_result_usecase = get_result_usecase
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_methods=["*"],
        allow_headers=["*"],
        # JS からフル解像度取得 ID を読めるようにする
        expose_headers=["X-Result-Id"],
    )

    app.include_router(health.router)
    app.include_router(stitch.router)
    app.include_router(download.router)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        message = "リクエストが不正です: mode と images (multipart/form-data) が必要です"
        return JSONResponse(status_code=400, content={"error": message})

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("予期しないエラーが発生しました")
        return JSONResponse(status_code=500, content={"error": "internal server error"})

    return app
