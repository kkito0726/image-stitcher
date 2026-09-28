"""リクエストのログ出力 (request.completed / request.failed) の結合テスト。"""

import json
from collections.abc import Sequence
from typing import Any

import structlog
from fastapi.testclient import TestClient

from src.config import Settings
from src.domain.errors import ImageDecodeError, ImageTooLargeError
from src.domain.models import DownloadFormat, StitchFailureReason
from src.presentation.app import create_app
from src.usecase.stitch_images import StitchImagesOutput

_log = structlog.get_logger("tests.fake_usecase")

SUCCESS = StitchImagesOutput(preview_jpeg=b"preview", result_id="0" * 32, failure=None)


class FakeStitchUseCase:
    def __init__(self, output: StitchImagesOutput = SUCCESS, error: Exception | None = None):
        self._output = output
        self._error = error

    def execute(self, image_files: Sequence[bytes], mode_label: str) -> StitchImagesOutput:
        # 実際のユースケースと同じくスレッドプールからログを出す
        _log.info("stitch.completed")
        if self._error is not None:
            raise self._error
        return self._output


class FakeGetResultUseCase:
    def __init__(self, image: bytes | None = b"full") -> None:
        self._image = image

    def execute(self, result_id: str, fmt: DownloadFormat = DownloadFormat.JPEG) -> bytes | None:
        return self._image


def _client(
    stitch: FakeStitchUseCase | None = None,
    get_result: FakeGetResultUseCase | None = None,
    settings: Settings | None = None,
) -> TestClient:
    app = create_app(
        stitch_usecase=stitch or FakeStitchUseCase(),
        get_result_usecase=get_result or FakeGetResultUseCase(),
        settings=settings or Settings(),
        warmup=None,
    )
    return TestClient(app, raise_server_exceptions=False)


def _files(count: int, name: str = "患者A_001.JPG") -> list[tuple[str, tuple[str, bytes, str]]]:
    return [("images", (name, b"x" * 10, "image/jpeg")) for _ in range(count)]


def _events(entries: list[dict[str, Any]], name: str) -> list[dict[str, Any]]:
    return [e for e in entries if e["event"] == name]


def _completed(entries: list[dict[str, Any]]) -> dict[str, Any]:
    [event] = _events(entries, "request.completed")
    return event


class TestRequestCompleted:
    def test_完了時はステータスと所要時間を出す(self, log_events: list[dict[str, Any]]) -> None:
        res = _client().post(
            "/stitch",
            data={"mode": "Scans"},
            files=_files(2),
            headers={"User-Agent": "pytest-agent"},
        )

        assert res.status_code == 200
        event = _completed(log_events)
        assert event["log_level"] == "info"
        assert event["method"] == "POST"
        assert event["path"] == "/stitch"
        assert event["status"] == 200
        assert event["user_agent"] == "pytest-agent"
        assert isinstance(event["duration_ms"], int)
        assert "reason" not in event

    def test_スレッドプール内のログにも同じrequest_idが付きレスポンスヘッダと一致する(
        self, log_events: list[dict[str, Any]]
    ) -> None:
        res = _client().post("/stitch", data={"mode": "Scans"}, files=_files(2))

        request_id = res.headers["x-request-id"]
        [stitched] = _events(log_events, "stitch.completed")
        assert stitched["request_id"] == request_id
        assert _completed(log_events)["request_id"] == request_id

    def test_妥当なX_Request_IDは引き継ぎ不正な値は作り直す(
        self, log_events: list[dict[str, Any]]
    ) -> None:
        client = _client()

        assert (
            client.get("/", headers={"X-Request-ID": "nginx-abc123"}).headers["x-request-id"]
            == "nginx-abc123"
        )
        assert (
            client.get("/", headers={"X-Request-ID": 'bad"id'}).headers["x-request-id"] != 'bad"id'
        )

    def test_healthはログに出さない(self, log_events: list[dict[str, Any]]) -> None:
        _client().get("/health")

        assert _events(log_events, "request.completed") == []

    def test_ダウンロードのpathは結果IDを含まないテンプレートにする(
        self, log_events: list[dict[str, Any]]
    ) -> None:
        result_id = "a" * 32
        _client().get(f"/stitch/{result_id}/download")

        event = _completed(log_events)
        assert event["path"] == "/stitch/{result_id}/download"
        assert result_id not in json.dumps(event)

    def test_存在しないパスは長さを切り詰めて出す(self, log_events: list[dict[str, Any]]) -> None:
        _client().get("/" + "z" * 500)

        event = _completed(log_events)
        assert event["status"] == 404
        assert len(event["path"]) <= 128


