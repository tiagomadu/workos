"""Tests for JWT authentication middleware."""

import pytest
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.core.config import settings


TEST_SECRET = "test-jwt-secret-minimum-32-chars!"


def make_token(
    sub: str = "test-user-id",
    email: str = "test@example.com",
    role: str = "authenticated",
    secret: str = TEST_SECRET,
    expired: bool = False,
) -> str:
    """Create a test JWT token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "email": email,
        "role": role,
        "aud": "authenticated",
        "iat": now,
        "exp": now + timedelta(hours=-1 if expired else 1),
    }
    return pyjwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture(autouse=True)
def set_test_secret(monkeypatch):
    """Set JWT secret for all auth tests."""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)


@pytest.mark.asyncio
async def test_valid_token_accepted():
    """A valid JWT with correct secret and audience is accepted."""
    token = make_token()
    # Clear any dependency overrides to test real auth
    app.dependency_overrides.clear()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        # We need a protected endpoint to test against
        # Use health endpoint — it doesn't require auth, so let's test
        # the auth module directly instead
        from app.core.auth import get_current_user
        from fastapi.security import HTTPAuthorizationCredentials

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        user = await get_current_user(creds)

    assert user.id == "test-user-id"
    assert user.email == "test@example.com"
    assert user.role == "authenticated"


@pytest.mark.asyncio
async def test_expired_token_rejected():
    """An expired JWT returns 401."""
    from app.core.auth import get_current_user
    from fastapi.security import HTTPAuthorizationCredentials
    from fastapi import HTTPException

    token = make_token(expired=True)
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(creds)

    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_wrong_secret_rejected():
    """A JWT signed with wrong secret returns 401."""
    from app.core.auth import get_current_user
    from fastapi.security import HTTPAuthorizationCredentials
    from fastapi import HTTPException

    token = make_token(secret="wrong-secret")
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(creds)

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_missing_token_returns_unauthorized():
    """A request without Authorization header returns 401 or 403."""
    app.dependency_overrides.clear()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        # Need a protected endpoint — let's create a temporary one
        from fastapi import APIRouter, Depends
        from app.core.auth import get_current_user, AuthenticatedUser

        test_router = APIRouter()

        @test_router.get("/api/v1/test-auth")
        async def test_endpoint(user: AuthenticatedUser = Depends(get_current_user)):
            return {"user_id": user.id}

        app.include_router(test_router)

        response = await client.get("/api/v1/test-auth")

    assert response.status_code in (401, 403)
