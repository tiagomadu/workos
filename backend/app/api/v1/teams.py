"""Teams CRUD endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import AuthenticatedUser, get_current_user
from app.models.people import TeamCreate, TeamUpdate, TeamResponse, TeamDetailResponse
from app.services import people as people_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["teams"])


@router.post("/teams", response_model=TeamResponse, status_code=201)
async def create_team(
    body: TeamCreate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> TeamResponse:
    """Create a new team."""
    result = await people_service.create_team(user.id, body)
    return TeamResponse(
        id=result["id"],
        name=result["name"],
        description=result.get("description"),
        lead_id=result.get("lead_id"),
        lead_name=None,
        member_count=0,
        created_at=result.get("created_at"),
    )


@router.get("/teams", response_model=list[TeamResponse])
async def list_teams(
    user: AuthenticatedUser = Depends(get_current_user),
) -> list[TeamResponse]:
    """List all teams."""
    teams = await people_service.get_teams(user.id)
    return [TeamResponse(**t) for t in teams]


@router.get("/teams/{team_id}/detail", response_model=TeamDetailResponse)
async def get_team_detail(
    team_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> TeamDetailResponse:
    """Get team with members and projects."""
    team = await people_service.get_team_with_details(user.id, team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    return TeamDetailResponse(**team)


@router.get("/teams/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> TeamResponse:
    """Get a single team by ID."""
    team = await people_service.get_team(user.id, team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    return TeamResponse(**team)


@router.put("/teams/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: str,
    body: TeamUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> TeamResponse:
    """Update an existing team."""
    result = await people_service.update_team(user.id, team_id, body)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    return TeamResponse(
        id=result["id"],
        name=result["name"],
        description=result.get("description"),
        lead_id=result.get("lead_id"),
        lead_name=None,
        member_count=0,
        created_at=result.get("created_at"),
    )


@router.delete("/teams/{team_id}", status_code=204)
async def delete_team(
    team_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> None:
    """Delete a team."""
    deleted = await people_service.delete_team(user.id, team_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
