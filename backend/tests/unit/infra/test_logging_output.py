"""configure_logging() が実際に出力する JSON 行の検証 (本番と同じ processor を通す)。"""

import json
import logging
from collections.abc import Iterator

import pytest
import structlog

from src.infra.logging_config import LogFormat, LogSettings, configure_logging


@pytest.fixture(autouse=True)
def _restore_logging() -> Iterator[None]:
    yield
    # capsys の差し替え先を掴んだハンドラを残さない
    root = logging.getLogger()
    for handler in list(root.handlers):
        root.removeHandler(handler)
    for name in ("gunicorn.error", "uvicorn.error", "gunicorn.access", "uvicorn.access"):
        logging.getLogger(name).handlers.clear()
    structlog.reset_defaults()


def _json_lines(capsys: pytest.CaptureFixture[str]) -> list[dict[str, object]]:
    return [json.loads(line) for line in capsys.readouterr().out.splitlines() if line]


def test_structlogと標準loggingのログが1行ずつJSONで出る(
    capsys: pytest.CaptureFixture[str],
) -> None:
    configure_logging(LogSettings(level=logging.INFO, format=LogFormat.JSON))
    configure_logging(LogSettings(level=logging.INFO, format=LogFormat.JSON))  # 2 回目で重複しない
    structlog.contextvars.bind_contextvars(request_id="rid-1")
    try:
        structlog.stdlib.get_logger("app").info("stitch.completed", stitch_ms=5)
        logging.getLogger("uvicorn.error").info("Started server process")
    finally:
        structlog.contextvars.clear_contextvars()

    lines = _json_lines(capsys)

    assert [line["event"] for line in lines] == ["stitch.completed", "Started server process"]
    for line in lines:
        assert list(line)[:5] == ["timestamp", "level", "event", "logger", "request_id"]
    assert all(line["request_id"] == "rid-1" for line in lines)
    assert lines[0]["level"] == "info"
    assert lines[0]["stitch_ms"] == 5
    assert str(lines[0]["timestamp"]).endswith("Z")


def test_例外はスタックトレースを文字列で出す(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging(LogSettings(level=logging.INFO, format=LogFormat.JSON))
    try:
        raise ValueError("boom")
    except ValueError:
        structlog.stdlib.get_logger("app").exception("request.failed")

    [line] = _json_lines(capsys)

    assert line["level"] == "error"
    assert "ValueError: boom" in str(line["exception"])


def test_アクセスログは出さない(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging(LogSettings(level=logging.INFO, format=LogFormat.JSON))

    logging.getLogger("uvicorn.access").info('127.0.0.1:5000 - "GET / HTTP/1.1" 200')

    assert _json_lines(capsys) == []
