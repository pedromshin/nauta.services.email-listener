"""Additive, non-enforcing X-User-Id extraction (Phase 44 enforcement seam).

Trust model: FastAPI is reachable only server-to-server through the
authenticated BFF (Next.js) — see `require_api_key` in `auth.py`, which this
module MUST NOT touch. The `X-User-Id` header value is trusted because it was
computed server-side by the trusted Next.js process from a server-verified
Supabase session (`supabase.auth.getUser()`), never from a client-suppliable
field (Phase 43 Plan 04, T-43-P4-01/03).

ENFORCEMENT (rejecting requests with a missing/mismatched user id, or scoping
queries by it) is explicitly Phase 44 scope (T-43-P4-04, accepted). This
dependency only SURFACES the id for logging/Phase-44 wiring — it never raises
and never rejects a request, so it is safe to add to any route today without
changing that route's behavior.
"""

from __future__ import annotations

from fastapi import Request

USER_ID_HEADER = "X-User-Id"


async def extract_user_id(request: Request) -> str | None:
    """Return the caller-asserted user id from the trusted BFF, or None.

    Non-enforcing by design: a missing or empty header is not an error.
    """
    return request.headers.get(USER_ID_HEADER) or None
