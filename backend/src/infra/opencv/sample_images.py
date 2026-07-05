"""ウォームアップ・テスト用の合成可能なサンプル画像を生成する。"""

from typing import cast

import cv2
import numpy as np
import numpy.typing as npt


def make_overlapping_tiles(
    width: int = 1200,
    height: int = 400,
    overlap: float = 0.4,
    seed: int = 42,
) -> list[bytes]:
    """特徴点マッチングが成立するテクスチャ画像を 2 枚のオーバーラップタイルとして返す。"""
    rng = np.random.default_rng(seed)
    canvas = np.full((height, width, 3), 230, dtype=np.uint8)
    n_blobs = int(width * height / 1500)
    xs = rng.integers(0, width, n_blobs)
    ys = rng.integers(0, height, n_blobs)
    radii = rng.integers(2, 12, n_blobs)
    colors = rng.integers(30, 200, (n_blobs, 3))
    for x, y, r, c in zip(xs, ys, radii, colors, strict=True):
        cv2.circle(canvas, (int(x), int(y)), int(r), tuple(int(v) for v in c), -1)
    canvas = cast(npt.NDArray[np.uint8], cv2.GaussianBlur(canvas, (3, 3), 0))

    tile_w = int(width / (2 - overlap))
    tiles = [canvas[:, :tile_w], canvas[:, width - tile_w :]]

    payloads = []
    for tile in tiles:
        ok, buffer = cv2.imencode(".jpg", tile, [cv2.IMWRITE_JPEG_QUALITY, 92])
        if not ok:
            raise RuntimeError("サンプル画像のエンコードに失敗しました")
        payloads.append(bytes(buffer.tobytes()))
    return payloads
