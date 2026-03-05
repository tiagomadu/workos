"""Calendar integration endpoints — Google OAuth, sync, and event matching."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.config import settings
from app.core.google_oauth import (
    get_google_auth_url,
    exchange_code_for_tokens,
    store_tokens,
    revoke_token,
    get_google_user_email,
)
from app.core.supabase import get_supabase_client
from app.models.calendar import (
    CalendarEventResponse,
    CalendarSyncResponse,
    GoogleConnectionStatus,
    CalendarMatchSuggestion,
    LinkCalendarEventRequest,
    GoogleCallbackRequest,
)
from app.services.calendar_sync import (
    sync_calendar_events,
    get_calendar_events,
    get_upcoming_events,
)
from app.services.calendar_match import (
    find_matching_events,
    link_meeting_to_event,
    unlink_meeting_from_event,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/auth-url")
async def get_auth_url(
    user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """Return the Google OAuth 2.0 authorization URL."""
    url = get_google_auth_url(redirect_uri=settings.GOOGLE_REDIRECT_URI)
    return {"url": url}


@router.post("/callback")
async def google_callback(
    body: GoogleCallbackRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """Exchange an authorization code for tokens and store them."""
    try:
        tokens = await exchange_code_for_tokens(
            code=body.code,
            redirect_uri=settings.GOOGLE_REDIRECT_URI,
        )
    except Exception as e:
        logger.error("Failed to exchange Google auth code: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange authorization code",
        )

    await store_tokens(user_id=user.id, tokens=tokens)

    return {"status": "connected"}


@router.get("/status", response_model=GoogleConnectionStatus)
async def get_connection_status(
    user: AuthenticatedUser = Depends(get_current_user),
) -> GoogleConnectionStatus:
    """Check whether the user has a connected Google account."""
    supabase = get_supabase_client()
    result = (
        supabase.table("user_google_tokens")
        .select("*")
        .eq("user_id", user.id)
        .execute()
    )

    if not result.data:
        return GoogleConnectionStatus(connected=False)

    token_row = result.data[0]

    # Get last sync time from calendar_events
    sync_result = (
        supabase.table("calendar_events")
        .select("synced_at")
        .eq("user_id", user.id)
        .order("synced_at", desc=True)
        .limit(1)
        .execute()
    )
    last_synced = sync_result.data[0]["synced_at"] if sync_result.data else None

    # Try to get user email
    email = None
    try:
        email = await get_google_user_email(token_row["access_token"])
    except Exception:
        pass

    return GoogleConnectionStatus(
        connected=True,
        email=email,
        last_synced=last_synced,
        scopes=token_row.get("scopes"),
    )


@router.post("/disconnect")
async def disconnect_google(
    user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """Disconnect Google account by revoking and deleting tokens."""
    await revoke_token(user_id=user.id)
    return {"status": "disconnected"}


@router.post("/sync", response_model=CalendarSyncResponse)
async def trigger_sync(
    user: AuthenticatedUser = Depends(get_current_user),
) -> CalendarSyncResponse:
    """Trigger a calendar sync with Google Calendar."""
    try:
        events_synced = await sync_calendar_events(user_id=user.id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Calendar sync failed for user %s: %s", user.id, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Calendar sync failed",
        )

    return CalendarSyncResponse(
        events_synced=events_synced,
        last_synced=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/events", response_model=list[CalendarEventResponse])
async def list_events(
    user: AuthenticatedUser = Depends(get_current_user),
) -> list[CalendarEventResponse]:
    """Get all synced calendar events for the current user."""
    events = await get_calendar_events(user_id=user.id)
    return [CalendarEventResponse(**e) for e in events]


@router.get("/events/upcoming", response_model=list[CalendarEventResponse])
async def list_upcoming_events(
    user: AuthenticatedUser = Depends(get_current_user),
) -> list[CalendarEventResponse]:
    """Get upcoming calendar events for the dashboard."""
    events = await get_upcoming_events(user_id=user.id)
    return [CalendarEventResponse(**e) for e in events]


@router.get("/match/{meeting_id}", response_model=list[CalendarMatchSuggestion])
async def get_match_suggestions(
    meeting_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> list[CalendarMatchSuggestion]:
    """Get calendar event match suggestions for a meeting."""
    matches = await find_matching_events(
        meeting_id=meeting_id,
        user_id=user.id,
    )
    return [CalendarMatchSuggestion(**m) for m in matches]


@router.post("/link/{meeting_id}")
async def link_event(
    meeting_id: str,
    body: LinkCalendarEventRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """Link a meeting to a calendar event."""
    if not body.calendar_event_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="calendar_event_id is required",
        )

    await link_meeting_to_event(
        meeting_id=meeting_id,
        calendar_event_id=body.calendar_event_id,
        user_id=user.id,
    )
    return {"status": "linked"}


@router.post("/unlink/{meeting_id}")
async def unlink_event(
    meeting_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """Unlink a meeting from its calendar event."""
    await unlink_meeting_from_event(
        meeting_id=meeting_id,
        user_id=user.id,
    )
    return {"status": "unlinked"}
