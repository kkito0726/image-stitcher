from __future__ import annotations

import threading
import uuid
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass

from src.domain.models import DecodedImage


@dataclass(frozen=True)
class _Entry:
    image: DecodedImage
    expires_at: float


class InMemoryResultCache:
    """プロセス内メモリの合成結果キャッシュ。

    TTL による lazy expiry と、保持件数の上限による古いものからの追い出しを行う。
    FastAPI の同期エンドポイントはスレッドプールで実行されるため、Lock で保護する。

    注意: gunicorn を複数ワーカーで動かすと各ワーカーが別プロセス = 別キャッシュになり、
    格納したワーカーと別のワーカーがダウンロード要求を受けると取り出せない。
    本キャッシュは単一ワーカー(-w 1)構成であることを前提とする。
    """

    def __init__(
        self,
        ttl_seconds: float,
        max_entries: int,
        clock: Callable[[], float],
    ) -> None:
        self._ttl = ttl_seconds
        self._max_entries = max_entries
        self._clock = clock
        self._lock = threading.Lock()
        self._entries: OrderedDict[str, _Entry] = OrderedDict()

    def put(self, image: DecodedImage) -> str:
        result_id = uuid.uuid4().hex
        expires_at = self._clock() + self._ttl
        with self._lock:
            self._purge_expired()
            self._entries[result_id] = _Entry(image=image, expires_at=expires_at)
            self._entries.move_to_end(result_id)
            while len(self._entries) > self._max_entries:
                self._entries.popitem(last=False)
        return result_id

    def get(self, result_id: str) -> DecodedImage | None:
        with self._lock:
            entry = self._entries.get(result_id)
            if entry is None:
                return None
            if self._clock() >= entry.expires_at:
                del self._entries[result_id]
                return None
            return entry.image

    def _purge_expired(self) -> None:
        now = self._clock()
        expired = [key for key, entry in self._entries.items() if now >= entry.expires_at]
        for key in expired:
            del self._entries[key]
