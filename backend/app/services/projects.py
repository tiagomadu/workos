"""Service functions for project CRUD operations."""

import logging
from datetime import date

from app.core.supabase import get_supabase_client
from app.models.project import ProjectCreate, ProjectUpdate

logger = logging.getLogger(__name__)


async def get_projects(
    user_id: str,
    include_archived: bool = False,
) -> list[dict]:
    """List all projects for the user."""
    supabase = get_supabase_client()
    query = supabase.table("projects").select("*, teams(name)").eq("user_id", user_id)

    if not include_archived:
        query = query.neq("status", "archived")

    result = query.order("name").execute()

    projects = []
    for row in result.data or []:
        team_name = None
        if row.get("teams") and isinstance(row["teams"], dict):
            team_name = row["teams"].get("name")

        projects.append({
            "id": row["id"],
            "name": row["name"],
            "description": row.get("description"),
            "status": row.get("status", "on_track"),
            "team_id": row.get("team_id"),
            "team_name": team_name,
            "created_at": row.get("created_at"),
        })

    return projects


async def get_project(user_id: str, project_id: str) -> dict | None:
    """Fetch a single project with meeting count and task stats."""
    supabase = get_supabase_client()
    result = (
        supabase.table("projects")
        .select("*, teams(name)")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        return None

    row = result.data[0]
    team_name = None
    if row.get("teams") and isinstance(row["teams"], dict):
        team_name = row["teams"].get("name")

    # Get meetings for this project
    meetings_result = (
        supabase.table("meetings")
        .select("id, title, meeting_date, status")
        .eq("project_id", project_id)
        .eq("user_id", user_id)
        .order("meeting_date", desc=True)
        .execute()
    )
    meetings = meetings_result.data or []

    # Get task stats for this project
    tasks_result = (
        supabase.table("action_items")
        .select("id, status, due_date")
        .eq("project_id", project_id)
        .eq("user_id", user_id)
        .execute()
    )
    tasks = tasks_result.data or []

    today = date.today().isoformat()
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.get("status") == "complete")
    overdue_tasks = sum(
        1 for t in tasks
        if t.get("due_date")
        and t["due_date"] < today
        and t.get("status") not in ("complete", "cancelled")
    )

    return {
        "id": row["id"],
        "name": row["name"],
        "description": row.get("description"),
        "status": row.get("status", "on_track"),
        "team_id": row.get("team_id"),
        "team_name": team_name,
        "created_at": row.get("created_at"),
        "meeting_count": len(meetings),
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "overdue_tasks": overdue_tasks,
        "meetings": meetings,
    }


async def create_project(user_id: str, data: ProjectCreate) -> dict:
    """Create a new project."""
    supabase = get_supabase_client()
    record = {
        "user_id": user_id,
        "name": data.name,
        "status": data.status or "on_track",
    }
    if data.description:
        record["description"] = data.description
    if data.team_id:
        record["team_id"] = data.team_id

    result = supabase.table("projects").insert(record).execute()
    return result.data[0]


async def update_project(
    user_id: str, project_id: str, data: ProjectUpdate
) -> dict | None:
    """Update an existing project."""
    supabase = get_supabase_client()

    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.status is not None:
        update_data["status"] = data.status
    if data.team_id is not None:
        update_data["team_id"] = data.team_id

    if not update_data:
        return await get_project(user_id, project_id)

    result = (
        supabase.table("projects")
        .update(update_data)
        .eq("id", project_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None


async def archive_project(user_id: str, project_id: str) -> dict | None:
    """Archive a project by setting status to 'archived'."""
    supabase = get_supabase_client()
    result = (
        supabase.table("projects")
        .update({"status": "archived"})
        .eq("id", project_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None
