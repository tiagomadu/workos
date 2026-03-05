"""WorkOS API — FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import setup_logging
from app.api.v1.health import router as health_router
from app.api.v1.meetings import router as meetings_router
from app.api.v1.people import router as people_router
from app.api.v1.teams import router as teams_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.projects import router as projects_router
from app.api.v1.search import router as search_router
from app.api.v1.dashboard import router as dashboard_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup and shutdown events."""
    setup_logging()
    logger.info("WorkOS API starting up (LLM provider: %s)", settings.LLM_PROVIDER)
    yield
    logger.info("WorkOS API shutting down")


app = FastAPI(
    title="WorkOS API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health_router, prefix="/api/v1")
app.include_router(meetings_router)
app.include_router(people_router, prefix="/api/v1")
app.include_router(teams_router, prefix="/api/v1")
app.include_router(tasks_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(search_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
