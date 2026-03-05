"""Service functions for people and teams CRUD operations."""

import logging
from datetime import datetime, timezone

from app.core.supabase import get_supabase_client
from app.models.people import PersonCreate, PersonUpdate, TeamCreate, TeamUpdate

logger = logging.getLogger(__name__)


# --- Person CRUD ---

async def create_person(user_id: str, data: PersonCreate) -> dict:
    """Create a new person record."""
    supabase = get_supabase_client()
    record = {
        "user_id": user_id,
        "name": data.name,
        "role_title": data.role_title,
        "team_id": data.team_id,
        "notes": data.aliases,
    }
    result = supabase.table("people").insert(record).execute()
    return result.data[0]


async def get_people(user_id: str, search: str | None = None) -> list[dict]:
    """List all people for the user, optionally filtered by search term."""
    supabase = get_supabase_client()
    query = supabase.table("people").select("*, teams(name)").eq("user_id", user_id)

    if search:
        query = query.or_(f"name.ilike.%{search}%,notes.ilike.%{search}%")

    result = query.order("name").execute()

    # Enrich with team_name and aliases, and count action items
    people = []
    for row in result.data:
        team_name = None
        if row.get("teams") and isinstance(row["teams"], dict):
            team_name = row["teams"].get("name")

        # Count action items for this person
        ai_result = (
            supabase.table("action_items")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("owner_id", row["id"])
            .execute()
        )

        people.append({
            "id": row["id"],
            "name": row["name"],
            "role_title": row.get("role_title"),
            "team_id": row.get("team_id"),
            "team_name": team_name,
            "aliases": row.get("notes"),
            "created_at": row.get("created_at"),
            "action_item_count": ai_result.count if ai_result.count is not None else 0,
        })

    return people


async def get_person(user_id: str, person_id: str) -> dict | None:
    """Fetch a single person with action item stats."""
    supabase = get_supabase_client()
    result = (
        supabase.table("people")
        .select("*, teams(name)")
        .eq("id", person_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        return None

    row = result.data[0]
    team_name = None
    if row.get("teams") and isinstance(row["teams"], dict):
        team_name = row["teams"].get("name")

    # Get action item stats
    all_items = (
        supabase.table("action_items")
        .select("id, status, due_date")
        .eq("user_id", user_id)
        .eq("owner_id", person_id)
        .execute()
    )

    total_items = len(all_items.data)
    completed_items = sum(1 for item in all_items.data if item.get("status") == "completed")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    overdue_items = sum(
        1 for item in all_items.data
        if item.get("due_date") and item["due_date"] < today and item.get("status") != "completed"
    )
    completion_rate = (completed_items / total_items * 100) if total_items > 0 else 0.0

    return {
        "id": row["id"],
        "name": row["name"],
        "role_title": row.get("role_title"),
        "team_id": row.get("team_id"),
        "team_name": team_name,
        "aliases": row.get("notes"),
        "created_at": row.get("created_at"),
        "action_item_count": total_items,
        "total_items": total_items,
        "completed_items": completed_items,
        "overdue_items": overdue_items,
        "completion_rate": completion_rate,
    }


async def update_person(user_id: str, person_id: str, data: PersonUpdate) -> dict:
    """Update an existing person record."""
    supabase = get_supabase_client()

    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.role_title is not None:
        update_data["role_title"] = data.role_title
    if data.team_id is not None:
        update_data["team_id"] = data.team_id
    if data.aliases is not None:
        update_data["notes"] = data.aliases

    if not update_data:
        # Nothing to update, return current record
        return await get_person(user_id, person_id)

    result = (
        supabase.table("people")
        .update(update_data)
        .eq("id", person_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None


async def delete_person(user_id: str, person_id: str) -> bool:
    """Delete a person record."""
    supabase = get_supabase_client()
    result = (
        supabase.table("people")
        .delete()
        .eq("id", person_id)
        .eq("user_id", user_id)
        .execute()
    )
    return len(result.data) > 0


# --- Team CRUD ---

async def create_team(user_id: str, data: TeamCreate) -> dict:
    """Create a new team record."""
    supabase = get_supabase_client()
    record = {
        "user_id": user_id,
        "name": data.name,
        "description": data.description,
        "lead_id": data.lead_id,
    }
    result = supabase.table("teams").insert(record).execute()
    return result.data[0]


async def get_teams(user_id: str) -> list[dict]:
    """List all teams for the user."""
    supabase = get_supabase_client()
    result = (
        supabase.table("teams")
        .select("*, people!teams_lead_id_fkey(name)")
        .eq("user_id", user_id)
        .order("name")
        .execute()
    )

    teams = []
    for row in result.data:
        lead_name = None
        if row.get("people") and isinstance(row["people"], dict):
            lead_name = row["people"].get("name")

        # Count members
        members = (
            supabase.table("people")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("team_id", row["id"])
            .execute()
        )

        teams.append({
            "id": row["id"],
            "name": row["name"],
            "description": row.get("description"),
            "lead_id": row.get("lead_id"),
            "lead_name": lead_name,
            "member_count": members.count if members.count is not None else 0,
            "created_at": row.get("created_at"),
        })

    return teams


async def get_team(user_id: str, team_id: str) -> dict | None:
    """Fetch a single team by ID."""
    supabase = get_supabase_client()
    result = (
        supabase.table("teams")
        .select("*, people!teams_lead_id_fkey(name)")
        .eq("id", team_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        return None

    row = result.data[0]
    lead_name = None
    if row.get("people") and isinstance(row["people"], dict):
        lead_name = row["people"].get("name")

    # Count members
    members = (
        supabase.table("people")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("team_id", row["id"])
        .execute()
    )

    return {
        "id": row["id"],
        "name": row["name"],
        "description": row.get("description"),
        "lead_id": row.get("lead_id"),
        "lead_name": lead_name,
        "member_count": members.count if members.count is not None else 0,
        "created_at": row.get("created_at"),
    }


async def update_team(user_id: str, team_id: str, data: TeamUpdate) -> dict:
    """Update an existing team record."""
    supabase = get_supabase_client()

    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.lead_id is not None:
        update_data["lead_id"] = data.lead_id

    if not update_data:
        return await get_team(user_id, team_id)

    result = (
        supabase.table("teams")
        .update(update_data)
        .eq("id", team_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None


async def delete_team(user_id: str, team_id: str) -> bool:
    """Delete a team record."""
    supabase = get_supabase_client()
    result = (
        supabase.table("teams")
        .delete()
        .eq("id", team_id)
        .eq("user_id", user_id)
        .execute()
    )
    return len(result.data) > 0
