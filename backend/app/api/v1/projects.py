"""Project CRUD endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import AuthenticatedUser, get_current_user
from app.models.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectDetailResponse,
)
from app.services import projects as projects_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["projects"])


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(
    include_archived: bool = Query(False),
    user: AuthenticatedUser = Depends(get_current_user),
) -> list[ProjectResponse]:
    """List all projects."""
    projects = await projects_service.get_projects(
        user.id, include_archived=include_archived
    )
    return [ProjectResponse(**p) for p in projects]


@router.post("/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> ProjectResponse:
    """Create a new project."""
    result = await projects_service.create_project(user.id, body)
    return ProjectResponse(
        id=result["id"],
        name=result["name"],
        description=result.get("description"),
        status=result.get("status", "on_track"),
        team_id=result.get("team_id"),
        team_name=None,
        created_at=result.get("created_at"),
    )


@router.get("/projects/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> ProjectDetailResponse:
    """Get project details including meeting count and task stats."""
    project = await projects_service.get_project(user.id, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return ProjectDetailResponse(**project)


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> ProjectResponse:
    """Update an existing project."""
    result = await projects_service.update_project(user.id, project_id, body)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return ProjectResponse(
        id=result["id"],
        name=result["name"],
        description=result.get("description"),
        status=result.get("status", "on_track"),
        team_id=result.get("team_id"),
        team_name=None,
        created_at=result.get("created_at"),
    )


@router.put("/projects/{project_id}/archive", response_model=ProjectResponse)
async def archive_project(
    project_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> ProjectResponse:
    """Archive a project."""
    result = await projects_service.archive_project(user.id, project_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return ProjectResponse(
        id=result["id"],
        name=result["name"],
        description=result.get("description"),
        status=result.get("status", "archived"),
        team_id=result.get("team_id"),
        team_name=None,
        created_at=result.get("created_at"),
    )
