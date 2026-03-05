"""Supabase Storage operations for transcript management."""

import logging
from datetime import datetime, timezone

from app.core.supabase import get_supabase_client

logger = logging.getLogger(__name__)


async def upload_transcript(user_id: str, filename: str, content: bytes) -> str:
    """Upload transcript to Supabase Storage. Returns storage path (never signed URL)."""
    now = datetime.now(timezone.utc)
    path = f"{user_id}/{now.year}/{now.month:02d}/{now.strftime('%Y-%m-%d')}_{filename}"
    supabase = get_supabase_client()
    supabase.storage.from_("transcripts").upload(
        path, content, {"content-type": "text/plain", "upsert": "true"}
    )
    return path


async def get_transcript_url(storage_path: str, expires_in: int = 900) -> str:
    """Generate a signed URL valid for the given duration."""
    supabase = get_supabase_client()
    result = supabase.storage.from_("transcripts").create_signed_url(
        storage_path, expires_in
    )
    return result["signedURL"]


async def create_meeting_record(
    user_id: str,
    transcript_path: str,
    raw_transcript: str,
    title: str | None,
    meeting_date: str | None,
) -> str:
    """Insert meeting record into DB. Returns meeting UUID."""
    supabase = get_supabase_client()
    data = {
        "user_id": user_id,
        "transcript_path": transcript_path,
        "transcript_text": raw_transcript,
        "status": "uploaded",
        "title": title or "Untitled Meeting",
    }
    if meeting_date:
        data["meeting_date"] = meeting_date
    result = supabase.table("meetings").insert(data).execute()
    return result.data[0]["id"]


async def update_meeting_status(
    meeting_id: str,
    status: str,
    processing_step: str | None = None,
    error_message: str | None = None,
) -> None:
    """Update meeting processing status.

    status must be one of: uploaded, processing, completed, failed.
    processing_step holds the granular sub-step (e.g. detecting_type).
    """
    supabase = get_supabase_client()
    data: dict = {"status": status}
    if processing_step is not None:
        data["processing_step"] = processing_step
    if error_message:
        data["error_message"] = error_message
    if status == "completed":
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        data["processing_step"] = None  # clear step on completion
    supabase.table("meetings").update(data).eq("id", meeting_id).execute()


async def get_meeting(meeting_id: str, user_id: str) -> dict | None:
    """Fetch a meeting by ID scoped to user_id."""
    supabase = get_supabase_client()
    result = (
        supabase.table("meetings")
        .select("*")
        .eq("id", meeting_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None
