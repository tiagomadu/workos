"""Search API endpoints."""

from fastapi import APIRouter, Depends, Query

from app.core.auth import AuthenticatedUser, get_current_user
from app.services.search import search_meetings

router = APIRouter(tags=["search"])


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    date_from: str = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: str = Query(None, description="Filter to date (YYYY-MM-DD)"),
    meeting_type: str = Query(None, description="Filter by meeting type"),
    limit: int = Query(10, ge=1, le=50, description="Max results"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Search meetings using natural language query with RAG."""
    result = await search_meetings(
        query=q,
        user_id=user.id,
        date_from=date_from,
        date_to=date_to,
        meeting_type=meeting_type,
        limit=limit,
    )
    return result
