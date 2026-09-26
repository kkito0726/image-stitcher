from collections.abc import Iterator
from typing import Any

import pytest
import structlog
from structlog.testing import LogCapture


@pytest.fixture
def log_events() -> Iterator[list[dict[str, Any]]]:
    """structlog のイベントを捕捉する。

    structlog.testing.capture_logs() は processor を置き換えて contextvars が付かないため、
    merge_contextvars を通してから捕捉し、request_id の束ね方まで検証できるようにする。
    """
    capture = LogCapture()
    structlog.configure(
        processors=[structlog.contextvars.merge_contextvars, capture],
        cache_logger_on_first_use=False,
    )
    yield capture.entries
    structlog.reset_defaults()
