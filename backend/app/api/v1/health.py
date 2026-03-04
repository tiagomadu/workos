"""Health check endpoint."""

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Check API health and report active LLM provider."""
    return {
        "status": "ok",
        "llm_provider": settings.LLM_PROVIDER,
    }
