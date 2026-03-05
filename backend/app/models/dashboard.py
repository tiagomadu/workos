"""Pydantic models for the dashboard endpoint."""

from typing import Optional

from pydantic import BaseModel


class DashboardActionItem(BaseModel):
    id: str
    description: str
    owner_name: Optional[str] = None
    due_date: Optional[str] = None
    status: str
    meeting_id: Optional[str] = None
    meeting_title: Optional[str] = None
    is_overdue: bool = False


class DashboardProject(BaseModel):
    id: str
    name: str
    status: str
    task_count: int = 0
    overdue_count: int = 0


class DashboardCalendarEvent(BaseModel):
    id: str
    title: str
    start_time: str
    end_time: str
    attendees_count: int = 0


class DashboardResponse(BaseModel):
    meetings_count_7d: int
    action_items: dict  # { overdue: [...], today: [...], this_week: [...], later: [...] }
    action_items_counts: dict  # { overdue: N, today: N, this_week: N, later: N, total: N }
    projects: list[DashboardProject]
    upcoming_events: list[DashboardCalendarEvent]
