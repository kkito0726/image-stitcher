from collections.abc import Sequence

from fastapi.testclient import TestClient

from src.config import Settings
from src.domain.errors import ImageDecodeError
from src.domain.models import StitchFailureReason
from src.presentation.app import create_app
from src.usecase.stitch_images import StitchImagesOutput


class FakeUseCase:
    """presentation 層のテスト用。usecase と同じ execute シグネチャを持つ。"""

    def __init__(self, output: StitchImagesOutput | None = None, error: Exception | None = None):
        self._output = output
        self._error = error
        self.received_images: Sequence[bytes] | None = None
        self.received_mode: str | None = None

    def execute(self, image_files: Sequence[bytes], mode_label: str) -> StitchImagesOutput:
        self.received_images = image_files
        self.received_mode = mode_label
        if self._error is not None:
            raise self._error
        assert self._output is not None
        return self._output


def _client(
    usecase: FakeUseCase, settings: Settings | None = None, raise_server_exceptions: bool = True
) -> TestClient:
    app = create_app(
        usecase=usecase,
        settings=settings or Settings(),
        warmup=None,
    )
    return TestClient(app, raise_server_exceptions=raise_server_exceptions)


def _files(count: int, size: int = 10) -> list[tuple[str, tuple[str, bytes, str]]]:
    return [("images", (f"img{i}.png", b"x" * size, "image/png")) for i in range(count)]


SUCCESS_OUTPUT = StitchImagesOutput(png=b"fake-png", failure=None)


class TestStitchEndpoint:
    def test_成功時はpngバイナリを返す(self) -> None:
        usecase = FakeUseCase(output=SUCCESS_OUTPUT)
        res = _client(usecase).post("/stitch", data={"mode": "Scans"}, files=_files(2))

        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"
        assert res.content == b"fake-png"
        assert usecase.received_mode == "Scans"
        assert usecase.received_images is not None
        assert len(usecase.received_images) == 2

    def test_合成失敗時は422とreasonを返す(self) -> None:
        usecase = FakeUseCase(
            output=StitchImagesOutput(png=None, failure=StitchFailureReason.NEED_MORE_IMAGES)
        )
        res = _client(usecase).post("/stitch", data={"mode": "Scans"}, files=_files(2))

        assert res.status_code == 422
        assert res.json() == {"isStitched": 1, "reason": "need_more_images"}

    def test_modeがないと400(self) -> None:
        res = _client(FakeUseCase(output=SUCCESS_OUTPUT)).post("/stitch", files=_files(2))
        assert res.status_code == 400
        assert "error" in res.json()

    def test_画像がないと400(self) -> None:
        res = _client(FakeUseCase(output=SUCCESS_OUTPUT)).post("/stitch", data={"mode": "Scans"})
        assert res.status_code == 400
        assert "error" in res.json()

    def test_枚数上限を超えると400(self) -> None:
        settings = Settings(max_images=3)
        usecase = FakeUseCase(output=SUCCESS_OUTPUT)
        res = _client(usecase, settings).post("/stitch", data={"mode": "Scans"}, files=_files(4))

        assert res.status_code == 400
        assert "error" in res.json()
        assert usecase.received_images is None  # usecase まで到達しない

    def test_ボディサイズ上限を超えると400(self) -> None:
        settings = Settings(max_body_bytes=100)
        usecase = FakeUseCase(output=SUCCESS_OUTPUT)
        res = _client(usecase, settings).post(
            "/stitch", data={"mode": "Scans"}, files=_files(2, size=60)
        )

        assert res.status_code == 400
        assert "error" in res.json()
        assert usecase.received_images is None

    def test_デコードできない画像は400(self) -> None:
        usecase = FakeUseCase(error=ImageDecodeError("画像データをデコードできませんでした"))
        res = _client(usecase).post("/stitch", data={"mode": "Scans"}, files=_files(2))

        assert res.status_code == 400
        assert "error" in res.json()

    def test_予期しない例外は500で詳細を漏らさない(self) -> None:
        usecase = FakeUseCase(error=RuntimeError("秘密の内部情報"))
        res = _client(usecase, raise_server_exceptions=False).post(
            "/stitch", data={"mode": "Scans"}, files=_files(2)
        )

        assert res.status_code == 500
        assert res.json() == {"error": "internal server error"}
        assert "秘密" not in res.text


class TestHealthEndpoints:
    def test_health(self) -> None:
        res = _client(FakeUseCase(output=SUCCESS_OUTPUT)).get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "healthy"}

    def test_ルートは互換のためserver文字列を返す(self) -> None:
        res = _client(FakeUseCase(output=SUCCESS_OUTPUT)).get("/")
        assert res.status_code == 200
        assert res.text == "Server!"

    def test_corsヘッダが許可オリジンに付与される(self) -> None:
        res = _client(FakeUseCase(output=SUCCESS_OUTPUT)).get(
            "/health", headers={"Origin": "http://localhost:3000"}
        )
        assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"
