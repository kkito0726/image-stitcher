from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy"}


@router.get("/", response_class=PlainTextResponse)
def index() -> str:
    # 旧バックエンドとの疎通確認互換
    return "Server!"
