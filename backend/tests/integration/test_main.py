"""Composition Root (src/main.py) の統合テスト。

環境変数から読んだ設定が実際の依存に渡り、起動時のウォームアップが動くことを確認する。
"""

from collections.abc import Sequence
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.domain.models import StitchFailureReason
from src.infra.opencv.sample_images import make_overlapping_tiles
from src.main import _warmup, create_application
from src.usecase.stitch_images import StitchImagesOutput


def _as_files(payloads: list[bytes]) -> list[tuple[str, tuple[str, bytes, str]]]:
    return [("images", (f"tile{i}.jpg", data, "image/jpeg")) for i, data in enumerate(payloads)]


class TestCreateApplication:
    def test_起動時にウォームアップしてから合成とダウンロードができる(
        self, log_events: list[dict[str, Any]]
    ) -> None:
        with TestClient(create_application()) as client:
            [warmup] = [e for e in log_events if e["event"] == "warmup.completed"]
            assert isinstance(warmup["duration_ms"], int)
            assert client.get("/health").status_code == 200

            res = client.post(
                "/stitch", data={"mode": "Scans"}, files=_as_files(make_overlapping_tiles())
            )
            assert res.status_code == 200
            download = client.get(f"/stitch/{res.headers['x-result-id']}/download")
            assert download.status_code == 200

    def test_枚数の上限を環境変数で変えられる(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("STITCH_MAX_IMAGES", "1")
        client = TestClient(create_application())

        res = client.post(
            "/stitch", data={"mode": "Scans"}, files=_as_files(make_overlapping_tiles())
        )

        assert res.status_code == 400
        assert "最大 1 枚" in res.json()["error"]

    def test_合計画素数の上限を環境変数で変えられる(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("STITCH_MAX_TOTAL_PIXELS", "1000")
        client = TestClient(create_application())

        res = client.post(
            "/stitch", data={"mode": "Scans"}, files=_as_files(make_overlapping_tiles())
        )

        assert res.status_code == 400
        assert "画素" in res.json()["error"]


class _FailingStitchUseCase:
    def execute(self, image_files: Sequence[bytes], mode_label: str) -> StitchImagesOutput:
        return StitchImagesOutput(
            preview_jpeg=None, result_id=None, failure=StitchFailureReason.NEED_MORE_IMAGES
        )


def test_ウォームアップの合成が失敗しても起動を止めず警告を残す(
    log_events: list[dict[str, Any]],
) -> None:
    _warmup(_FailingStitchUseCase())  # type: ignore[arg-type]

    [event] = [e for e in log_events if e["event"] == "warmup.failed"]
    assert event["log_level"] == "warning"
    assert event["failure"] == "need_more_images"
