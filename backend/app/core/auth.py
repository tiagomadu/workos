"""JWT authentication middleware for Supabase tokens."""

import logging
from typing import Annotated

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer()

# Lazy-initialised JWKS client (fetches Supabase public keys for ES256)
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


class AuthenticatedUser(BaseModel):
    """Authenticated user data extracted from JWT."""

    id: str
    email: str
    role: str


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> AuthenticatedUser:
    """Validate Supabase JWT and extract user information.

    Supports both new ECC/ES256 signing keys (via JWKS) and
    legacy HS256 shared-secret tokens.
    CRITICAL: audience="authenticated" must be set — without it,
    Supabase tokens fail silently.
    """
    token = credentials.credentials

    # --- Try 1: JWKS-based verification (ES256 / new Supabase keys) --------
    try:
        jwks_client = _get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
        )
        return AuthenticatedUser(
            id=payload.get("sub", ""),
            email=payload.get("email", ""),
            role=payload.get("role", "authenticated"),
        )
    except Exception as jwks_err:
        logger.debug("JWKS verification failed, trying HS256 fallback: %s", jwks_err)

    # --- Try 2: Legacy HS256 shared secret ----------------------------------
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        logger.warning("Expired JWT token received")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        logger.warning("Invalid JWT token: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    return AuthenticatedUser(
        id=payload.get("sub", ""),
        email=payload.get("email", ""),
        role=payload.get("role", "authenticated"),
    )
