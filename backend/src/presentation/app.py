from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.config import Settings
from src.presentation.error_reason import ErrorReason
from src.presentation.request_logging import RequestLoggingMiddleware, record_reason
from src.presentation.routers import download, health, stitch
from src.usecase.get_stitch_result import GetStitchResultUseCase
from src.usecase.stitch_images import StitchImagesUseCase


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

    # add_middleware は後に追加したものが外側になる。ログを CORS の内側に置く
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_methods=["*"],
        allow_headers=["*"],
        # JS からフル解像度取得 ID と、問い合わせ時の突き合わせ用 ID を読めるようにする
        expose_headers=["X-Result-Id", "X-Request-ID"],
    )

    app.include_router(health.router)
    app.include_router(stitch.router)
    app.include_router(download.router)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        record_reason(ErrorReason.INVALID_PARAMS)
        if request.url.path.endswith("/download"):
            message = "リクエストが不正です: format には jpeg か png を指定してください"
        else:
            message = "リクエストが不正です: mode と images (multipart/form-data) が必要です"
        return JSONResponse(status_code=400, content={"error": message})

    # 想定外の例外は RequestLoggingMiddleware が request.failed を記録し、詳細を含まない 500 を返す

    return app
