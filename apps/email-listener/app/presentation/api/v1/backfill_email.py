"""POST /v1/emails/backfill — ingest one caller-supplied raw email (backfill).

Transport for historical mail that never traversed SES (Gmail import, mbox
replay). Runs the FULL standard ingestion pipeline via
BackfillInboundEmailUseCase — identical enrichment to the SNS path.

Auth is CAPABILITY-BASED, not a shared infra secret: the request must carry a
forwarding recipient (``u-{token}@domain``) whose token resolves, against the
listener's own DB, to a real user. That forwarding token is a 256-bit CSPRNG
per-user secret — the SAME capability that authorizes real inbound mail for
the account (anyone who can email ``u-{token}@`` can already cause ingestion
into that user). So possession of the token is exactly the right authorization
for a backfill into that user's corpus, and it can never write into any other
account. An unknown/absent token fails closed (401). This deliberately avoids
depending on EMAIL_LISTENER_API_KEY / SUPABASE_SECRET_KEY at the boundary.

NOTE: no `from __future__ import annotations` here — the generic
ApiResponse[BackfillEmailAck] return annotation must be a real type at runtime
for FastAPI/pydantic response-model resolution (mirrors inbound_email.py).
"""

import base64
import binascii

import structlog
from dishka.integrations.fastapi import FromDishka, inject
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.application.use_cases.backfill_inbound_email import (
    BackfillInboundEmailUseCase,
    InvalidBackfillIdError,
)
from app.domain.ports.forwarding_address_resolver import ForwardingAddressResolver
from app.presentation.api.response import ApiResponse

logger = structlog.get_logger(__name__)

MAX_RAW_MIME_BYTES = 10 * 1024 * 1024  # decoded MIME cap, mirrors inbound_email.py

router = APIRouter(prefix="/v1/emails", tags=["emails-backfill"])


class BackfillEmailIn(BaseModel):
    """Validated backfill payload — system boundary."""

    backfill_id: str = Field(min_length=1, max_length=200)
    raw_mime_b64: str = Field(min_length=1)
    # At least one recipient is required: it carries the forwarding token that
    # both authorizes the request and anchors user attribution.
    recipients: list[str] = Field(min_length=1)


class BackfillEmailAck(BaseModel):
    email_id: str
    message_id: str
    thread_id: str | None
    parse_status: str
    parse_error: str | None


@router.post("/backfill", status_code=200)
@inject
async def backfill_email(
    payload: BackfillEmailIn,
    use_case: FromDishka[BackfillInboundEmailUseCase],
    forwarding_resolver: FromDishka[ForwardingAddressResolver],
) -> ApiResponse[BackfillEmailAck]:
    """Ingest one backfilled raw email through the standard pipeline (synchronous).

    Authorization: at least one recipient must be a forwarding address whose
    token resolves to a real user. Fail-closed (401) otherwise — mirrors the
    forwarding-token trust model of the live SNS path.
    """
    owner_user_id = await forwarding_resolver.resolve_recipients(payload.recipients)
    if owner_user_id is None:
        raise HTTPException(status_code=401, detail="No recipient resolves to a known forwarding token")

    try:
        raw = base64.b64decode(payload.raw_mime_b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail="raw_mime_b64 is not valid base64") from exc
    if len(raw) > MAX_RAW_MIME_BYTES:
        raise HTTPException(status_code=413, detail="Decoded MIME too large")

    try:
        email = await use_case.execute(
            backfill_id=payload.backfill_id,
            raw_mime=raw,
            recipients=payload.recipients,
        )
    except InvalidBackfillIdError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return ApiResponse.ok(
        BackfillEmailAck(
            email_id=email.id,
            message_id=email.message_id,
            thread_id=email.thread_id,
            parse_status=email.parse_status,
            parse_error=email.parse_error,
        )
    )
