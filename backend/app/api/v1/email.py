"""Email integration endpoints — list, view, and import Gmail threads."""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.supabase import get_supabase_client
from app.models.email import (
    EmailImportResponse,
    GmailThread,
    GmailThreadDetail,
)
from app.services.email_service import (
    get_gmail_thread,
    import_email_as_meeting,
    list_gmail_threads,
)
from app.services.processing import process_meeting
from app.ai.provider import LLMProvider
from app.ai.factory import get_llm_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email", tags=["email"])


@router.get("/threads", response_model=list[GmailThread])
async def list_threads(
    max_results: int = Query(default=20, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user),
) -> list[GmailThread]:
    """List recent Gmail threads from the user's inbox."""
    try:
        threads = await list_gmail_threads(user_id=user.id, max_results=max_results)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to list Gmail threads for user %s: %s", user.id, str(e))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch Gmail threads",
        )

    return [GmailThread(**t) for t in threads]


@router.get("/threads/{thread_id}", response_model=GmailThreadDetail)
async def get_thread(
    thread_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> GmailThreadDetail:
    """Get the full content of a Gmail thread."""
    try:
        thread = await get_gmail_thread(user_id=user.id, thread_id=thread_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to get Gmail thread %s for user %s: %s",
            thread_id,
            user.id,
            str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch Gmail thread",
        )

    return GmailThreadDetail(**thread)


@router.post(
    "/threads/{thread_id}/import",
    response_model=EmailImportResponse,
    status_code=202,
)
async def import_thread(
    thread_id: str,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user),
    provider: LLMProvider = Depends(get_llm_provider),
) -> EmailImportResponse:
    """Import a Gmail thread as a meeting and trigger AI processing."""
    try:
        meeting_id = await import_email_as_meeting(user.id, thread_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to import Gmail thread %s for user %s: %s",
            thread_id,
            user.id,
            str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to import email thread",
        )

    # Fetch transcript for processing
    supabase = get_supabase_client()
    meeting = (
        supabase.table("meetings")
        .select("raw_transcript")
        .eq("id", meeting_id)
        .execute()
    )
    transcript_text = meeting.data[0]["raw_transcript"]

    # Trigger full AI pipeline in background
    background_tasks.add_task(
        process_meeting,
        meeting_id=meeting_id,
        transcript_text=transcript_text,
        provider=provider,
        user_id=user.id,
    )

    return EmailImportResponse(meeting_id=meeting_id, status="pending")
