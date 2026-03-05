"""Dashboard endpoint returning aggregated metrics."""

from fastapi import APIRouter, Depends

from app.core.auth import AuthenticatedUser, get_current_user
from app.services.dashboard import get_dashboard_data

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
async def get_dashboard(
    user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """Return aggregated dashboard data for the authenticated user."""
    return await get_dashboard_data(user.id)
