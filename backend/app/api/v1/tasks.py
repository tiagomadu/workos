"""Task (action item) CRUD endpoints."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import AuthenticatedUser, get_current_user
from app.models.task import TaskCreate, TaskUpdate, TaskResponse
from app.services import tasks as tasks_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tasks"])


@router.get("/tasks", response_model=list[TaskResponse])
async def list_tasks(
    status_filter: Optional[str] = Query(None, alias="status"),
    owner_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    sort_by: str = Query("due_date_asc"),
    include_archived: bool = Query(False),
    user: AuthenticatedUser = Depends(get_current_user),
) -> list[TaskResponse]:
    """List all tasks with optional filters."""
    items = await tasks_service.get_tasks(
        user_id=user.id,
        status=status_filter,
        owner_id=owner_id,
        project_id=project_id,
        sort_by=sort_by,
        include_archived=include_archived,
    )
    return [TaskResponse(**item) for item in items]


@router.post("/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    body: TaskCreate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> TaskResponse:
    """Create a new standalone task."""
    result = await tasks_service.create_task(user.id, body)
    return TaskResponse(
        id=result["id"],
        description=result["description"],
        owner_name=result.get("owner_name"),
        owner_id=result.get("owner_id"),
        owner_status=result.get("owner_status"),
        due_date=result.get("due_date"),
        status=result.get("status", "not_started"),
        project_id=result.get("project_id"),
        meeting_id=result.get("meeting_id"),
        is_archived=result.get("is_archived", False),
        is_overdue=False,
        created_at=result.get("created_at"),
    )


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> TaskResponse:
    """Get a single task by ID."""
    task = await tasks_service.get_task(user.id, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return TaskResponse(**task)


@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    body: TaskUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> TaskResponse:
    """Update an existing task."""
    result = await tasks_service.update_task(user.id, task_id, body)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return TaskResponse(
        id=result["id"],
        description=result["description"],
        owner_name=result.get("owner_name"),
        owner_id=result.get("owner_id"),
        owner_status=result.get("owner_status"),
        due_date=result.get("due_date"),
        status=result.get("status", "not_started"),
        project_id=result.get("project_id"),
        meeting_id=result.get("meeting_id"),
        is_archived=result.get("is_archived", False),
        is_overdue=False,
        created_at=result.get("created_at"),
    )


@router.put("/tasks/{task_id}/archive", response_model=TaskResponse)
async def archive_task(
    task_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> TaskResponse:
    """Archive a task."""
    result = await tasks_service.archive_task(user.id, task_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return TaskResponse(
        id=result["id"],
        description=result["description"],
        owner_name=result.get("owner_name"),
        owner_id=result.get("owner_id"),
        owner_status=result.get("owner_status"),
        due_date=result.get("due_date"),
        status=result.get("status", "not_started"),
        project_id=result.get("project_id"),
        meeting_id=result.get("meeting_id"),
        is_archived=result.get("is_archived", True),
        is_overdue=False,
        created_at=result.get("created_at"),
    )


@router.put("/tasks/{task_id}/unarchive", response_model=TaskResponse)
async def unarchive_task(
    task_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> TaskResponse:
    """Unarchive a task."""
    result = await tasks_service.unarchive_task(user.id, task_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return TaskResponse(
        id=result["id"],
        description=result["description"],
        owner_name=result.get("owner_name"),
        owner_id=result.get("owner_id"),
        owner_status=result.get("owner_status"),
        due_date=result.get("due_date"),
        status=result.get("status", "not_started"),
        project_id=result.get("project_id"),
        meeting_id=result.get("meeting_id"),
        is_archived=result.get("is_archived", False),
        is_overdue=False,
        created_at=result.get("created_at"),
    )
