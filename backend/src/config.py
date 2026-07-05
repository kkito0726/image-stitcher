import os
from dataclasses import dataclass

_DEFAULT_MAX_IMAGES = 30
_DEFAULT_MAX_BODY_BYTES = 100 * 1024 * 1024
_DEFAULT_PORT = 5000


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    return int(raw) if raw is not None else default


@dataclass(frozen=True)
class Settings:
    max_images: int = _DEFAULT_MAX_IMAGES
    max_body_bytes: int = _DEFAULT_MAX_BODY_BYTES
    allowed_origins: tuple[str, ...] = (
        "http://localhost:3000",
        "http://image-stitcher-frontend",
    )
    port: int = _DEFAULT_PORT

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            max_images=_int_env("STITCH_MAX_IMAGES", _DEFAULT_MAX_IMAGES),
            max_body_bytes=_int_env("STITCH_MAX_BODY_BYTES", _DEFAULT_MAX_BODY_BYTES),
            port=_int_env("PORT", _DEFAULT_PORT),
        )
