"""Pydantic models for task (action item) CRUD operations."""

from pydantic import BaseModel
from typing import Optional


class TaskCreate(BaseModel):
    description: str
    owner_name: Optional[str] = None
    owner_id: Optional[str] = None
    due_date: Optional[str] = None  # YYYY-MM-DD
    status: str = "not_started"
    project_id: Optional[str] = None


class TaskUpdate(BaseModel):
    description: Optional[str] = None
    owner_name: Optional[str] = None
    owner_id: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    project_id: Optional[str] = None


class TaskResponse(BaseModel):
    id: str
    description: str
    owner_name: Optional[str] = None
    owner_id: Optional[str] = None
    owner_status: Optional[str] = None
    due_date: Optional[str] = None
    status: str
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    meeting_id: Optional[str] = None
    meeting_title: Optional[str] = None
    is_archived: bool = False
    is_overdue: bool = False
    created_at: Optional[str] = None
