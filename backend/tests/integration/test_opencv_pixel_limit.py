"""OPENCV_IO_MAX_IMAGE_PIXELS による 1 枚あたりの画素数上限の統合テスト。

OpenCV はこの環境変数をプロセス内で初回参照時にしか読まないため、別プロセスで検証する。
本番では backend/Dockerfile の ENV で設定し、巨大画像をメモリ確保前に拒否させる。
"""

import os
import re
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
import pytest

from src.config import Settings

_BACKEND_ROOT = Path(__file__).resolve().parents[2]

_DECODE_SCRIPT = """
import sys
from src.domain.errors import ImageDecodeError
from src.infra.opencv.cv_codec import CvImageCodec

try:
    CvImageCodec().decode(sys.stdin.buffer.read())
except ImageDecodeError:
    print("rejected")
else:
    print("decoded")
"""


def _png(width: int, height: int) -> bytes:
    ok, buffer = cv2.imencode(".png", np.zeros((height, width, 3), dtype=np.uint8))
    assert ok
    return bytes(buffer.tobytes())


def _decode_in_subprocess(data: bytes, max_pixels: int) -> str:
    env = {**os.environ, "OPENCV_IO_MAX_IMAGE_PIXELS": str(max_pixels)}
    completed = subprocess.run(
        [sys.executable, "-c", _DECODE_SCRIPT],
        input=data,
        capture_output=True,
        cwd=_BACKEND_ROOT,
        env=env,
        timeout=60,
        check=True,
    )
    return completed.stdout.decode().strip()


@pytest.mark.parametrize(
    ("max_pixels", "expected"),
    [(1_000_000, "rejected"), (10_000_000, "decoded")],
)
def test_上限を超える画像はImageDecodeErrorになる(max_pixels: int, expected: str) -> None:
    assert _decode_in_subprocess(_png(2000, 2000), max_pixels) == expected


def test_Dockerfileの1枚あたり上限は合計画素数の上限以下() -> None:
    dockerfile = (_BACKEND_ROOT / "Dockerfile").read_text()
    match = re.search(r"^ENV OPENCV_IO_MAX_IMAGE_PIXELS=(\d+)$", dockerfile, re.MULTILINE)

    assert match is not None
    assert 0 < int(match.group(1)) <= Settings().max_total_pixels
