"""Pydantic models for calendar-related requests and responses."""

from pydantic import BaseModel
from typing import Optional


class CalendarEventResponse(BaseModel):
    id: str
    google_event_id: str
    title: str
    start_time: str
    end_time: str
    attendees: list = []
    description: Optional[str] = None
    meeting_id: Optional[str] = None
    synced_at: str


class CalendarSyncResponse(BaseModel):
    events_synced: int
    last_synced: str


class GoogleConnectionStatus(BaseModel):
    connected: bool
    email: Optional[str] = None
    last_synced: Optional[str] = None
    scopes: Optional[str] = None


class CalendarMatchSuggestion(BaseModel):
    calendar_event_id: str
    event_title: str
    event_date: str
    score: float
    match_reasons: list[str]


class LinkCalendarEventRequest(BaseModel):
    calendar_event_id: Optional[str] = None


class GoogleCallbackRequest(BaseModel):
    code: str
