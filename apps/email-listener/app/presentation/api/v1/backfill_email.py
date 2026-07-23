"""POST /v1/emails/backfill — ingest one caller-supplied raw email (backfill).

Transport for historical mail that never traversed SES (Gmail import, mbox
replay). Runs the FULL standard ingestion pipeline via
BackfillInboundEmailUseCase — identical enrichment to the SNS path.

Auth: HMAC request signing, NOT the X-API-Key gate. The backfill operator is
an offline tool that provably holds SUPABASE_SECRET_KEY (a secret this
service already receives from Secrets Manager), so the request carries
X-Backfill-Signature = hex(HMAC-SHA256(SUPABASE_SECRET_KEY, raw_request_body))
and the secret itself never travels on the wire (the prod ALB is plain HTTP
until the ACM cert lands — see infrastructure/aws/alb.tf). Replaying a
captured request can only re-ingest the exact same email (idempotent upsert),
so replay is harmless by construction.

NOTE: no `from __future__ import annotations` here — the generic
ApiResponse[BackfillEmailAck] return annotation must be a real type at
runtime for FastAPI/pydantic response-model resolution (mirrors
inbound_email.py).
"""

import base64
import binascii
import hashlib
import hmac

import structlog
from dishka.integrations.fastapi import FromDishka, inject
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.application.use_cases.backfill_inbound_email import (
    BackfillInboundEmailUseCase,
    InvalidBackfillIdError,
)
from app.presentation.api.response import ApiResponse
from app.settings import get_settings

logger = structlog.get_logger(__name__)

SIGNATURE_HEADER = "X-Backfill-Signature"

MAX_RAW_MIME_BYTES = 10 * 1024 * 1024  # decoded MIME cap, mirrors inbound_email.py
# base64 inflates ~4/3; allow envelope overhead on top of the encoded payload.
_MAX_BODY_BYTES = (MAX_RAW_MIME_BYTES * 4) // 3 + 64 * 1024


async def require_backfill_signature(request: Request) -> None:
    """401 unless the request body is HMAC-signed with SUPABASE_SECRET_KEY.

    Mirrors require_api_key's fail-closed posture: a missing server-side
    secret rejects everything (503) rather than admitting anyone.
    """
    secret = get_settings().supabase_secret_key
    if not secret:
        raise HTTPException(status_code=503, detail="Service misconfigured")

    provided = request.headers.get(SIGNATURE_HEADER, "")
    if not provided:
        raise HTTPException(status_code=401, detail="Missing signature")

    body = await request.body()
    if len(body) > _MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Body too large")

    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(provided.strip().lower(), expected):
        raise HTTPException(status_code=401, detail="Invalid signature")


router = APIRouter(
    prefix="/v1/emails",
    tags=["emails-backfill"],
    dependencies=[Depends(require_backfill_signature)],
)


class BackfillEmailIn(BaseModel):
    """Validated backfill payload — system boundary."""

    backfill_id: str = Field(min_length=1, max_length=200)
    raw_mime_b64: str = Field(min_length=1)
    recipients: list[str] = Field(default_factory=list)


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
) -> ApiResponse[BackfillEmailAck]:
    """Ingest one backfilled raw email through the standard pipeline (synchronous)."""
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
