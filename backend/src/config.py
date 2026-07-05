import os
from dataclasses import dataclass

_DEFAULT_MAX_IMAGES = 30
_DEFAULT_MAX_BODY_BYTES = 100 * 1024 * 1024
_DEFAULT_PORT = 5000
_DEFAULT_PREVIEW_MAX_WIDTH = 1920
_DEFAULT_PREVIEW_QUALITY = 80
_DEFAULT_CACHE_TTL_SECONDS = 600
_DEFAULT_CACHE_MAX_ENTRIES = 4


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    return int(raw) if raw is not None else default


def _str_env(name: str) -> str | None:
    raw = os.environ.get(name)
    if raw is None:
        return None
    stripped = raw.strip()
    return stripped or None


@dataclass(frozen=True)
class Settings:
    max_images: int = _DEFAULT_MAX_IMAGES
    max_body_bytes: int = _DEFAULT_MAX_BODY_BYTES
    allowed_origins: tuple[str, ...] = (
        "http://localhost:3000",
        "http://image-stitcher-frontend",
    )
    port: int = _DEFAULT_PORT
    preview_max_width: int = _DEFAULT_PREVIEW_MAX_WIDTH
    preview_quality: int = _DEFAULT_PREVIEW_QUALITY
    cache_ttl_seconds: int = _DEFAULT_CACHE_TTL_SECONDS
    cache_max_entries: int = _DEFAULT_CACHE_MAX_ENTRIES
    # None の場合はフル解像度ダウンロードのパスワード保護を無効化する(ローカル開発の既定)
    download_password: str | None = None

    @classmethod
    def from_env(cls) -> "Settings":
        allowed = _str_env("ALLOWED_ORIGINS")
        origins = (
            tuple(o.strip() for o in allowed.split(",") if o.strip())
            if allowed is not None
            else cls.allowed_origins
        )
        return cls(
            max_images=_int_env("STITCH_MAX_IMAGES", _DEFAULT_MAX_IMAGES),
            max_body_bytes=_int_env("STITCH_MAX_BODY_BYTES", _DEFAULT_MAX_BODY_BYTES),
            allowed_origins=origins,
            port=_int_env("PORT", _DEFAULT_PORT),
            preview_max_width=_int_env("PREVIEW_MAX_WIDTH", _DEFAULT_PREVIEW_MAX_WIDTH),
            preview_quality=_int_env("PREVIEW_QUALITY", _DEFAULT_PREVIEW_QUALITY),
            cache_ttl_seconds=_int_env("RESULT_CACHE_TTL_SECONDS", _DEFAULT_CACHE_TTL_SECONDS),
            cache_max_entries=_int_env("RESULT_CACHE_MAX_ENTRIES", _DEFAULT_CACHE_MAX_ENTRIES),
            download_password=_str_env("DOWNLOAD_PASSWORD"),
        )
