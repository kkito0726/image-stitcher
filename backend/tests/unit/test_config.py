import pytest

from src.config import Settings


class TestSettingsFromEnv:
    def test_合計画素数の上限を環境変数で指定できる(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("STITCH_MAX_TOTAL_PIXELS", "12345")

        assert Settings.from_env().max_total_pixels == 12345

    @pytest.mark.parametrize("raw", ["0", "-1"])
    def test_合計画素数の上限が1未満ならエラー(
        self, monkeypatch: pytest.MonkeyPatch, raw: str
    ) -> None:
        monkeypatch.setenv("STITCH_MAX_TOTAL_PIXELS", raw)

        with pytest.raises(ValueError, match="STITCH_MAX_TOTAL_PIXELS"):
            Settings.from_env()
