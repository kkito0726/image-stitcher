from collections.abc import Sequence

from fastapi.testclient import TestClient

from src.config import Settings
from src.domain.errors import ImageDecodeError
from src.domain.models import StitchFailureReason
from src.presentation.app import create_app
from src.usecase.stitch_images import StitchImagesOutput


class FakeStitchUseCase:
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


class FakeGetResultUseCase:
    def __init__(self, png: bytes | None = None):
        self._png = png
        self.received_id: str | None = None

    def execute(self, result_id: str) -> bytes | None:
        self.received_id = result_id
        return self._png


def _client(
    stitch_usecase: FakeStitchUseCase | None = None,
    get_result_usecase: FakeGetResultUseCase | None = None,
    settings: Settings | None = None,
    raise_server_exceptions: bool = True,
) -> TestClient:
    app = create_app(
        stitch_usecase=stitch_usecase or FakeStitchUseCase(output=SUCCESS_OUTPUT),
        get_result_usecase=get_result_usecase or FakeGetResultUseCase(png=b"full-png"),
        settings=settings or Settings(),
        warmup=None,
    )
    return TestClient(app, raise_server_exceptions=raise_server_exceptions)


def _files(count: int, size: int = 10) -> list[tuple[str, tuple[str, bytes, str]]]:
    return [("images", (f"img{i}.jpg", b"x" * size, "image/jpeg")) for i in range(count)]


SUCCESS_OUTPUT = StitchImagesOutput(preview_jpeg=b"preview-jpeg", result_id="rid-123", failure=None)


class TestStitchEndpoint:
    def test_成功時はプレビューjpegとresult_idヘッダーを返す(self) -> None:
        usecase = FakeStitchUseCase(output=SUCCESS_OUTPUT)
        res = _client(usecase).post("/stitch", data={"mode": "Scans"}, files=_files(2))

        assert res.status_code == 200
        assert res.headers["content-type"] == "image/jpeg"
        assert res.headers["x-result-id"] == "rid-123"
        assert res.content == b"preview-jpeg"
        assert usecase.received_mode == "Scans"
        assert usecase.received_images is not None
        assert len(usecase.received_images) == 2

    def test_合成失敗時は422とreasonを返す(self) -> None:
        output = StitchImagesOutput(
            preview_jpeg=None, result_id=None, failure=StitchFailureReason.NEED_MORE_IMAGES
        )
        res = _client(FakeStitchUseCase(output=output)).post(
            "/stitch", data={"mode": "Scans"}, files=_files(2)
        )

        assert res.status_code == 422
        assert res.json() == {"isStitched": 1, "reason": "need_more_images"}

    def test_modeがないと400(self) -> None:
        res = _client().post("/stitch", files=_files(2))
        assert res.status_code == 400
        assert "error" in res.json()

    def test_画像がないと400(self) -> None:
        res = _client().post("/stitch", data={"mode": "Scans"})
        assert res.status_code == 400
        assert "error" in res.json()

    def test_枚数上限を超えると400(self) -> None:
        usecase = FakeStitchUseCase(output=SUCCESS_OUTPUT)
        res = _client(usecase, settings=Settings(max_images=3)).post(
            "/stitch", data={"mode": "Scans"}, files=_files(4)
        )

        assert res.status_code == 400
        assert usecase.received_images is None  # usecase まで到達しない

    def test_ボディサイズ上限を超えると400(self) -> None:
        usecase = FakeStitchUseCase(output=SUCCESS_OUTPUT)
        res = _client(usecase, settings=Settings(max_body_bytes=100)).post(
            "/stitch", data={"mode": "Scans"}, files=_files(2, size=60)
        )

        assert res.status_code == 400
        assert usecase.received_images is None

    def test_デコードできない画像は400(self) -> None:
        usecase = FakeStitchUseCase(error=ImageDecodeError("画像データをデコードできませんでした"))
        res = _client(usecase).post("/stitch", data={"mode": "Scans"}, files=_files(2))

        assert res.status_code == 400
        assert "error" in res.json()

    def test_予期しない例外は500で詳細を漏らさない(self) -> None:
        usecase = FakeStitchUseCase(error=RuntimeError("秘密の内部情報"))
        res = _client(usecase, raise_server_exceptions=False).post(
            "/stitch", data={"mode": "Scans"}, files=_files(2)
        )

        assert res.status_code == 500
        assert res.json() == {"error": "internal server error"}
        assert "秘密" not in res.text


class TestDownloadEndpoint:
    def test_存在する結果はフルpngを返す(self) -> None:
        get_uc = FakeGetResultUseCase(png=b"full-png")
        res = _client(get_result_usecase=get_uc).get("/stitch/rid-123/download")

        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"
        assert res.content == b"full-png"
        assert get_uc.received_id == "rid-123"

    def test_存在しない結果は404(self) -> None:
        res = _client(get_result_usecase=FakeGetResultUseCase(png=None)).get(
            "/stitch/nope/download"
        )
        assert res.status_code == 404
        assert "error" in res.json()

    def test_パスワード未設定時はヘッダーなしでダウンロードできる(self) -> None:
        res = _client(
            get_result_usecase=FakeGetResultUseCase(png=b"full-png"), settings=Settings()
        ).get("/stitch/rid/download")
        assert res.status_code == 200

    def test_パスワード設定時に正しいパスワードなら成功(self) -> None:
        get_uc = FakeGetResultUseCase(png=b"full-png")
        res = _client(get_result_usecase=get_uc, settings=Settings(download_password="s3cret")).get(
            "/stitch/rid/download", headers={"X-Download-Password": "s3cret"}
        )
        assert res.status_code == 200
        assert res.content == b"full-png"

    def test_パスワード設定時にヘッダーなしは401(self) -> None:
        get_uc = FakeGetResultUseCase(png=b"full-png")
        res = _client(get_result_usecase=get_uc, settings=Settings(download_password="s3cret")).get(
            "/stitch/rid/download"
        )
        assert res.status_code == 401
        assert get_uc.received_id is None  # 検証失敗時はキャッシュに触れない

    def test_パスワード設定時に誤ったパスワードは401(self) -> None:
        get_uc = FakeGetResultUseCase(png=b"full-png")
        res = _client(get_result_usecase=get_uc, settings=Settings(download_password="s3cret")).get(
            "/stitch/rid/download", headers={"X-Download-Password": "wrong"}
        )
        assert res.status_code == 401
        assert get_uc.received_id is None


class TestHealthEndpoints:
    def test_health(self) -> None:
        res = _client().get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "healthy"}

    def test_ルートは互換のためserver文字列を返す(self) -> None:
        res = _client().get("/")
        assert res.status_code == 200
        assert res.text == "Server!"

    def test_corsはresult_idヘッダーを公開する(self) -> None:
        res = _client().get("/health", headers={"Origin": "http://localhost:3000"})
        assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"
        assert "x-result-id" in res.headers.get("access-control-expose-headers", "").lower()
