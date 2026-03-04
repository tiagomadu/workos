"""Pydantic response models for AI-generated meeting analysis."""

from pydantic import BaseModel, Field


class MeetingSummary(BaseModel):
    overview: str = Field(description="A 2-3 sentence overview of the meeting")
    key_topics: list[str] = Field(description="Main topics discussed")
    decisions: list[str] = Field(description="Decisions made during the meeting")
    follow_ups: list[str] = Field(description="Follow-up items or next steps mentioned")


class ExtractedActionItem(BaseModel):
    description: str = Field(description="What needs to be done")
    owner_name: str | None = Field(
        default=None, description="Person responsible, null if unclear"
    )
    due_date: str | None = Field(
        default=None, description="Due date in YYYY-MM-DD format, null if not mentioned"
    )


class ActionItemsResult(BaseModel):
    action_items: list[ExtractedActionItem] = Field(
        description="List of extracted action items"
    )


class MeetingTypeResult(BaseModel):
    meeting_type: str = Field(
        description="One of: 1on1, team_huddle, project_review, business_partner, other"
    )
    confidence: str = Field(description="One of: high, medium, low")
