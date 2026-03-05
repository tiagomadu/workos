"""Pydantic models for project CRUD operations."""

from pydantic import BaseModel
from typing import Optional


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "on_track"
    team_id: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    team_id: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    created_at: Optional[str] = None


class ProjectDetailResponse(ProjectResponse):
    meeting_count: int = 0
    total_tasks: int = 0
    completed_tasks: int = 0
    overdue_tasks: int = 0
    meetings: list[dict] = []
