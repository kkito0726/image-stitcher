"""構造化ログ (structlog) の設定。

structlog と標準 logging を ProcessorFormatter で統合し、アプリ・gunicorn・uvicorn・
ライブラリのログを同じ形式 (JSON 1 行 1 イベント) で stdout に出す。
gunicorn の logconfig_dict (gunicorn.conf.py) とアプリの起動時で同じ設定を使う。
"""

from __future__ import annotations

import logging
import logging.config
import os
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

import structlog


class LogFormat(StrEnum):
    JSON = "json"
    CONSOLE = "console"  # 開発用のカラー表示


_LEVELS = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
}


@dataclass(frozen=True)
class LogSettings:
    level: int = logging.INFO
    format: LogFormat = LogFormat.JSON

    @classmethod
    def from_env(cls) -> LogSettings:
        """LOG_LEVEL / LOG_FORMAT を読む。不正な値は設定ミスに気づけるよう起動時に落とす。"""
        raw_level = os.environ.get("LOG_LEVEL", "INFO").strip().upper()
        if raw_level not in _LEVELS:
            raise ValueError(f"LOG_LEVEL は {', '.join(_LEVELS)} のいずれか: {raw_level}")
        raw_format = os.environ.get("LOG_FORMAT", LogFormat.JSON).strip().lower()
        try:
            log_format = LogFormat(raw_format)
        except ValueError:
            choices = ", ".join(f.value for f in LogFormat)
            raise ValueError(f"LOG_FORMAT は {choices} のいずれか: {raw_format}") from None
        return cls(level=_LEVELS[raw_level], format=log_format)


# structlog と標準 logging の両方のログに通す processor
_SHARED_PROCESSORS: list[Any] = [
    structlog.contextvars.merge_contextvars,
    structlog.stdlib.add_log_level,
    structlog.stdlib.add_logger_name,
    structlog.processors.TimeStamper(fmt="iso", utc=True),
    structlog.processors.StackInfoRenderer(),
]


# JSON で先頭に並べるキー。時刻から読めるよう timestamp を最初にする
_LEADING_KEYS = ("timestamp", "level", "event", "logger", "request_id", "cf_ray")


def _leading_keys_first(
    _logger: Any, _method_name: str, event_dict: structlog.typing.EventDict
) -> structlog.typing.EventDict:
    ordered = {key: event_dict[key] for key in _LEADING_KEYS if key in event_dict}
    ordered.update(event_dict)  # 残りのキーは元の順序のまま後ろに付く
    return ordered


def _renderer(log_format: LogFormat) -> list[Any]:
    if log_format is LogFormat.CONSOLE:
        return [structlog.dev.ConsoleRenderer()]
    return [
        structlog.processors.format_exc_info,
        _leading_keys_first,
        structlog.processors.JSONRenderer(ensure_ascii=False),
    ]


def build_logging_dict(settings: LogSettings) -> dict[str, Any]:
    """logging.config.dictConfig 用の設定。gunicorn の logconfig_dict にもそのまま渡す。"""
    level = logging.getLevelName(settings.level)
    handler = {"handlers": ["default"], "propagate": False, "level": level}
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "structlog": {
                "()": structlog.stdlib.ProcessorFormatter,
                "foreign_pre_chain": _SHARED_PROCESSORS,
                "processors": [
                    structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                    *_renderer(settings.format),
                ],
            }
        },
        "handlers": {
            "default": {
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
                "formatter": "structlog",
            }
        },
        "root": {"handlers": ["default"], "level": level},
        "loggers": {
            # UvicornWorker は gunicorn.error のハンドラを uvicorn.error にコピーして
            # 伝播を止めるため、伝播に頼らず直接ハンドラを持たせる
            "gunicorn.error": handler,
            "uvicorn.error": handler,
            # アクセスログは接続元 IP を含み、request.completed で代替するため止める
            "gunicorn.access": {**handler, "level": "WARNING"},
            "uvicorn.access": {**handler, "level": "WARNING"},
        },
    }


def configure_logging(settings: LogSettings) -> None:
    """アプリ起動時に 1 回呼ぶ。何度呼んでもハンドラは重複しない。"""
    structlog.configure(
        processors=[
            *_SHARED_PROCESSORS,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        # テストで設定を差し替えられるよう、ロガーをキャッシュしない
        cache_logger_on_first_use=False,
    )
    logging.config.dictConfig(build_logging_dict(settings))
