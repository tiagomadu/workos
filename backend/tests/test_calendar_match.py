"""Tests for calendar-meeting matching service."""

import pytest

from app.services.calendar_match import compute_match_score
from app.models.calendar import (
    CalendarMatchSuggestion,
    LinkCalendarEventRequest,
)


class TestComputeMatchScore:
    def test_same_date_returns_score_gte_half(self):
        """compute_match_score with same date returns score >= 0.5."""
        meeting = {"meeting_date": "2026-03-01T14:00:00Z"}
        event = {"start_time": "2026-03-01T10:00:00Z", "attendees": []}
        score, reasons = compute_match_score(meeting, event)
        assert score >= 0.5
        assert "Same date" in reasons

    def test_different_date_returns_zero(self):
        """compute_match_score with different dates returns score 0."""
        meeting = {"meeting_date": "2026-03-01T14:00:00Z"}
        event = {"start_time": "2026-03-05T10:00:00Z", "attendees": []}
        score, reasons = compute_match_score(meeting, event)
        assert score == 0
        assert len(reasons) == 0

    def test_attendee_in_transcript_increases_score(self):
        """compute_match_score with attendee in transcript adds 0.1 per attendee."""
        meeting = {
            "meeting_date": "2026-03-01T14:00:00Z",
            "transcript_text": "Alice said we should ship by Friday. Bob agreed.",
        }
        event = {
            "start_time": "2026-03-01T10:00:00Z",
            "attendees": [
                {"name": "Alice", "email": "alice@example.com"},
            ],
        }
        score, reasons = compute_match_score(meeting, event)
        # 0.5 (same date) + 0.1 (Alice in transcript) = 0.6
        assert score == 0.6
        assert any("Alice" in r for r in reasons)

    def test_multiple_attendees(self):
        """compute_match_score with multiple attendees in transcript."""
        meeting = {
            "meeting_date": "2026-03-01T14:00:00Z",
            "transcript_text": "alice mentioned the deadline. bob confirmed the scope.",
        }
        event = {
            "start_time": "2026-03-01T10:00:00Z",
            "attendees": [
                {"name": "Alice", "email": "alice@example.com"},
                {"name": "Bob", "email": "bob@example.com"},
                {"name": "Charlie", "email": "charlie@example.com"},
            ],
        }
        score, reasons = compute_match_score(meeting, event)
        # 0.5 (same date) + 0.1 (Alice) + 0.1 (Bob) = 0.7
        assert score == 0.7
        assert len(reasons) == 3  # Same date + 2 attendees

    def test_no_meeting_date(self):
        """compute_match_score with no meeting date gives score 0 for date match."""
        meeting = {"meeting_date": None, "transcript_text": "alice spoke"}
        event = {
            "start_time": "2026-03-01T10:00:00Z",
            "attendees": [{"name": "Alice", "email": "alice@example.com"}],
        }
        score, reasons = compute_match_score(meeting, event)
        # Only attendee match: 0.1
        assert score == 0.1
        assert "Same date" not in reasons

    def test_email_prefix_match(self):
        """compute_match_score matches attendee email prefix in transcript."""
        meeting = {
            "meeting_date": "2026-03-01T14:00:00Z",
            "transcript_text": "jdoe said the API is ready.",
        }
        event = {
            "start_time": "2026-03-01T10:00:00Z",
            "attendees": [
                {"name": "", "email": "jdoe@example.com"},
            ],
        }
        score, reasons = compute_match_score(meeting, event)
        # 0.5 (date) + 0.1 (email prefix match)
        assert score == 0.6

    def test_empty_transcript_no_attendee_bonus(self):
        """compute_match_score with empty transcript only gets date score."""
        meeting = {"meeting_date": "2026-03-01T14:00:00Z", "transcript_text": ""}
        event = {
            "start_time": "2026-03-01T10:00:00Z",
            "attendees": [{"name": "Alice", "email": "alice@example.com"}],
        }
        score, reasons = compute_match_score(meeting, event)
        assert score == 0.5
        assert reasons == ["Same date"]


class TestCalendarMatchSuggestionSchema:
    def test_validates(self):
        """CalendarMatchSuggestion schema validates with all fields."""
        suggestion = CalendarMatchSuggestion(
            calendar_event_id="evt-1",
            event_title="Sprint Review",
            event_date="2026-03-01T10:00:00Z",
            score=0.7,
            match_reasons=["Same date", "Attendee 'Alice' mentioned"],
        )
        assert suggestion.calendar_event_id == "evt-1"
        assert suggestion.event_title == "Sprint Review"
        assert suggestion.score == 0.7
        assert len(suggestion.match_reasons) == 2


class TestLinkCalendarEventRequest:
    def test_with_calendar_event_id(self):
        """LinkCalendarEventRequest with calendar_event_id validates."""
        req = LinkCalendarEventRequest(calendar_event_id="evt-1")
        assert req.calendar_event_id == "evt-1"

    def test_with_none_unlink(self):
        """LinkCalendarEventRequest with None (for unlinking) validates."""
        req = LinkCalendarEventRequest(calendar_event_id=None)
        assert req.calendar_event_id is None

    def test_default_is_none(self):
        """LinkCalendarEventRequest defaults to None."""
        req = LinkCalendarEventRequest()
        assert req.calendar_event_id is None
