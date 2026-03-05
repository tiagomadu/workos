"""Calendar sync service — fetches events from Google Calendar API and stores them."""

import logging
from datetime import datetime, timezone, timedelta

import httpx

from app.core.supabase import get_supabase_client
from app.core.google_oauth import get_valid_token

logger = logging.getLogger(__name__)

GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"


async def sync_calendar_events(user_id: str) -> int:
    """Fetch events from Google Calendar API v3 and upsert into calendar_events.

    Fetches events from the past 30 days through the next 14 days.
    Uses a select-then-update-or-insert pattern since there is no UNIQUE
    constraint on (user_id, google_event_id).

    Returns the number of events synced.
    """
    access_token = await get_valid_token(user_id)
    supabase = get_supabase_client()

    time_min = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    time_max = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()

    params = {
        "timeMin": time_min,
        "timeMax": time_max,
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": "250",
    }

    events_synced = 0

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GOOGLE_CALENDAR_API}/calendars/primary/events",
            headers={"Authorization": f"Bearer {access_token}"},
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()

    now_iso = datetime.now(timezone.utc).isoformat()

    for item in data.get("items", []):
        google_event_id = item.get("id")
        if not google_event_id:
            continue

        # Extract start/end times (handle all-day events)
        start = item.get("start", {})
        end = item.get("end", {})
        start_time = start.get("dateTime") or start.get("date")
        end_time = end.get("dateTime") or end.get("date")

        if not start_time or not end_time:
            continue

        attendees = [
            {"email": a.get("email", ""), "name": a.get("displayName", "")}
            for a in item.get("attendees", [])
        ]

        row = {
            "user_id": user_id,
            "google_event_id": google_event_id,
            "title": item.get("summary", "Untitled Event"),
            "start_time": start_time,
            "end_time": end_time,
            "attendees": attendees,
            "description": item.get("description"),
            "synced_at": now_iso,
        }

        # Select-then-update-or-insert pattern
        existing = (
            supabase.table("calendar_events")
            .select("id")
            .eq("user_id", user_id)
            .eq("google_event_id", google_event_id)
            .execute()
        )

        if existing.data:
            supabase.table("calendar_events").update(row).eq(
                "id", existing.data[0]["id"]
            ).execute()
        else:
            supabase.table("calendar_events").insert(row).execute()

        events_synced += 1

    logger.info("Synced %d calendar events for user %s", events_synced, user_id)
    return events_synced


async def get_calendar_events(user_id: str) -> list[dict]:
    """Get all calendar events for a user, ordered by start_time DESC."""
    supabase = get_supabase_client()
    result = (
        supabase.table("calendar_events")
        .select("*")
        .eq("user_id", user_id)
        .order("start_time", desc=True)
        .execute()
    )
    return result.data


async def get_upcoming_events(user_id: str, days: int = 7) -> list[dict]:
    """Get upcoming calendar events for the dashboard.

    Returns events from now through the specified number of days ahead.
    """
    supabase = get_supabase_client()
    now = datetime.now(timezone.utc).isoformat()
    future = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()

    result = (
        supabase.table("calendar_events")
        .select("*")
        .eq("user_id", user_id)
        .gte("start_time", now)
        .lte("start_time", future)
        .order("start_time", desc=False)
        .execute()
    )
    return result.data
