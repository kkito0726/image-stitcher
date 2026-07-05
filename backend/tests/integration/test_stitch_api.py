"""実際の OpenCV 実装を組み込んだ API の統合テスト。"""

import cv2
import numpy as np
from fastapi.testclient import TestClient

from src.config import Settings
from src.infra.opencv.cv_codec import CvImageCodec
from src.infra.opencv.cv_stitcher import CvImageStitcher
from src.infra.opencv.sample_images import make_overlapping_tiles
from src.presentation.app import create_app
from src.usecase.stitch_images import StitchImagesUseCase


def _real_client() -> TestClient:
    usecase = StitchImagesUseCase(codec=CvImageCodec(), stitcher=CvImageStitcher())
    app = create_app(usecase=usecase, settings=Settings(), warmup=None)
    return TestClient(app)


def _as_files(payloads: list[bytes]) -> list[tuple[str, tuple[str, bytes, str]]]:
    return [("images", (f"tile{i}.jpg", data, "image/jpeg")) for i, data in enumerate(payloads)]


class TestStitchIntegration:
    def test_重なりのあるタイルを合成してpngが返る(self) -> None:
        tiles = make_overlapping_tiles()
        res = _real_client().post("/stitch", data={"mode": "Scans"}, files=_as_files(tiles))

        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"
        # 返却された PNG がデコード可能であること
        mat = cv2.imdecode(np.frombuffer(res.content, dtype=np.uint8), cv2.IMREAD_COLOR)
        assert mat is not None
        assert mat.shape[1] > 0 and mat.shape[0] > 0

    def test_特徴点のない画像は422(self) -> None:
        flat = np.full((120, 160, 3), 128, dtype=np.uint8)
        ok, buffer = cv2.imencode(".png", flat)
        assert ok
        payload = bytes(buffer.tobytes())

        res = _real_client().post(
            "/stitch", data={"mode": "Scans"}, files=_as_files([payload, payload])
        )

        assert res.status_code == 422
        body = res.json()
        assert body["isStitched"] == 1
        assert body["reason"] == "need_more_images"

    def test_画像でないファイルは400(self) -> None:
        res = _real_client().post(
            "/stitch", data={"mode": "Scans"}, files=_as_files([b"not-an-image", b"also-not"])
        )
        assert res.status_code == 400
        assert "error" in res.json()

    def test_warmupを指定するとlifespanで実行される(self) -> None:
        calls: list[bool] = []
        usecase = StitchImagesUseCase(codec=CvImageCodec(), stitcher=CvImageStitcher())
        app = create_app(usecase=usecase, settings=Settings(), warmup=lambda: calls.append(True))

        with TestClient(app) as client:
            assert client.get("/health").status_code == 200
        assert calls == [True]
