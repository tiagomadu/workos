"""Google OAuth 2.0 helper for Calendar + Gmail API access."""

import logging
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.core.supabase import get_supabase_client

logger = logging.getLogger(__name__)

GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/gmail.readonly",
]


def get_google_auth_url(redirect_uri: str) -> str:
    """Build Google OAuth 2.0 authorization URL.

    Requests offline access with consent prompt to ensure a refresh token
    is always returned.
    """
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"{GOOGLE_AUTH_BASE}?{urlencode(params)}"


async def exchange_code_for_tokens(code: str, redirect_uri: str) -> dict:
    """Exchange an authorization code for access and refresh tokens.

    Returns dict with: access_token, refresh_token, expires_in, scope.
    """
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data=data)
        resp.raise_for_status()
        return resp.json()


async def refresh_access_token(refresh_token: str) -> dict:
    """Refresh an expired access token using the stored refresh token.

    Returns dict with: access_token, expires_in.
    """
    data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data=data)
        resp.raise_for_status()
        return resp.json()


async def get_valid_token(user_id: str) -> str:
    """Fetch a valid access token for the user, auto-refreshing if expired.

    Raises HTTPException 401 if no token is stored.
    """
    from fastapi import HTTPException, status

    supabase = get_supabase_client()
    result = (
        supabase.table("user_google_tokens")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account not connected",
        )

    token_row = result.data[0]
    expires_at = datetime.fromisoformat(token_row["expires_at"].replace("Z", "+00:00"))

    # Refresh if expired or expiring within 5 minutes
    if expires_at <= datetime.now(timezone.utc) + timedelta(minutes=5):
        logger.info("Refreshing Google access token for user %s", user_id)
        new_tokens = await refresh_access_token(token_row["refresh_token"])
        new_expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=new_tokens["expires_in"]
        )

        supabase.table("user_google_tokens").update(
            {
                "access_token": new_tokens["access_token"],
                "expires_at": new_expires_at.isoformat(),
            }
        ).eq("user_id", user_id).execute()

        return new_tokens["access_token"]

    return token_row["access_token"]


async def store_tokens(user_id: str, tokens: dict) -> None:
    """Upsert Google OAuth tokens for a user."""
    supabase = get_supabase_client()
    expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=tokens.get("expires_in", 3600)
    )

    row = {
        "user_id": user_id,
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "expires_at": expires_at.isoformat(),
        "scopes": tokens.get("scope", ""),
    }

    supabase.table("user_google_tokens").upsert(
        row, on_conflict="user_id"
    ).execute()


async def revoke_token(user_id: str) -> None:
    """Delete stored tokens and optionally revoke with Google."""
    supabase = get_supabase_client()

    result = (
        supabase.table("user_google_tokens")
        .select("access_token")
        .eq("user_id", user_id)
        .execute()
    )

    if result.data:
        access_token = result.data[0]["access_token"]
        # Best-effort revoke with Google
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    GOOGLE_REVOKE_URL,
                    params={"token": access_token},
                )
        except Exception:
            logger.warning("Failed to revoke Google token for user %s", user_id)

    supabase.table("user_google_tokens").delete().eq("user_id", user_id).execute()


async def get_google_user_email(access_token: str) -> str | None:
    """Fetch the Google user's email address using the access token."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            return resp.json().get("email")
    except Exception:
        logger.warning("Failed to fetch Google user email")
        return None
