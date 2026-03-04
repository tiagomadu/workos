"""Tests for AI Pydantic response schemas."""

import pytest
from pydantic import ValidationError

from app.ai.schemas import (
    MeetingSummary,
    ExtractedActionItem,
    ActionItemsResult,
    MeetingTypeResult,
)


class TestMeetingSummary:
    def test_valid_summary(self):
        summary = MeetingSummary(
            overview="Team discussed Q4 roadmap.",
            key_topics=["Q4 roadmap", "Budget"],
            decisions=["Prioritize API migration"],
            follow_ups=["Draft timeline by Friday"],
        )
        assert summary.overview == "Team discussed Q4 roadmap."
        assert len(summary.key_topics) == 2
        assert len(summary.decisions) == 1
        assert len(summary.follow_ups) == 1

    def test_missing_overview_raises(self):
        with pytest.raises(ValidationError):
            MeetingSummary(
                key_topics=["Q4 roadmap"],
                decisions=["Prioritize API migration"],
                follow_ups=["Draft timeline by Friday"],
            )

    def test_missing_key_topics_raises(self):
        with pytest.raises(ValidationError):
            MeetingSummary(
                overview="Team discussed Q4 roadmap.",
                decisions=["Prioritize API migration"],
                follow_ups=["Draft timeline by Friday"],
            )

    def test_missing_decisions_raises(self):
        with pytest.raises(ValidationError):
            MeetingSummary(
                overview="Team discussed Q4 roadmap.",
                key_topics=["Q4 roadmap"],
                follow_ups=["Draft timeline by Friday"],
            )

    def test_missing_follow_ups_raises(self):
        with pytest.raises(ValidationError):
            MeetingSummary(
                overview="Team discussed Q4 roadmap.",
                key_topics=["Q4 roadmap"],
                decisions=["Prioritize API migration"],
            )

    def test_empty_lists_allowed(self):
        summary = MeetingSummary(
            overview="Short meeting with no topics.",
            key_topics=[],
            decisions=[],
            follow_ups=[],
        )
        assert summary.key_topics == []
        assert summary.decisions == []
        assert summary.follow_ups == []


class TestExtractedActionItem:
    def test_full_action_item(self):
        item = ExtractedActionItem(
            description="Draft timeline",
            owner_name="Bob",
            due_date="2026-03-11",
        )
        assert item.description == "Draft timeline"
        assert item.owner_name == "Bob"
        assert item.due_date == "2026-03-11"

    def test_null_owner_name(self):
        item = ExtractedActionItem(
            description="Update project plan",
            owner_name=None,
            due_date="2026-03-11",
        )
        assert item.owner_name is None

    def test_null_due_date(self):
        item = ExtractedActionItem(
            description="Update project plan",
            owner_name="Alice",
            due_date=None,
        )
        assert item.due_date is None

    def test_both_optional_null(self):
        item = ExtractedActionItem(description="Do something")
        assert item.owner_name is None
        assert item.due_date is None

    def test_missing_description_raises(self):
        with pytest.raises(ValidationError):
            ExtractedActionItem(owner_name="Bob")


class TestActionItemsResult:
    def test_empty_list(self):
        result = ActionItemsResult(action_items=[])
        assert result.action_items == []

    def test_multiple_items(self):
        result = ActionItemsResult(
            action_items=[
                ExtractedActionItem(
                    description="Task 1", owner_name="Alice", due_date="2026-03-11"
                ),
                ExtractedActionItem(
                    description="Task 2", owner_name=None, due_date=None
                ),
                ExtractedActionItem(
                    description="Task 3", owner_name="Bob", due_date="2026-04-01"
                ),
            ]
        )
        assert len(result.action_items) == 3
        assert result.action_items[0].description == "Task 1"
        assert result.action_items[1].owner_name is None

    def test_missing_action_items_raises(self):
        with pytest.raises(ValidationError):
            ActionItemsResult()


class TestMeetingTypeResult:
    def test_valid_creation(self):
        result = MeetingTypeResult(meeting_type="team_huddle", confidence="high")
        assert result.meeting_type == "team_huddle"
        assert result.confidence == "high"

    def test_1on1_type(self):
        result = MeetingTypeResult(meeting_type="1on1", confidence="medium")
        assert result.meeting_type == "1on1"
        assert result.confidence == "medium"

    def test_other_type(self):
        result = MeetingTypeResult(meeting_type="other", confidence="low")
        assert result.meeting_type == "other"
        assert result.confidence == "low"

    def test_missing_meeting_type_raises(self):
        with pytest.raises(ValidationError):
            MeetingTypeResult(confidence="high")

    def test_missing_confidence_raises(self):
        with pytest.raises(ValidationError):
            MeetingTypeResult(meeting_type="team_huddle")
