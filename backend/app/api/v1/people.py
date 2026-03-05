"""People CRUD and owner resolution endpoints."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.supabase import get_supabase_client
from app.models.people import (
    PersonCreate,
    PersonUpdate,
    PersonResponse,
    PersonDetailResponse,
)
from app.services import people as people_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["people"])


class ResolveOwnerRequest(BaseModel):
    action_item_id: str


@router.post("/people", response_model=PersonResponse, status_code=201)
async def create_person(
    body: PersonCreate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> PersonResponse:
    """Create a new person."""
    result = await people_service.create_person(user.id, body)
    return PersonResponse(
        id=result["id"],
        name=result["name"],
        role_title=result.get("role_title"),
        team_id=result.get("team_id"),
        team_name=None,
        aliases=result.get("notes"),
        created_at=result.get("created_at"),
        action_item_count=0,
    )


@router.get("/people", response_model=list[PersonResponse])
async def list_people(
    search: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(get_current_user),
) -> list[PersonResponse]:
    """List all people, optionally filtered by search term."""
    people = await people_service.get_people(user.id, search=search)
    return [PersonResponse(**p) for p in people]


@router.get("/people/{person_id}", response_model=PersonDetailResponse)
async def get_person(
    person_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> PersonDetailResponse:
    """Get a person's details including action item stats."""
    person = await people_service.get_person(user.id, person_id)
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found",
        )
    return PersonDetailResponse(**person)


@router.put("/people/{person_id}", response_model=PersonResponse)
async def update_person(
    person_id: str,
    body: PersonUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> PersonResponse:
    """Update an existing person."""
    result = await people_service.update_person(user.id, person_id, body)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found",
        )
    # If update_person returns the raw DB row, adapt it
    return PersonResponse(
        id=result["id"],
        name=result["name"],
        role_title=result.get("role_title"),
        team_id=result.get("team_id"),
        aliases=result.get("notes") if "notes" in result else result.get("aliases"),
        created_at=result.get("created_at"),
        action_item_count=result.get("action_item_count", 0),
    )


@router.delete("/people/{person_id}", status_code=204)
async def delete_person(
    person_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> None:
    """Delete a person."""
    deleted = await people_service.delete_person(user.id, person_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found",
        )


@router.post("/people/{person_id}/resolve")
async def resolve_action_item_owner(
    person_id: str,
    body: ResolveOwnerRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """Manually resolve an action item to a specific person."""
    # Verify person exists
    person = await people_service.get_person(user.id, person_id)
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found",
        )

    # Update the action item
    supabase = get_supabase_client()
    result = (
        supabase.table("action_items")
        .update({"owner_id": person_id, "owner_status": "resolved"})
        .eq("id", body.action_item_id)
        .eq("user_id", user.id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action item not found",
        )

    return {"status": "ok", "owner_id": person_id, "action_item_id": body.action_item_id}
