"""リクエスト単位のログ出力 (request.received / request.completed / request.failed)。

- request_id を contextvars に束ね、スレッドプールで動く usecase のログにも自動で付ける
- 到着時に request.received を出す。処理中にワーカーごと落ちて request.completed が
  出なかった場合も、どのリクエストで落ちたかが残る
- 利用者のデータ (画像の中身・ファイル名) と秘密情報は出さない。IP アドレスも記録しない
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from collections.abc import Iterable
from contextvars import ContextVar
from dataclasses import dataclass
from pathlib import PurePath
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import structlog
from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from src.presentation.error_reason import ErrorReason

logger = structlog.stdlib.get_logger("request_logging")

REDACTED = "[REDACTED]"
_REQUEST_ID_PATTERN = re.compile(r"[A-Za-z0-9-]{1,64}")
_HEADER_VALUE_MAX = 512
_USER_AGENT_MAX = 256
_UNMATCHED_PATH_MAX = 128
_QUERY_MAX = 256
_NOT_LOGGED_PATHS = frozenset({"/health"})  # Docker のヘルスチェックが 30 秒ごとに叩く

# 値を出すヘッダ。IP を含むもの (X-Real-IP, X-Forwarded-For, CF-Connecting-IP) や
# Cookie / Authorization はここに無いので伏せられる
_HEADER_ALLOWLIST = frozenset(
    {
        "content-type",
        "content-length",
        "user-agent",
        "accept",
        "accept-language",
        "origin",
        "referer",
        "x-request-id",
        "cf-ray",
        "cf-ipcountry",
    }
)


def resolve_request_id(header: str | None) -> str:
    """nginx から来た X-Request-ID を採用する。形式が不正ならログ偽装対策で作り直す。"""
    if header is not None and _REQUEST_ID_PATTERN.fullmatch(header):
        return header
    return uuid.uuid4().hex


def _strip_url_query(value: str) -> str:
    # クエリやフラグメントにはトークンが入り得るため scheme / host / path だけ残す
    parts = urlsplit(value)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def redact_headers(headers: Iterable[tuple[str, str]]) -> dict[str, str]:
    redacted: dict[str, str] = {}
    for name, value in headers:
        lower = name.lower()
        if lower not in _HEADER_ALLOWLIST:
            redacted[name] = REDACTED
        elif lower == "referer":
            redacted[name] = _strip_url_query(value)[:_HEADER_VALUE_MAX]
        else:
            redacted[name] = value[:_HEADER_VALUE_MAX]
    return redacted


def truncate_user_agent(value: str | None) -> str | None:
    return None if value is None else value[:_USER_AGENT_MAX]


def summarize_upload(
    field: str, filename: str | None, content_type: str | None, size: int | None
) -> dict[str, Any]:
    """アップロードファイルの要約。ファイル名そのものと中身は出さない。"""
    name = filename or ""
    return {
        "field": field,
        "content_type": content_type,
        "size": size,
        "ext": PurePath(name).suffix.lower(),
        "filename_len": len(name),
    }


@dataclass
class RequestLogState:
    """リクエスト 1 件分のログ材料。ルーターや例外ハンドラが書き込み、ミドルウェアが出力する。

    同期エンドポイントはコピーされた context のスレッドで動くため、contextvars に値を
    束ね直しても戻ってこない。同じオブジェクトを共有して書き込ませる。
    """

    reason: ErrorReason | None = None


_current_state: ContextVar[RequestLogState | None] = ContextVar("request_log_state", default=None)


def current_log_state() -> RequestLogState:
    """ミドルウェアの外 (単体テスト等) で呼ばれても壊れないよう、無ければ捨てる用を返す。"""
    return _current_state.get() or RequestLogState()


def record_reason(reason: ErrorReason) -> None:
    current_log_state().reason = reason


_RESULT_ID_IN_PATH = re.compile(r"^/stitch/[^/]+/download")


def _masked_raw_path(scope: Scope) -> str:
    # 生のパスは結果 ID (ダウンロードの鍵) を含むため伏せる
    raw = str(scope.get("path", ""))
    masked = _RESULT_ID_IN_PATH.sub("/stitch/{result_id}/download", raw)
    return masked[:_UNMATCHED_PATH_MAX]


def _route_path(scope: Scope) -> str:
    # ルーティング後はテンプレートを出す。ルートに当たらない場合 (末尾スラッシュの 307 など)
    # も結果 ID の部分は伏せる
    route = scope.get("route")
    path_format = getattr(route, "path_format", None)
    if isinstance(path_format, str):
        return path_format
    return _masked_raw_path(scope)


def _level_for(status: int) -> int:
    if status >= 500:
        return logging.ERROR
    if status >= 400:
        return logging.WARNING  # 利用者の入力ミス。対応が必要なものだけを error にする
    return logging.INFO


_INTERNAL_ERROR_BODY = json.dumps({"error": "internal server error"}).encode()


class RequestLoggingMiddleware:
    """pure ASGI ミドルウェア。

    BaseHTTPMiddleware ではなく pure ASGI にするのは、contextvars を確実に下流へ渡すため。
    想定外の例外は Starlette の ServerErrorMiddleware (ユーザーミドルウェアの外側) が処理するため、
    ここで捕まえてログを出し、X-Request-ID 付きの 500 を返す。CORS ミドルウェアの内側に置くので、
    この 500 にも CORS ヘッダが付き、CORS が応答するプリフライトは記録しない。
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        request_id = resolve_request_id(headers.get("x-request-id"))
        structlog.contextvars.clear_contextvars()
        context: dict[str, str] = {"request_id": request_id}
        if cf_ray := headers.get("cf-ray"):
            context["cf_ray"] = cf_ray[:_HEADER_VALUE_MAX]
        structlog.contextvars.bind_contextvars(**context)

        self._log_received(scope, headers)
        state = RequestLogState()
        token = _current_state.set(state)
        started = time.perf_counter()
        status = 500
        response_started = False

        async def send_with_request_id(message: Message) -> None:
            nonlocal status, response_started
            if message["type"] == "http.response.start":
                status = message["status"]
                response_started = True
                MutableHeaders(scope=message).append("X-Request-ID", request_id)
            await send(message)

        aborted = False
        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            logger.exception("request.failed")
            state.reason = ErrorReason.INTERNAL_ERROR
            if response_started:
                # 送信済みのステータスは変えられない。応答が途中で切れたことを記録して再送出する
                aborted = True
                raise
            status = 500
            await self._send_internal_error(send_with_request_id)
        finally:
            _current_state.reset(token)
            self._log_completed(scope, headers, state, status, started, aborted)
            structlog.contextvars.clear_contextvars()

    @staticmethod
    def _log_received(scope: Scope, headers: Headers) -> None:
        path = _masked_raw_path(scope)
        if path in _NOT_LOGGED_PATHS:
            return
        logger.info(
            "request.received",
            method=scope.get("method"),
            path=path,
            query=bytes(scope.get("query_string", b"")).decode("latin-1")[:_QUERY_MAX],
            content_length=headers.get("content-length"),
            user_agent=truncate_user_agent(headers.get("user-agent")),
            headers=redact_headers(headers.items()),
        )

    @staticmethod
    async def _send_internal_error(send: Send) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": 500,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(_INTERNAL_ERROR_BODY)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": _INTERNAL_ERROR_BODY})

    @staticmethod
    def _log_completed(
        scope: Scope,
        headers: Headers,
        state: RequestLogState,
        status: int,
        started: float,
        aborted: bool,
    ) -> None:
        path = _route_path(scope)
        if path in _NOT_LOGGED_PATHS:
            return
        level = logging.ERROR if aborted else _level_for(status)
        event: dict[str, Any] = {
            "method": scope.get("method"),
            "path": path,
            "status": status,
            "duration_ms": round((time.perf_counter() - started) * 1000),
            "content_length": headers.get("content-length"),
            "user_agent": truncate_user_agent(headers.get("user-agent")),
        }
        if state.reason is not None:
            event["reason"] = state.reason
        if aborted:
            event["aborted"] = True
        logger.log(level, "request.completed", **event)
