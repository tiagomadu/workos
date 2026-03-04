"""Tests for the Jinja2 prompt template renderer."""

import pytest

from app.ai.prompt_renderer import render_prompt


class TestSummarizeMeetingTemplate:
    def test_renders_with_transcript(self):
        result = render_prompt("summarize_meeting.j2", transcript="Alice: Hello\nBob: Hi")
        assert "Alice: Hello" in result
        assert "Bob: Hi" in result
        assert "TRANSCRIPT:" in result

    def test_includes_meeting_date_when_provided(self):
        result = render_prompt(
            "summarize_meeting.j2",
            transcript="Some transcript",
            meeting_date="2026-03-04",
        )
        assert "Meeting Date: 2026-03-04" in result

    def test_excludes_meeting_date_when_not_provided(self):
        result = render_prompt("summarize_meeting.j2", transcript="Some transcript")
        assert "Meeting Date:" not in result

    def test_includes_attendees_when_provided(self):
        result = render_prompt(
            "summarize_meeting.j2",
            transcript="Some transcript",
            attendees=["Alice", "Bob", "Carol"],
        )
        assert "Attendees: Alice, Bob, Carol" in result

    def test_excludes_attendees_when_not_provided(self):
        result = render_prompt("summarize_meeting.j2", transcript="Some transcript")
        assert "Attendees:" not in result


class TestExtractActionItemsTemplate:
    def test_renders_with_transcript(self):
        result = render_prompt(
            "extract_action_items.j2", transcript="Alice: I will do the report."
        )
        assert "Alice: I will do the report." in result
        assert "TRANSCRIPT:" in result

    def test_includes_summary_when_provided(self):
        result = render_prompt(
            "extract_action_items.j2",
            transcript="Some transcript",
            summary="Team discussed the roadmap.",
        )
        assert "MEETING SUMMARY (for context):" in result
        assert "Team discussed the roadmap." in result

    def test_excludes_summary_when_not_provided(self):
        result = render_prompt(
            "extract_action_items.j2", transcript="Some transcript"
        )
        assert "MEETING SUMMARY" not in result


class TestDetectMeetingTypeTemplate:
    def test_renders_with_transcript(self):
        result = render_prompt(
            "detect_meeting_type.j2",
            transcript="Alice: Let's go over the sprint status.",
        )
        assert "Alice: Let's go over the sprint status." in result
        assert "TRANSCRIPT (first 2000 characters):" in result

    def test_truncates_long_transcript(self):
        long_text = "A" * 5000
        result = render_prompt("detect_meeting_type.j2", transcript=long_text)
        # The template uses {{ transcript[:2000] }} so the rendered text
        # should contain 2000 A's, not 5000
        assert "A" * 2000 in result
        assert "A" * 2001 not in result


class TestNoHtmlEscaping:
    def test_special_characters_not_escaped(self):
        """Confirm autoescape=False: HTML-like chars pass through unescaped."""
        result = render_prompt(
            "summarize_meeting.j2",
            transcript='Alice said: "Q&A <done>" & Bob replied.',
        )
        # If autoescape were True, & would become &amp; and < would become &lt;
        assert "&amp;" not in result
        assert "&lt;" not in result
        assert '"Q&A <done>"' in result
