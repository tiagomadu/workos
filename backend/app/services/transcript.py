"""Transcript format detection and normalisation."""

import re


def detect_format(text: str) -> str:
    """Detect transcript format from text content.

    Returns "macwhisper", "whisper_cli", or "plain".
    """
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        return "plain"

    total = len(lines)

    # MacWhisper: lines matching HH:MM:SS Speaker: text
    macwhisper_pattern = re.compile(r"^\d{2}:\d{2}:\d{2}\s+.+?:")
    macwhisper_count = sum(1 for line in lines if macwhisper_pattern.match(line))
    if macwhisper_count / total > 0.30:
        return "macwhisper"

    # Whisper CLI: lines matching [HH:MM:SS.mmm --> HH:MM:SS.mmm]
    whisper_cli_pattern = re.compile(
        r"^\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]"
    )
    whisper_cli_count = sum(1 for line in lines if whisper_cli_pattern.match(line))
    if whisper_cli_count / total > 0.30:
        return "whisper_cli"

    return "plain"


def normalise_transcript(text: str) -> str:
    """Detect format and normalise transcript text.

    - MacWhisper: Strip leading timestamps (HH:MM:SS), keep Speaker: text
    - Whisper CLI: Strip timestamp brackets, keep text
    - Plain: Return as-is (strip leading/trailing whitespace)
    - Always normalise line endings to \\n, strip trailing whitespace per line
    """
    # Normalise line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    fmt = detect_format(text)

    lines = text.splitlines()

    if fmt == "macwhisper":
        # Strip leading HH:MM:SS timestamp
        mac_re = re.compile(r"^\d{2}:\d{2}:\d{2}\s+")
        normalised = []
        for line in lines:
            stripped = mac_re.sub("", line).rstrip()
            normalised.append(stripped)
        return "\n".join(normalised)

    if fmt == "whisper_cli":
        # Strip [HH:MM:SS.mmm --> HH:MM:SS.mmm] prefix
        cli_re = re.compile(
            r"^\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]\s*"
        )
        normalised = []
        for line in lines:
            stripped = cli_re.sub("", line).rstrip()
            normalised.append(stripped)
        return "\n".join(normalised)

    # Plain: strip trailing whitespace per line
    return "\n".join(line.rstrip() for line in lines).strip()


def validate_transcript(text: str) -> tuple[bool, str]:
    """Validate transcript text.

    Returns (is_valid, error_message).
    """
    if not text or not text.strip():
        return False, "Transcript is empty"

    if len(text.encode("utf-8")) > 512000:
        return False, "Transcript exceeds 500KB limit"

    return True, ""
