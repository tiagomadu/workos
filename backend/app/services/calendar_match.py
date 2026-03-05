"""Calendar-meeting matching service — scores and links calendar events to meetings."""

import logging
from datetime import datetime, timedelta

from app.core.supabase import get_supabase_client

logger = logging.getLogger(__name__)


def compute_match_score(meeting: dict, event: dict) -> tuple[float, list[str]]:
    """Compute a match score between a meeting and a calendar event.

    Scoring:
        +0.5 for same date (meeting_date matches event start_time date)
        +0.1 per attendee whose name or email appears in the transcript

    Returns (score, list_of_reasons).
    """
    score = 0.0
    reasons: list[str] = []

    # Compare dates
    meeting_date = _parse_date(meeting.get("meeting_date"))
    event_date = _parse_date(event.get("start_time"))

    if meeting_date and event_date and meeting_date == event_date:
        score += 0.5
        reasons.append("Same date")

    # Check attendees against transcript
    transcript = (meeting.get("transcript_text") or meeting.get("raw_transcript") or "").lower()
    if transcript:
        attendees = event.get("attendees") or []
        for attendee in attendees:
            name = (attendee.get("name") or "").lower().strip()
            email = (attendee.get("email") or "").lower().strip()

            if name and name in transcript:
                score += 0.1
                reasons.append(f"Attendee '{attendee.get('name')}' mentioned in transcript")
            elif email and email.split("@")[0] in transcript:
                score += 0.1
                reasons.append(f"Attendee email prefix '{email.split('@')[0]}' found in transcript")

    return round(score, 2), reasons


async def find_matching_events(meeting_id: str, user_id: str) -> list[dict]:
    """Find calendar events that match a meeting.

    Looks for events within +/- 1 day of the meeting date, scores them,
    and returns the top 5 with score >= 0.5.
    """
    supabase = get_supabase_client()

    # Get the meeting
    meeting_result = (
        supabase.table("meetings")
        .select("*")
        .eq("id", meeting_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not meeting_result.data:
        return []

    meeting = meeting_result.data[0]
    meeting_date = _parse_date(meeting.get("meeting_date"))

    if not meeting_date:
        # If no meeting date, return all unlinked events for the user
        events_result = (
            supabase.table("calendar_events")
            .select("*")
            .eq("user_id", user_id)
            .is_("meeting_id", "null")
            .execute()
        )
    else:
        # Find events within +/- 1 day
        date_min = (meeting_date - timedelta(days=1)).isoformat()
        date_max = (meeting_date + timedelta(days=2)).isoformat()  # +2 to include end of day+1

        events_result = (
            supabase.table("calendar_events")
            .select("*")
            .eq("user_id", user_id)
            .gte("start_time", date_min)
            .lt("start_time", date_max)
            .execute()
        )

    # Score each event
    scored = []
    for event in events_result.data:
        match_score, match_reasons = compute_match_score(meeting, event)
        if match_score >= 0.5:
            scored.append({
                "calendar_event_id": event["id"],
                "event_title": event.get("title", "Untitled"),
                "event_date": event.get("start_time", ""),
                "score": match_score,
                "match_reasons": match_reasons,
            })

    # Sort by score descending and return top 5
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:5]


async def link_meeting_to_event(
    meeting_id: str, calendar_event_id: str, user_id: str
) -> None:
    """Link a meeting to a calendar event by updating both FK references."""
    supabase = get_supabase_client()

    supabase.table("meetings").update(
        {"calendar_event_id": calendar_event_id}
    ).eq("id", meeting_id).eq("user_id", user_id).execute()

    supabase.table("calendar_events").update(
        {"meeting_id": meeting_id}
    ).eq("id", calendar_event_id).eq("user_id", user_id).execute()

    logger.info(
        "Linked meeting %s to calendar event %s", meeting_id, calendar_event_id
    )


async def unlink_meeting_from_event(meeting_id: str, user_id: str) -> None:
    """Unlink a meeting from its calendar event by clearing both FK references."""
    supabase = get_supabase_client()

    # Get the current calendar_event_id from the meeting
    meeting_result = (
        supabase.table("meetings")
        .select("calendar_event_id")
        .eq("id", meeting_id)
        .eq("user_id", user_id)
        .execute()
    )

    if meeting_result.data and meeting_result.data[0].get("calendar_event_id"):
        calendar_event_id = meeting_result.data[0]["calendar_event_id"]

        supabase.table("calendar_events").update(
            {"meeting_id": None}
        ).eq("id", calendar_event_id).eq("user_id", user_id).execute()

    supabase.table("meetings").update(
        {"calendar_event_id": None}
    ).eq("id", meeting_id).eq("user_id", user_id).execute()

    logger.info("Unlinked meeting %s from calendar event", meeting_id)


def _parse_date(date_str: str | None) -> datetime | None:
    """Parse a date/datetime string into a date object.

    Handles ISO format strings with or without timezone info.
    Returns a datetime (date-only part) or None if parsing fails.
    """
    if not date_str:
        return None

    try:
        # Handle ISO format with timezone
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.replace(hour=0, minute=0, second=0, microsecond=0)
    except (ValueError, AttributeError):
        pass

    try:
        # Handle plain date format
        return datetime.strptime(date_str[:10], "%Y-%m-%d")
    except (ValueError, AttributeError):
        return None