class TestRequestReceived:
    def test_到着時にヘッダを伏せてリクエストの内容を出す(
        self, log_events: list[dict[str, Any]]
    ) -> None:
        _client().get(
            "/stitch/x/download?format=png",
            headers={
                "User-Agent": "pytest-agent",
                "Cookie": "session=secret",
                "X-Real-IP": "203.0.113.5",
            },
        )

        [received] = _events(log_events, "request.received")
        assert received["log_level"] == "info"
        assert received["method"] == "GET"
        assert received["path"] == "/stitch/{result_id}/download"
        assert received["query"] == "format=png"
        assert received["user_agent"] == "pytest-agent"
        assert received["headers"]["cookie"] == "[REDACTED]"
        text = json.dumps(received)
        assert "secret" not in text
        assert "203.0.113.5" not in text

    def test_到着のログは完了より先に出て同じrequest_idを持つ(
        self, log_events: list[dict[str, Any]]
    ) -> None:
        _client().post("/stitch", data={"mode": "Scans"}, files=_files(2))

        names = [e["event"] for e in log_events]
        assert names.index("request.received") < names.index("request.completed")
        request_ids = {e["request_id"] for e in log_events}
        assert len(request_ids) == 1

    def test_合成はデコード前にモードと画像の情報を出しファイル名は出さない(
        self, log_events: list[dict[str, Any]]
    ) -> None:
        _client().post("/stitch", data={"mode": "Scans"}, files=_files(2))

        [received] = _events(log_events, "stitch.received")
        assert received["mode"] == "Scans"
        assert received["image_count"] == 2
        assert received["upload_bytes"] == 20
        assert received["files"][0] == {
            "field": "images",
            "content_type": "image/jpeg",
            "size": 10,
            "ext": ".jpg",
            "filename_len": len("患者A_001.JPG"),
        }
        assert "患者A" not in json.dumps(received, ensure_ascii=False)
        names = [e["event"] for e in log_events]
        assert names.index("stitch.received") < names.index("stitch.completed")

    def test_healthは到着時も出さない(self, log_events: list[dict[str, Any]]) -> None:
        _client().get("/health")

        assert log_events == []


class TestRequestErrors:
    def test_400はwarningでreasonが付く(self, log_events: list[dict[str, Any]]) -> None:
        res = _client(settings=Settings(max_images=1)).post(
            "/stitch", data={"mode": "Scans"}, files=_files(2)
        )

        assert res.status_code == 400
        event = _completed(log_events)
        assert event["log_level"] == "warning"
        assert event["reason"] == "too_many_images"

    def test_必須項目の欠落はinvalid_params(self, log_events: list[dict[str, Any]]) -> None:
        _client().post("/stitch", data={"mode": "Scans"})

        assert _completed(log_events)["reason"] == "invalid_params"

    def test_デコード不可と画素数超過を区別する(self, log_events: list[dict[str, Any]]) -> None:
        _client(FakeStitchUseCase(error=ImageDecodeError("x"))).post(
            "/stitch", data={"mode": "Scans"}, files=_files(2)
        )
        _client(FakeStitchUseCase(error=ImageTooLargeError("x"))).post(
            "/stitch", data={"mode": "Scans"}, files=_files(2)
        )

        reasons = [e["reason"] for e in _events(log_events, "request.completed")]
        assert reasons == ["invalid_image", "image_too_large"]

    def test_合成できない422は失敗理由をreasonにする(
        self, log_events: list[dict[str, Any]]
    ) -> None:
        failed = StitchImagesOutput(
            preview_jpeg=None, result_id=None, failure=StitchFailureReason.NEED_MORE_IMAGES
        )
        res = _client(FakeStitchUseCase(output=failed)).post(
            "/stitch", data={"mode": "Scans"}, files=_files(2)
        )

        assert res.status_code == 422
        event = _completed(log_events)
        assert event["log_level"] == "warning"
        assert event["reason"] == "need_more_images"

    def test_結果がなければresult_not_found(self, log_events: list[dict[str, Any]]) -> None:
        _client(get_result=FakeGetResultUseCase(image=None)).get("/stitch/x/download")

        assert _completed(log_events)["reason"] == "result_not_found"

    def test_予期しない例外はrequest_failedと500を出し詳細を返さない(
        self, log_events: list[dict[str, Any]]
    ) -> None:
        res = _client(FakeStitchUseCase(error=RuntimeError("秘密の内部情報"))).post(
            "/stitch", data={"mode": "Scans"}, files=_files(2)
        )

        assert res.status_code == 500
        assert res.json() == {"error": "internal server error"}
        assert "x-request-id" in res.headers
        [failed] = _events(log_events, "request.failed")
        assert failed["log_level"] == "error"
        assert failed["exc_info"] is True or isinstance(failed["exc_info"], BaseException)
        event = _completed(log_events)
        assert event["log_level"] == "error"
        assert event["status"] == 500
        assert event["reason"] == "internal_error"


class TestResultIdNeverLogged:
    def test_ルートに当たらない末尾スラッシュ付きでも結果IDを出さない(
        self, log_events: list[dict[str, Any]]
    ) -> None:
        result_id = "b" * 32
        _client().get(f"/stitch/{result_id}/download/", follow_redirects=False)

        assert result_id not in json.dumps(log_events)

    def test_CORSプリフライトは記録せず結果IDも出さない(
        self, log_events: list[dict[str, Any]]
    ) -> None:
        result_id = "c" * 32
        _client().options(
            f"/stitch/{result_id}/download",
            headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
        )

        assert result_id not in json.dumps(log_events)

    def test_X_Request_IDをフロントエンドから読めるよう公開する(self) -> None:
        res = _client().get("/", headers={"Origin": "http://localhost:3000"})

        assert "x-request-id" in res.headers.get("access-control-expose-headers", "").lower()

    def test_500にもCORSヘッダが付く(self) -> None:
        res = _client(FakeStitchUseCase(error=RuntimeError("x"))).post(
            "/stitch",
            data={"mode": "Scans"},
            files=_files(2),
            headers={"Origin": "http://localhost:3000"},
        )

        assert res.status_code == 500
        assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"
