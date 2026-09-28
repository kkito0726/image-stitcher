import logging

import pytest

from src.infra.logging_config import LogFormat, LogSettings, build_logging_dict


class TestLogSettingsFromEnv:
    def test_既定はINFOとjson(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("LOG_LEVEL", raising=False)
        monkeypatch.delenv("LOG_FORMAT", raising=False)

        settings = LogSettings.from_env()

        assert settings.level == logging.INFO
        assert settings.format is LogFormat.JSON

    def test_大文字小文字を区別せずに読む(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("LOG_LEVEL", "debug")
        monkeypatch.setenv("LOG_FORMAT", "Console")

        settings = LogSettings.from_env()

        assert settings.level == logging.DEBUG
        assert settings.format is LogFormat.CONSOLE

    @pytest.mark.parametrize(("name", "value"), [("LOG_LEVEL", "VERBOSE"), ("LOG_FORMAT", "xml")])
    def test_不正な値は起動時にエラー(
        self, monkeypatch: pytest.MonkeyPatch, name: str, value: str
    ) -> None:
        monkeypatch.setenv(name, value)

        with pytest.raises(ValueError, match=name):
            LogSettings.from_env()


class TestBuildLoggingDict:
    def test_アクセスログのロガーは止める(self) -> None:
        # uvicorn のアクセスログは接続元 IP を含む。request.completed で代替する
        config = build_logging_dict(LogSettings(level=logging.INFO, format=LogFormat.JSON))

        for name in ("gunicorn.access", "uvicorn.access"):
            assert config["loggers"][name]["level"] == "WARNING"

    def test_gunicornのエラーロガーは直接ハンドラを持つ(self) -> None:
        # UvicornWorker は gunicorn.error のハンドラを uvicorn.error にコピーし伝播を止めるため
        config = build_logging_dict(LogSettings(level=logging.INFO, format=LogFormat.JSON))

        assert config["loggers"]["gunicorn.error"]["handlers"] == ["default"]
        assert config["loggers"]["gunicorn.error"]["propagate"] is False
