"""Pydantic models for people and teams CRUD operations."""

from pydantic import BaseModel
from typing import Optional


# --- Person models ---

class PersonCreate(BaseModel):
    name: str
    role_title: Optional[str] = None
    team_id: Optional[str] = None
    aliases: Optional[str] = None


class PersonUpdate(BaseModel):
    name: Optional[str] = None
    role_title: Optional[str] = None
    team_id: Optional[str] = None
    aliases: Optional[str] = None


class PersonResponse(BaseModel):
    id: str
    name: str
    role_title: Optional[str] = None
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    aliases: Optional[str] = None
    created_at: Optional[str] = None
    action_item_count: int = 0


class PersonDetailResponse(PersonResponse):
    total_items: int = 0
    completed_items: int = 0
    overdue_items: int = 0
    completion_rate: float = 0.0


# --- Team models ---

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    lead_id: Optional[str] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    lead_id: Optional[str] = None


class TeamResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    lead_id: Optional[str] = None
    lead_name: Optional[str] = None
    member_count: int = 0
    created_at: Optional[str] = None


class TeamMember(BaseModel):
    id: str
    name: str
    role_title: Optional[str] = None
    email: Optional[str] = None


class TeamProject(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str = "on_track"


class TeamDetailResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    lead_id: Optional[str] = None
    lead_name: Optional[str] = None
    member_count: int = 0
    members: list[TeamMember] = []
    projects: list[TeamProject] = []
    created_at: Optional[str] = None


# --- Owner resolution models ---

class OwnerResolutionResult(BaseModel):
    owner_name: Optional[str] = None
    owner_id: Optional[str] = None
    owner_status: str
    candidates: list[dict] = []
    confidence: float = 0.0
