"""API-key authentication dependency.

In development with no API_KEY configured, auth is bypassed for local testing.
In staging/production an empty API_KEY fails closed (all requests rejected).
"""

from __future__ import annotations

import secrets

from fastapi import HTTPException, Request

from app.settings import Environment, get_settings


async def require_api_key(request: Request) -> None:
    settings = get_settings()
    expected = settings.api_key

    if not expected:
        if settings.ENVIRONMENT is Environment.DEVELOPMENT:
            return
        raise HTTPException(status_code=503, detail="Service misconfigured")

    provided = request.headers.get(settings.API_KEY_HEADER, "")
    if not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
