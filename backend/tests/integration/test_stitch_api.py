"""実際の OpenCV 実装とキャッシュを組み込んだ API の統合テスト。"""

import time

import cv2
import numpy as np
from fastapi.testclient import TestClient

from src.config import Settings
from src.infra.cache.in_memory_result_cache import InMemoryResultCache
from src.infra.opencv.cv_codec import CvImageCodec
from src.infra.opencv.cv_stitcher import CvImageStitcher
from src.infra.opencv.sample_images import make_overlapping_tiles
from src.presentation.app import create_app
from src.usecase.get_stitch_result import GetStitchResultUseCase
from src.usecase.stitch_images import StitchImagesUseCase


def _real_client(settings: Settings | None = None) -> TestClient:
    settings = settings or Settings()
    codec = CvImageCodec()
    cache = InMemoryResultCache(
        ttl_seconds=settings.cache_ttl_seconds,
        max_entries=settings.cache_max_entries,
        clock=time.monotonic,
    )
    stitch_usecase = StitchImagesUseCase(
        codec=codec,
        stitcher=CvImageStitcher(),
        cache=cache,
        preview_max_width=settings.preview_max_width,
        preview_quality=settings.preview_quality,
    )
    get_result_usecase = GetStitchResultUseCase(codec=codec, cache=cache)
    app = create_app(
        stitch_usecase=stitch_usecase,
        get_result_usecase=get_result_usecase,
        settings=settings,
        warmup=None,
    )
    return TestClient(app)


def _as_files(payloads: list[bytes]) -> list[tuple[str, tuple[str, bytes, str]]]:
    return [("images", (f"tile{i}.jpg", data, "image/jpeg")) for i, data in enumerate(payloads)]


def _decode(content: bytes) -> np.ndarray:
    mat = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)
    assert mat is not None
    return mat


class TestStitchAndDownloadIntegration:
    def test_合成でプレビューが返りダウンロードでフル解像度が取れる(self) -> None:
        # サンプル合成結果(約1200px)より小さい上限にして縮小経路を必ず通す
        client = _real_client(Settings(preview_max_width=600))
        tiles = make_overlapping_tiles()
        res = client.post("/stitch", data={"mode": "Scans"}, files=_as_files(tiles))

        assert res.status_code == 200
        assert res.headers["content-type"] == "image/jpeg"
        result_id = res.headers["x-result-id"]
        preview = _decode(res.content)
        assert preview.shape[1] == 600  # プレビューは上限まで縮小されている

        dl = client.get(f"/stitch/{result_id}/download")
        assert dl.status_code == 200
        assert dl.headers["content-type"] == "image/png"
        full = _decode(dl.content)
        # フル解像度はプレビューより大きく、PNG はプレビュー JPEG より重い
        assert full.shape[1] > preview.shape[1]
        assert len(dl.content) > len(res.content)

    def test_特徴点のない画像は422(self) -> None:
        flat = np.full((120, 160, 3), 128, dtype=np.uint8)
        ok, buffer = cv2.imencode(".png", flat)
        assert ok
        payload = bytes(buffer.tobytes())

        res = _real_client().post(
            "/stitch", data={"mode": "Scans"}, files=_as_files([payload, payload])
        )

        assert res.status_code == 422
        assert res.json() == {"isStitched": 1, "reason": "need_more_images"}

    def test_画像でないファイルは400(self) -> None:
        res = _real_client().post(
            "/stitch", data={"mode": "Scans"}, files=_as_files([b"not-an-image", b"also-not"])
        )
        assert res.status_code == 400
        assert "error" in res.json()

    def test_存在しない結果idは404(self) -> None:
        res = _real_client().get("/stitch/unknown-id/download")
        assert res.status_code == 404

    def test_パスワード保護下では正しいパスワードでのみダウンロードできる(self) -> None:
        client = _real_client(Settings(download_password="s3cret"))
        tiles = make_overlapping_tiles()
        res = client.post("/stitch", data={"mode": "Scans"}, files=_as_files(tiles))
        result_id = res.headers["x-result-id"]

        assert client.get(f"/stitch/{result_id}/download").status_code == 401
        ok = client.get(
            f"/stitch/{result_id}/download", headers={"X-Download-Password": "s3cret"}
        )
        assert ok.status_code == 200
        assert ok.headers["content-type"] == "image/png"

    def test_warmupを指定するとlifespanで実行される(self) -> None:
        calls: list[bool] = []
        settings = Settings()
        codec = CvImageCodec()
        cache = InMemoryResultCache(ttl_seconds=600, max_entries=4, clock=time.monotonic)
        stitch_usecase = StitchImagesUseCase(
            codec=codec,
            stitcher=CvImageStitcher(),
            cache=cache,
            preview_max_width=settings.preview_max_width,
            preview_quality=settings.preview_quality,
        )
        app = create_app(
            stitch_usecase=stitch_usecase,
            get_result_usecase=GetStitchResultUseCase(codec=codec, cache=cache),
            settings=settings,
            warmup=lambda: calls.append(True),
        )

        with TestClient(app) as client:
            assert client.get("/health").status_code == 200
        assert calls == [True]
