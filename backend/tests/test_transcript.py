"""Unit tests for transcript format detection and normalisation."""

import os
import pytest

from app.services.transcript import detect_format, normalise_transcript, validate_transcript

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def _read_fixture(name: str) -> str:
    with open(os.path.join(FIXTURES_DIR, name), "r", encoding="utf-8") as f:
        return f.read()


class TestDetectFormat:
    """Tests for detect_format()."""

    def test_detect_plain(self) -> None:
        text = _read_fixture("sample_plain.txt")
        assert detect_format(text) == "plain"

    def test_detect_macwhisper(self) -> None:
        text = _read_fixture("sample_macwhisper.txt")
        assert detect_format(text) == "macwhisper"

    def test_detect_whisper_cli(self) -> None:
        text = _read_fixture("sample_whisper_cli.txt")
        assert detect_format(text) == "whisper_cli"

    def test_detect_empty_returns_plain(self) -> None:
        assert detect_format("") == "plain"

    def test_mixed_content_defaults_to_plain(self) -> None:
        text = (
            "Alice: Hello\n"
            "Bob: Hi\n"
            "00:00:05 Carol: Hey\n"
            "Regular line here\n"
            "Another plain line\n"
            "Yet another line\n"
            "More content\n"
            "Final line\n"
            "One more line\n"
            "Last line\n"
        )
        assert detect_format(text) == "plain"


class TestNormaliseTranscript:
    """Tests for normalise_transcript()."""

    def test_macwhisper_strips_timestamps_keeps_speakers(self) -> None:
        text = _read_fixture("sample_macwhisper.txt")
        result = normalise_transcript(text)
        lines = [line for line in result.splitlines() if line.strip()]
        # Should not have HH:MM:SS prefix
        for line in lines:
            assert not line[0].isdigit() or ":" not in line[:8]
        # Should keep Speaker: format
        assert lines[0].startswith("Alice:")
        assert lines[1].startswith("Bob:")

    def test_whisper_cli_strips_brackets_keeps_text(self) -> None:
        text = _read_fixture("sample_whisper_cli.txt")
        result = normalise_transcript(text)
        lines = [line for line in result.splitlines() if line.strip()]
        # Should not have [timestamp] brackets
        for line in lines:
            assert not line.startswith("[")
        # Should keep the actual text
        assert "Q4 roadmap" in lines[0]

    def test_plain_passthrough(self) -> None:
        text = _read_fixture("sample_plain.txt")
        result = normalise_transcript(text)
        # Plain text should pass through mostly unchanged
        assert "Alice:" in result
        assert "Q4 roadmap" in result

    def test_normalise_line_endings(self) -> None:
        text = "Line 1\r\nLine 2\rLine 3\nLine 4"
        result = normalise_transcript(text)
        assert "\r" not in result
        assert result.count("\n") == 3

    def test_strips_trailing_whitespace(self) -> None:
        text = "Alice: Hello   \nBob: Hi   \n"
        result = normalise_transcript(text)
        for line in result.splitlines():
            assert line == line.rstrip()


class TestValidateTranscript:
    """Tests for validate_transcript()."""

    def test_rejects_empty_text(self) -> None:
        is_valid, error = validate_transcript("")
        assert not is_valid
        assert error == "Transcript is empty"

    def test_rejects_whitespace_only(self) -> None:
        is_valid, error = validate_transcript("   \n  \n  ")
        assert not is_valid
        assert error == "Transcript is empty"

    def test_rejects_oversized_text(self) -> None:
        # Create text just over 512KB
        text = "x" * 512001
        is_valid, error = validate_transcript(text)
        assert not is_valid
        assert error == "Transcript exceeds 500KB limit"

    def test_accepts_valid_text(self) -> None:
        is_valid, error = validate_transcript("This is a valid transcript.")
        assert is_valid
        assert error == ""

    def test_accepts_text_at_size_limit(self) -> None:
        # Exactly at the 512000 byte limit
        text = "x" * 512000
        is_valid, error = validate_transcript(text)
        assert is_valid
        assert error == ""
