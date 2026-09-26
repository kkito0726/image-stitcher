"""起動済みの本番イメージに対するスモークテスト。

SMOKE_BASE_URL (例: http://127.0.0.1:5000) が設定されているときだけ実行する。
CI では PR ごとに本番イメージをビルド・起動して実行し、Dockerfile の変更
(依存・起動コマンド・OPENCV_IO_MAX_IMAGE_PIXELS など) をマージ前に検証する。
"""

import os
import time
from collections.abc import Iterator

import cv2
import httpx
import numpy as np
import pytest

from src.infra.opencv.sample_images import make_overlapping_tiles

_BASE_URL = os.environ.get("SMOKE_BASE_URL")
_READY_TIMEOUT_SECONDS = 120

pytestmark = pytest.mark.skipif(_BASE_URL is None, reason="SMOKE_BASE_URL が未設定")


def _as_files(payloads: list[bytes]) -> list[tuple[str, tuple[str, bytes, str]]]:
    return [("images", (f"tile{i}.png", data, "image/png")) for i, data in enumerate(payloads)]


def _wait_until_ready(client: httpx.Client) -> None:
    # ウォームアップ完了まで /health は応答しない
    deadline = time.monotonic() + _READY_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        try:
            if client.get("/health").status_code == 200:
                return
        except httpx.TransportError:
            pass
        time.sleep(1)
    pytest.fail(f"{_READY_TIMEOUT_SECONDS} 秒以内に /health が応答しませんでした")


@pytest.fixture(scope="module")
def client() -> Iterator[httpx.Client]:
    assert _BASE_URL is not None
    with httpx.Client(base_url=_BASE_URL, timeout=60) as c:
        _wait_until_ready(c)
        yield c


def test_合成してフル解像度をダウンロードできる(client: httpx.Client) -> None:
    res = client.post("/stitch", data={"mode": "Scans"}, files=_as_files(make_overlapping_tiles()))

    assert res.status_code == 200
    assert res.headers["content-type"] == "image/jpeg"
    download = client.get(f"/stitch/{res.headers['x-result-id']}/download?format=png")
    assert download.status_code == 200
    assert download.headers["content-type"] == "image/png"


def test_画素数が上限を超える画像は400で拒否されほかの結果は残る(client: httpx.Client) -> None:
    stored = client.post(
        "/stitch", data={"mode": "Scans"}, files=_as_files(make_overlapping_tiles())
    )
    assert stored.status_code == 200
    result_id = stored.headers["x-result-id"]

    # 圧縮後は小さいがデコード後は 4900 万画素になり、イメージの既定の上限 (4000 万) を超える
    ok, buffer = cv2.imencode(".png", np.zeros((7000, 7000, 3), dtype=np.uint8))
    assert ok
    oversized = bytes(buffer.tobytes())
    res = client.post("/stitch", data={"mode": "Scans"}, files=_as_files([oversized, oversized]))

    assert res.status_code == 400
    assert client.get("/health").status_code == 200
    assert client.get(f"/stitch/{result_id}/download").status_code == 200
