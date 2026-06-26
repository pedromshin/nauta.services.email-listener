"""Cached Supabase client factory.

Reads SUPABASE_URL (plain env var) and SUPABASE_SECRET_KEY (new-format
sb_secret_... key injected by ECS from AWS Secrets Manager).

Raises RuntimeError at startup if either is missing — fail-closed (D-04).
Never logs or exposes the secret key value.
"""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.settings import get_settings


@lru_cache
def get_supabase_client() -> Client:
    """Return a cached Supabase client.

    Raises:
        RuntimeError: If SUPABASE_URL or SUPABASE_SECRET_KEY is not configured.
    """
    settings = get_settings()
    url = settings.supabase_url
    key = settings.supabase_secret_key

    if not url:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SECRET_KEY are required — SUPABASE_URL is missing")
    if not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SECRET_KEY are required — SUPABASE_SECRET_KEY is missing")

    return create_client(url, key)
