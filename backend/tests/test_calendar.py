"""Tests for calendar models and Google OAuth URL generation."""

import pytest

from app.models.calendar import (
    CalendarEventResponse,
    CalendarSyncResponse,
    GoogleConnectionStatus,
    GoogleCallbackRequest,
)
from app.core.google_oauth import get_google_auth_url


class TestCalendarEventResponseSchema:
    def test_validates_correctly(self):
        """CalendarEventResponse schema validates with all required fields."""
        event = CalendarEventResponse(
            id="evt-1",
            google_event_id="google-123",
            title="Team Standup",
            start_time="2026-03-01T09:00:00Z",
            end_time="2026-03-01T09:30:00Z",
            attendees=[{"email": "alice@example.com"}],
            description="Daily standup",
            meeting_id="mtg-1",
            synced_at="2026-03-01T10:00:00Z",
        )
        assert event.id == "evt-1"
        assert event.google_event_id == "google-123"
        assert event.title == "Team Standup"
        assert event.start_time == "2026-03-01T09:00:00Z"
        assert event.end_time == "2026-03-01T09:30:00Z"
        assert len(event.attendees) == 1
        assert event.description == "Daily standup"
        assert event.meeting_id == "mtg-1"
        assert event.synced_at == "2026-03-01T10:00:00Z"

    def test_optional_fields_default(self):
        """CalendarEventResponse optional fields default correctly."""
        event = CalendarEventResponse(
            id="evt-2",
            google_event_id="google-456",
            title="Quick Chat",
            start_time="2026-03-01T11:00:00Z",
            end_time="2026-03-01T11:15:00Z",
            synced_at="2026-03-01T12:00:00Z",
        )
        assert event.attendees == []
        assert event.description is None
        assert event.meeting_id is None


class TestCalendarSyncResponseSchema:
    def test_validates_correctly(self):
        """CalendarSyncResponse schema validates with required fields."""
        sync = CalendarSyncResponse(
            events_synced=42,
            last_synced="2026-03-01T10:00:00Z",
        )
        assert sync.events_synced == 42
        assert sync.last_synced == "2026-03-01T10:00:00Z"


class TestGoogleConnectionStatus:
    def test_connected_false(self):
        """GoogleConnectionStatus schema with connected=false has null optional fields."""
        status = GoogleConnectionStatus(connected=False)
        assert status.connected is False
        assert status.email is None
        assert status.last_synced is None
        assert status.scopes is None

    def test_connected_true(self):
        """GoogleConnectionStatus schema with connected=true has all fields."""
        status = GoogleConnectionStatus(
            connected=True,
            email="user@gmail.com",
            last_synced="2026-03-01T10:00:00Z",
            scopes="calendar.readonly gmail.readonly",
        )
        assert status.connected is True
        assert status.email == "user@gmail.com"
        assert status.last_synced == "2026-03-01T10:00:00Z"
        assert status.scopes == "calendar.readonly gmail.readonly"


class TestGoogleCallbackRequest:
    def test_validates(self):
        """GoogleCallbackRequest schema validates with code field."""
        req = GoogleCallbackRequest(code="4/0AfJohXn...")
        assert req.code == "4/0AfJohXn..."


class TestGetGoogleAuthUrl:
    def test_returns_url_with_correct_scopes(self):
        """get_google_auth_url returns URL containing calendar and gmail scopes."""
        url = get_google_auth_url(redirect_uri="http://localhost:3000/settings")
        assert "calendar.readonly" in url
        assert "gmail.readonly" in url

    def test_includes_calendar_and_gmail_scopes(self):
        """get_google_auth_url includes both calendar.readonly and gmail.readonly scopes."""
        url = get_google_auth_url(redirect_uri="http://localhost:3000/settings")
        assert "https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.readonly" in url or "calendar.readonly" in url
        assert "https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.readonly" in url or "gmail.readonly" in url

    def test_includes_access_type_offline_and_prompt_consent(self):
        """get_google_auth_url includes access_type=offline and prompt=consent."""
        url = get_google_auth_url(redirect_uri="http://localhost:3000/settings")
        assert "access_type=offline" in url
        assert "prompt=consent" in url

    def test_starts_with_google_auth_base(self):
        """get_google_auth_url returns URL starting with Google OAuth base."""
        url = get_google_auth_url(redirect_uri="http://localhost:3000/settings")
        assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth")

    def test_includes_redirect_uri(self):
        """get_google_auth_url includes the provided redirect_uri."""
        url = get_google_auth_url(redirect_uri="http://localhost:3000/settings")
        assert "redirect_uri=" in url
        assert "localhost" in url
