"""Supabase client factory for server-side operations."""

from supabase import create_client, Client
from app.core.config import settings

_client: Client | None = None


def get_supabase_client() -> Client:
    """Get or create the Supabase service-role client.

    Uses the service role key for server-side operations like
    storage uploads and admin queries. Do NOT use for user-scoped
    queries — those go through JWT-authenticated RLS.
    """
    global _client
    if _client is None:
        _client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
    return _client
