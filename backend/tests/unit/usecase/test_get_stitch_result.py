from src.domain.models import DecodedImage, DownloadFormat
from src.usecase.get_stitch_result import GetStitchResultUseCase


class FakeImage:
    def __init__(self, name: str) -> None:
        self.name = name

    @property
    def width(self) -> int:
        return 1

    @property
    def height(self) -> int:
        return 1


class FakeCodec:
    def decode(self, data: bytes) -> DecodedImage:  # pragma: no cover - 未使用
        raise NotImplementedError

    def encode_png(self, image: DecodedImage) -> bytes:
        return b"png:" + getattr(image, "name", "?").encode()

    def encode_jpeg(self, image: DecodedImage, quality: int) -> bytes:
        return f"jpeg{quality}:".encode() + getattr(image, "name", "?").encode()

    def encode_preview_jpeg(  # pragma: no cover - 未使用
        self, image: DecodedImage, max_width: int, quality: int
    ) -> bytes:
        raise NotImplementedError


class FakeCache:
    def __init__(self, entries: dict[str, DecodedImage]) -> None:
        self._entries = entries

    def put(self, image: DecodedImage) -> str:  # pragma: no cover - 未使用
        raise NotImplementedError

    def get(self, result_id: str) -> DecodedImage | None:
        return self._entries.get(result_id)


class TestGetStitchResultUseCase:
    def _usecase(self, entries: dict[str, DecodedImage]) -> GetStitchResultUseCase:
        return GetStitchResultUseCase(codec=FakeCodec(), cache=FakeCache(entries), jpeg_quality=95)

    def test_形式指定なしは設定画質のフルjpegで返す(self) -> None:
        usecase = self._usecase({"abc": FakeImage("full")})

        assert usecase.execute("abc") == b"jpeg95:full"

    def test_png指定ならフルpngで返す(self) -> None:
        usecase = self._usecase({"abc": FakeImage("full")})

        assert usecase.execute("abc", DownloadFormat.PNG) == b"png:full"

    def test_存在しない結果はNoneを返す(self) -> None:
        usecase = self._usecase({})

        assert usecase.execute("missing") is None
