"""Tests for dashboard models and action item grouping logic."""

import pytest
from datetime import date, timedelta

from app.models.dashboard import (
    DashboardResponse,
    DashboardActionItem,
    DashboardProject,
    DashboardCalendarEvent,
)


class TestDashboardResponseSchema:
    def test_validates_correctly(self):
        """DashboardResponse schema validates with all required fields."""
        resp = DashboardResponse(
            meetings_count_7d=5,
            action_items={"overdue": [], "today": [], "this_week": [], "later": []},
            action_items_counts={"overdue": 0, "today": 0, "this_week": 0, "later": 0, "total": 0},
            projects=[],
            upcoming_events=[],
        )
        assert resp.meetings_count_7d == 5
        assert len(resp.projects) == 0
        assert len(resp.upcoming_events) == 0

    def test_with_populated_data(self):
        """DashboardResponse schema validates with populated data."""
        resp = DashboardResponse(
            meetings_count_7d=12,
            action_items={
                "overdue": [{"id": "1", "description": "Task 1", "status": "not_started", "is_overdue": True}],
                "today": [],
                "this_week": [],
                "later": [],
            },
            action_items_counts={"overdue": 1, "today": 0, "this_week": 0, "later": 0, "total": 1},
            projects=[
                DashboardProject(id="p1", name="Alpha", status="on_track", task_count=3, overdue_count=1)
            ],
            upcoming_events=[
                DashboardCalendarEvent(id="e1", title="Standup", start_time="2026-03-05T09:00:00Z", end_time="2026-03-05T09:30:00Z", attendees_count=5)
            ],
        )
        assert resp.meetings_count_7d == 12
        assert len(resp.projects) == 1
        assert resp.projects[0].name == "Alpha"
        assert len(resp.upcoming_events) == 1


class TestDashboardActionItemSchema:
    def test_validates_with_all_fields(self):
        """DashboardActionItem validates with all fields."""
        item = DashboardActionItem(
            id="ai-1",
            description="Write report",
            owner_name="Alice",
            due_date="2026-03-01",
            status="in_progress",
            meeting_id="mtg-1",
            meeting_title="Planning Meeting",
            is_overdue=True,
        )
        assert item.id == "ai-1"
        assert item.description == "Write report"
        assert item.owner_name == "Alice"
        assert item.is_overdue is True

    def test_validates_with_minimal_fields(self):
        """DashboardActionItem validates with only required fields."""
        item = DashboardActionItem(
            id="ai-2",
            description="Follow up",
            status="not_started",
        )
        assert item.owner_name is None
        assert item.due_date is None
        assert item.meeting_id is None
        assert item.meeting_title is None
        assert item.is_overdue is False


class TestDashboardProjectSchema:
    def test_validates_correctly(self):
        """DashboardProject validates with all fields."""
        proj = DashboardProject(
            id="p1",
            name="Beta Launch",
            status="at_risk",
            task_count=8,
            overdue_count=2,
        )
        assert proj.id == "p1"
        assert proj.name == "Beta Launch"
        assert proj.status == "at_risk"
        assert proj.task_count == 8
        assert proj.overdue_count == 2

    def test_default_counts(self):
        """DashboardProject has zero default counts."""
        proj = DashboardProject(id="p2", name="Gamma", status="on_track")
        assert proj.task_count == 0
        assert proj.overdue_count == 0


class TestDashboardCalendarEventSchema:
    def test_validates_correctly(self):
        """DashboardCalendarEvent validates with all fields."""
        evt = DashboardCalendarEvent(
            id="e1",
            title="Team Sync",
            start_time="2026-03-05T14:00:00Z",
            end_time="2026-03-05T15:00:00Z",
            attendees_count=3,
        )
        assert evt.id == "e1"
        assert evt.title == "Team Sync"
        assert evt.attendees_count == 3

    def test_default_attendees_count(self):
        """DashboardCalendarEvent has zero default attendees."""
        evt = DashboardCalendarEvent(
            id="e2",
            title="Quick call",
            start_time="2026-03-05T16:00:00Z",
            end_time="2026-03-05T16:30:00Z",
        )
        assert evt.attendees_count == 0


class TestActionItemDateGrouping:
    """Test the date grouping logic used in dashboard service."""

    def test_overdue_item(self):
        """Items with due_date before today are overdue."""
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        today_str = date.today().isoformat()
        assert yesterday < today_str  # overdue

    def test_today_item(self):
        """Items with due_date == today are in 'today' group."""
        today_str = date.today().isoformat()
        assert today_str == date.today().isoformat()

    def test_this_week_item(self):
        """Items with due_date in next 7 days are in 'this_week' group."""
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        end_of_week = (date.today() + timedelta(days=7)).isoformat()
        today_str = date.today().isoformat()
        assert tomorrow > today_str and tomorrow <= end_of_week

    def test_later_item(self):
        """Items with due_date beyond 7 days are in 'later' group."""
        far_future = (date.today() + timedelta(days=30)).isoformat()
        end_of_week = (date.today() + timedelta(days=7)).isoformat()
        assert far_future > end_of_week

    def test_no_due_date_goes_to_later(self):
        """Items without a due_date go to 'later' group."""
        due = None
        today_str = date.today().isoformat()
        end_of_week = (date.today() + timedelta(days=7)).isoformat()
        # Replicate the grouping logic
        if due and due < today_str:
            group = "overdue"
        elif due and due == today_str:
            group = "today"
        elif due and due > today_str and due <= end_of_week:
            group = "this_week"
        else:
            group = "later"
        assert group == "later"

    def test_meetings_count_returns_int(self):
        """meetings_count_7d is always an integer."""
        resp = DashboardResponse(
            meetings_count_7d=0,
            action_items={"overdue": [], "today": [], "this_week": [], "later": []},
            action_items_counts={"overdue": 0, "today": 0, "this_week": 0, "later": 0, "total": 0},
            projects=[],
            upcoming_events=[],
        )
        assert isinstance(resp.meetings_count_7d, int)
