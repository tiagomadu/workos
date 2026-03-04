"""Shared test fixtures."""

import os

# Set required environment variables BEFORE any app imports.
# Settings() is instantiated at module level in config.py, so these
# must be in os.environ before the first import of app code.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-minimum-32-chars!")

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import AuthenticatedUser, get_current_user
from app.ai.provider import LLMProvider
from app.ai.schemas import (
    MeetingSummary,
    ActionItemsResult,
    ExtractedActionItem,
    MeetingTypeResult,
)
from app.ai.factory import get_llm_provider
from app.main import app


class MockLLMProvider:
    async def generate_structured(self, messages, response_model, model=None, max_retries=2):
        name = response_model.__name__
        if name == "MeetingSummary":
            return MeetingSummary(
                overview="Test summary of the meeting.",
                key_topics=["Q4 planning", "API migration"],
                decisions=["Remove analytics dashboard"],
                follow_ups=["Draft timeline by Friday"],
            )
        elif name == "ActionItemsResult":
            return ActionItemsResult(
                action_items=[
                    ExtractedActionItem(
                        description="Draft timeline",
                        owner_name="Bob",
                        due_date="2026-03-11",
                    ),
                    ExtractedActionItem(
                        description="Update project plan",
                        owner_name="Bob",
                        due_date=None,
                    ),
                ]
            )
        elif name == "MeetingTypeResult":
            return MeetingTypeResult(meeting_type="team_huddle", confidence="high")
        raise ValueError(f"Unknown response model: {name}")

    async def health_check(self):
        return True


@pytest.fixture
def mock_user() -> AuthenticatedUser:
    """Create a mock authenticated user."""
    return AuthenticatedUser(
        id="test-user-id",
        email="test@example.com",
        role="authenticated",
    )


@pytest.fixture
def mock_llm_provider():
    """Create a mock LLM provider for testing."""
    return MockLLMProvider()


@pytest.fixture
async def client(mock_user: AuthenticatedUser) -> AsyncClient:
    """Create an async test client with mocked auth and LLM provider."""

    async def override_auth() -> AuthenticatedUser:
        return mock_user

    app.dependency_overrides[get_current_user] = override_auth
    app.dependency_overrides[get_llm_provider] = MockLLMProvider

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
