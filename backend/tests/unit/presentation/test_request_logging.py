import re

from src.presentation.request_logging import (
    REDACTED,
    redact_headers,
    resolve_request_id,
    summarize_upload,
    truncate_user_agent,
)


class TestResolveRequestId:
    def test_英数字とハイフンの値は採用する(self) -> None:
        assert resolve_request_id("abc-123-DEF") == "abc-123-DEF"

    def test_ヘッダがなければ新しいIDを生成する(self) -> None:
        assert re.fullmatch(r"[0-9a-f]{32}", resolve_request_id(None))

    def test_長すぎる値や記号を含む値は採用しない(self) -> None:
        for bad in ["a" * 65, "abc def", 'x"\ninjected', ""]:
            generated = resolve_request_id(bad)
            assert generated != bad
            assert re.fullmatch(r"[0-9a-f]{32}", generated)


class TestRedactHeaders:
    def test_許可リスト外の値は伏せる(self) -> None:
        headers = [
            ("cookie", "session=secret"),
            ("authorization", "Bearer token"),
            ("x-real-ip", "203.0.113.5"),
            ("x-forwarded-for", "203.0.113.5"),
            ("cf-connecting-ip", "203.0.113.5"),
        ]

        redacted = redact_headers(headers)

        assert set(redacted.values()) == {REDACTED}

    def test_許可リストの値は出し名前の大文字小文字を区別しない(self) -> None:
        redacted = redact_headers([("USER-AGENT", "curl/8"), ("Content-Type", "text/plain")])

        assert redacted == {"USER-AGENT": "curl/8", "Content-Type": "text/plain"}

    def test_値は512文字で切り詰める(self) -> None:
        redacted = redact_headers([("accept", "a" * 1000)])

        assert len(redacted["accept"]) == 512

    def test_Refererはクエリとフラグメントを落とす(self) -> None:
        redacted = redact_headers([("referer", "https://example.com/crop?token=abc#x")])

        assert redacted["referer"] == "https://example.com/crop"


def test_user_agentは256文字で切り詰める() -> None:
    assert truncate_user_agent("u" * 300) == "u" * 256
    assert truncate_user_agent(None) is None


def test_アップロードの要約にファイル名そのものを含めない() -> None:
    summary = summarize_upload(
        field="images", filename="患者A_2026.JPG", content_type="image/jpeg", size=2048
    )

    assert summary == {
        "field": "images",
        "content_type": "image/jpeg",
        "size": 2048,
        "ext": ".jpg",
        "filename_len": len("患者A_2026.JPG"),
    }
