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
