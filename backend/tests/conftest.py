"""Shared test fixtures."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import AuthenticatedUser, get_current_user
from app.main import app


@pytest.fixture
def mock_user() -> AuthenticatedUser:
    """Create a mock authenticated user."""
    return AuthenticatedUser(
        id="test-user-id",
        email="test@example.com",
        role="authenticated",
    )


@pytest.fixture
async def client(mock_user: AuthenticatedUser) -> AsyncClient:
    """Create an async test client with mocked auth."""

    async def override_auth() -> AuthenticatedUser:
        return mock_user

    app.dependency_overrides[get_current_user] = override_auth

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
