"""Dashboard data aggregation service."""

import logging
from datetime import datetime, timezone, timedelta, date

from app.core.supabase import get_supabase_client

logger = logging.getLogger(__name__)


async def get_dashboard_data(user_id: str) -> dict:
    """Aggregate all dashboard data in a single call."""
    supabase = get_supabase_client()

    # 1. Meetings count (last 7 days)
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    meetings_result = (
        supabase.table("meetings")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("created_at", seven_days_ago)
        .execute()
    )
    meetings_count = meetings_result.count if meetings_result.count is not None else len(meetings_result.data or [])

    # 2. Action items (open, not archived)
    items_result = (
        supabase.table("action_items")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_archived", False)
        .execute()
    )
    all_items = items_result.data or []

    # Filter out completed/cancelled
    open_items = [
        item for item in all_items
        if item.get("status") not in ("complete", "cancelled")
    ]

    # Group items by due date proximity
    today_str = date.today().isoformat()
    end_of_week = (date.today() + timedelta(days=7)).isoformat()

    groups = {"overdue": [], "today": [], "this_week": [], "later": []}

    for item in open_items:
        due = item.get("due_date")
        if due and due < today_str:
            groups["overdue"].append(item)
        elif due and due == today_str:
            groups["today"].append(item)
        elif due and due > today_str and due <= end_of_week:
            groups["this_week"].append(item)
        else:
            groups["later"].append(item)

    # Batch-fetch meeting titles for enrichment
    meeting_ids = list(set(i["meeting_id"] for i in open_items if i.get("meeting_id")))
    meeting_map = {}
    if meeting_ids:
        meet_result = (
            supabase.table("meetings")
            .select("id,title")
            .in_("id", meeting_ids)
            .execute()
        )
        meeting_map = {m["id"]: m.get("title") for m in (meet_result.data or [])}

    # Transform items to dashboard format
    def to_dashboard_item(item: dict) -> dict:
        return {
            "id": item["id"],
            "description": item.get("description", ""),
            "owner_name": item.get("owner_name"),
            "due_date": item.get("due_date"),
            "status": item.get("status", "not_started"),
            "meeting_id": item.get("meeting_id"),
            "meeting_title": meeting_map.get(item.get("meeting_id")),
            "is_overdue": item.get("due_date") is not None and item["due_date"] < today_str,
        }

    action_items = {
        group: [to_dashboard_item(i) for i in items]
        for group, items in groups.items()
    }

    action_items_counts = {
        group: len(items) for group, items in groups.items()
    }
    action_items_counts["total"] = sum(action_items_counts.values())

    # 3. Projects (active, not archived)
    projects_result = (
        supabase.table("projects")
        .select("*")
        .eq("user_id", user_id)
        .neq("status", "archived")
        .execute()
    )
    projects_data = projects_result.data or []

    # For each project, count open tasks and overdue tasks
    projects = []
    for proj in projects_data:
        proj_items = [
            i for i in all_items
            if i.get("project_id") == proj["id"]
            and i.get("status") not in ("complete", "cancelled")
        ]
        overdue_count = sum(
            1 for i in proj_items
            if i.get("due_date") and i["due_date"] < today_str
        )
        projects.append({
            "id": proj["id"],
            "name": proj["name"],
            "status": proj.get("status", "on_track"),
            "task_count": len(proj_items),
            "overdue_count": overdue_count,
        })

    # 4. Upcoming events (next 7 days)
    now = datetime.now(timezone.utc).isoformat()
    week_ahead = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    events_result = (
        supabase.table("calendar_events")
        .select("*")
        .eq("user_id", user_id)
        .gte("start_time", now)
        .lte("start_time", week_ahead)
        .order("start_time")
        .execute()
    )
    events_data = events_result.data or []

    upcoming_events = [
        {
            "id": evt["id"],
            "title": evt.get("title", "Untitled"),
            "start_time": evt["start_time"],
            "end_time": evt["end_time"],
            "attendees_count": len(evt.get("attendees") or []),
        }
        for evt in events_data
    ]

    return {
        "meetings_count_7d": meetings_count,
        "action_items": action_items,
        "action_items_counts": action_items_counts,
        "projects": projects,
        "upcoming_events": upcoming_events,
    }
