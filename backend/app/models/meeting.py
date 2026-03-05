"""Pydantic models for meeting-related requests and responses."""

from pydantic import BaseModel
from typing import Optional


class MeetingCreate(BaseModel):
    title: Optional[str] = None
    meeting_date: Optional[str] = None
    project_id: Optional[str] = None


class MeetingResponse(BaseModel):
    id: str
    status: str
    processing_step: Optional[str] = None
    review_status: Optional[str] = None
    suggested_project_id: Optional[str] = None
    title: Optional[str] = None
    meeting_type: Optional[str] = None
    meeting_type_confidence: Optional[str] = None
    summary: Optional[dict] = None
    error_message: Optional[str] = None
    created_at: str
    llm_provider: Optional[str] = None


class MeetingUploadResponse(BaseModel):
    meeting_id: str
    status: str


class ReviewActionItem(BaseModel):
    id: Optional[str] = None
    description: str
    owner_name: Optional[str] = None
    owner_id: Optional[str] = None
    due_date: Optional[str] = None
    status: str = "not_started"
    deleted: bool = False


class ReviewConfirmation(BaseModel):
    meeting_type: Optional[str] = None
    project_id: Optional[str] = None
    summary: Optional[dict] = None
    action_items: Optional[list[ReviewActionItem]] = None


class MeetingReviewData(BaseModel):
    id: str
    title: Optional[str] = None
    meeting_date: Optional[str] = None
    status: str
    review_status: Optional[str] = None
    meeting_type: Optional[str] = None
    meeting_type_confidence: Optional[float] = None
    suggested_project_id: Optional[str] = None
    suggested_project_name: Optional[str] = None
    summary: Optional[dict] = None
    action_items: list[dict] = []
    available_projects: list[dict] = []
    available_people: list[dict] = []


class DocumentSuggestionRequest(BaseModel):
    meeting_type: Optional[str] = None
    summary_overview: Optional[str] = None
    key_topics: list[str] = []
    decisions: list[str] = []


class GenerateDocumentRequest(BaseModel):
    doc_type: str
