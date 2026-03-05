"""Service functions for task (action item) CRUD operations."""

import logging
from datetime import date, timedelta

from app.core.supabase import get_supabase_client
from app.models.task import TaskCreate, TaskUpdate

logger = logging.getLogger(__name__)


async def get_tasks(
    user_id: str,
    status: str | None = None,
    owner_id: str | None = None,
    project_id: str | None = None,
    sort_by: str = "due_date_asc",
    include_archived: bool = False,
) -> list[dict]:
    """Get all action items for the user with optional filters."""
    supabase = get_supabase_client()
    query = supabase.table("action_items").select("*").eq("user_id", user_id)

    if not include_archived:
        query = query.eq("is_archived", False)
    if status:
        query = query.eq("status", status)
    if owner_id:
        query = query.eq("owner_id", owner_id)
    if project_id:
        query = query.eq("project_id", project_id)

    # Apply sorting
    if sort_by == "due_date_desc":
        query = query.order("due_date", desc=True)
    elif sort_by == "created_at_desc":
        query = query.order("created_at", desc=True)
    else:
        query = query.order("due_date")

    result = query.execute()
    items = result.data or []

    today = date.today().isoformat()

    # Compute is_overdue for each item
    for item in items:
        item["is_overdue"] = (
            item.get("due_date") is not None
            and item["due_date"] < today
            and item["status"] not in ("complete", "cancelled")
        )

    # Sort overdue first, then by due_date
    items.sort(
        key=lambda x: (
            not x.get("is_overdue", False),
            x.get("due_date") or "9999-99-99",
        )
    )

    # Batch-fetch project names
    project_ids = list(set(i["project_id"] for i in items if i.get("project_id")))
    project_map = {}
    if project_ids:
        proj_result = (
            supabase.table("projects")
            .select("id,name")
            .in_("id", project_ids)
            .execute()
        )
        project_map = {p["id"]: p["name"] for p in (proj_result.data or [])}

    # Batch-fetch meeting titles
    meeting_ids = list(set(i["meeting_id"] for i in items if i.get("meeting_id")))
    meeting_map = {}
    if meeting_ids:
        meet_result = (
            supabase.table("meetings")
            .select("id,title")
            .in_("id", meeting_ids)
            .execute()
        )
        meeting_map = {m["id"]: m.get("title") for m in (meet_result.data or [])}

    # Enrich items
    for item in items:
        item["project_name"] = project_map.get(item.get("project_id"))
        item["meeting_title"] = meeting_map.get(item.get("meeting_id"))

    return items


async def get_task(user_id: str, task_id: str) -> dict | None:
    """Fetch a single task by ID."""
    supabase = get_supabase_client()
    result = (
        supabase.table("action_items")
        .select("*")
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        return None

    item = result.data[0]

    # Compute is_overdue
    today = date.today().isoformat()
    item["is_overdue"] = (
        item.get("due_date") is not None
        and item["due_date"] < today
        and item["status"] not in ("complete", "cancelled")
    )

    # Enrich with project_name
    if item.get("project_id"):
        proj_result = (
            supabase.table("projects")
            .select("name")
            .eq("id", item["project_id"])
            .execute()
        )
        if proj_result.data:
            item["project_name"] = proj_result.data[0]["name"]

    # Enrich with meeting_title
    if item.get("meeting_id"):
        meet_result = (
            supabase.table("meetings")
            .select("title")
            .eq("id", item["meeting_id"])
            .execute()
        )
        if meet_result.data:
            item["meeting_title"] = meet_result.data[0].get("title")

    return item


async def create_task(user_id: str, data: TaskCreate) -> dict:
    """Create a new standalone task (action item)."""
    supabase = get_supabase_client()
    today = date.today()
    default_due = (today + timedelta(days=7)).isoformat()

    record = {
        "user_id": user_id,
        "description": data.description,
        "status": data.status or "not_started",
        "due_date": data.due_date or default_due,
        "is_archived": False,
    }
    if data.owner_name:
        record["owner_name"] = data.owner_name
    if data.owner_id:
        record["owner_id"] = data.owner_id
        record["owner_status"] = "resolved"
    if data.project_id:
        record["project_id"] = data.project_id

    result = supabase.table("action_items").insert(record).execute()
    return result.data[0]


async def update_task(user_id: str, task_id: str, data: TaskUpdate) -> dict | None:
    """Update an existing task."""
    supabase = get_supabase_client()
    updates = {k: v for k, v in data.model_dump().items() if v is not None}

    if not updates:
        return await get_task(user_id, task_id)

    result = (
        supabase.table("action_items")
        .update(updates)
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None


async def archive_task(user_id: str, task_id: str) -> dict | None:
    """Archive a task by setting is_archived=True."""
    supabase = get_supabase_client()
    result = (
        supabase.table("action_items")
        .update({"is_archived": True})
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None


async def unarchive_task(user_id: str, task_id: str) -> dict | None:
    """Unarchive a task by setting is_archived=False."""
    supabase = get_supabase_client()
    result = (
        supabase.table("action_items")
        .update({"is_archived": False})
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None
