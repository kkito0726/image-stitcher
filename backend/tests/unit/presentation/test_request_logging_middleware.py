from typing import Any

import pytest
from starlette.types import Receive, Scope, Send

from src.presentation.request_logging import RequestLoggingMiddleware


async def _fails_after_response_started(scope: Scope, receive: Receive, send: Send) -> None:
    await send({"type": "http.response.start", "status": 200, "headers": []})
    raise RuntimeError("本文の送信中に失敗")


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_レスポンス送信開始後の失敗はerrorで記録して再送出する(
    log_events: list[dict[str, Any]],
) -> None:
    middleware = RequestLoggingMiddleware(_fails_after_response_started)
    sent: list[dict[str, Any]] = []

    async def receive() -> dict[str, Any]:
        return {"type": "http.request", "body": b""}

    async def send(message: dict[str, Any]) -> None:
        sent.append(message)

    scope = {"type": "http", "method": "GET", "path": "/stream", "headers": []}
    with pytest.raises(RuntimeError):
        await middleware(scope, receive, send)

    [completed] = [e for e in log_events if e["event"] == "request.completed"]
    assert completed["log_level"] == "error"
    assert completed["reason"] == "internal_error"
    assert completed["aborted"] is True
