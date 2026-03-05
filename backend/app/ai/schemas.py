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


class SearchAnswer(BaseModel):
    """Response model for RAG search answer generation."""

    answer: str


class ProjectSuggestion(BaseModel):
    """AI-suggested project match for a meeting."""
    project_id: str | None = Field(
        default=None, description="ID of the best matching project, null if no match"
    )
    project_name: str | None = Field(
        default=None, description="Name of the matched project"
    )
    confidence: float = Field(
        description="Match confidence from 0.0 to 1.0"
    )
    reasoning: str = Field(
        description="Brief explanation of why this project was chosen"
    )


class DocumentSuggestion(BaseModel):
    """A single suggested document to generate from a meeting."""
    doc_type: str = Field(
        description="One of: follow_up_email, meeting_minutes, project_update, decision_log"
    )
    title: str = Field(description="Suggested title for the document")
    description: str = Field(description="What this document would contain")
    relevance_score: float = Field(description="How useful this doc would be, 0.0 to 1.0")


class DocumentSuggestionsResult(BaseModel):
    """AI-suggested documents to generate from a meeting."""
    suggestions: list[DocumentSuggestion] = Field(
        description="List of suggested documents"
    )
