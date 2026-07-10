"""POST /v1/chat/widget/submit — the DCUI-03 widget round-trip submit endpoint.

Thin FastAPI SSE transport wrapping SubmitWidgetInteraction.prepare() (Phase
24-02): every non-resume outcome (WidgetSubmitRejected: not_found/stale/
invalid/conflict) is resolved and mapped to a plain JSON HTTPException BEFORE
any StreamingResponse is constructed — a rejection never surfaces mid-stream
(T-24-02/T-24-03). A successful prepare() returns the (unstarted) continuation
async iterator, which this endpoint frames identically to /v1/chat/stream by
reusing chat_stream.py's `stream_run_events` helper (same disconnect-
cancellation loop, same `data: {...}` SSE framing) — the streaming loop is
written once.

Security (T-24-02..T-24-05):
  - X-API-Key auth: require_api_key router dependency, fail-closed (401
    without a valid key; no stream body — dependencies run before the
    endpoint body).
  - Request body is Pydantic-validated (conversation_id/interaction_id must
    be UUIDs, model_id non-empty, result a JSON object).
  - The submitted `result` is untrusted client input — SubmitWidgetInteraction
    re-validates it against the STORED declared_response_schema (D-10) before
    ever touching the DB lock or model context (FOUND-6 boundary).

Tenancy (Phase 44-09, TENA-03 gap closure): also requires X-User-Id
(require_user_id) and asserts the caller owns conversation_id
(assert_conversation_owned, imported from chat_stream.py — 404 fail-closed)
BEFORE the prepare() try-block, consistent with /stream and /regenerate. The
resolved user_id is also threaded into prepare() so the confirm_action
dispatch chain can finally enforce PromoteEdgeUseCase's 44-03 ownership guard.

Note: Intentionally omits 'from __future__ import annotations' — matches
chat_stream.py/genui.py/chat_models.py (FastAPI/Pydantic v2 needs concrete
types at route registration time to build response serializers).
"""

import uuid
from typing import Any

from dishka.integrations.fastapi import FromDishka, inject
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app.application.use_cases.submit_widget_interaction import (
    SubmitWidgetInteraction,
    WidgetSubmitRejected,
    WidgetSubmitRejectionReason,
)
from app.domain.ports.chat_repositories import ChatConversationRepository
from app.presentation.api.v1.chat_stream import assert_conversation_owned, stream_run_events
from app.presentation.middleware.auth import require_api_key
from app.presentation.middleware.user_context import require_user_id

router = APIRouter(
    prefix="/v1/chat",
    tags=["chat"],
    dependencies=[Depends(require_api_key)],
)

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}

# Every WidgetSubmitRejected reason maps to exactly one pre-stream HTTP status
# code (DCUI-03's three enforced guarantees + T-24-04 ownership).
_REJECTION_STATUS: dict[WidgetSubmitRejectionReason, int] = {
    "not_found": 404,
    "stale": 409,
    "invalid": 422,
    "conflict": 409,
}


def _require_uuid(value: str) -> str:
    try:
        uuid.UUID(value)
    except ValueError as exc:
        raise ValueError(f"{value!r} is not a valid UUID") from exc
    return value


class ChatWidgetSubmitRequest(BaseModel):
    """Request body for POST /v1/chat/widget/submit."""

    conversation_id: str = Field(..., description="UUID of the conversation this interaction belongs to.")
    interaction_id: str = Field(..., description="UUID of the chat_widget_interactions row being submitted.")
    model_id: str = Field(..., min_length=1, description="Curated CHAT_MODEL_REGISTRY model id for the continuation.")
    result: dict[str, Any] = Field(
        ..., description="Submitted structured result — re-validated server-side against the STORED schema (D-10)."
    )

    @field_validator("conversation_id", "interaction_id")
    @classmethod
    def _validate_ids(cls, v: str) -> str:
        return _require_uuid(v)


@router.post("/widget/submit")
@inject
async def submit_widget(
    body: ChatWidgetSubmitRequest,
    request: Request,
    use_case: FromDishka[SubmitWidgetInteraction],
    conversations: FromDishka[ChatConversationRepository],
    user_id: str = Depends(require_user_id),
) -> StreamingResponse:
    """Validate/lock/persist a widget submit, then stream the continuation turn (DCUI-03).

    Phase 44-09: rejects 401 (no X-User-Id) and 404 (non-owned
    conversation_id) BEFORE prepare() is ever called — see module docstring.
    prepare() then performs every remaining rejection check (interaction
    ownership/staleness/schema/CAS lock) BEFORE this handler ever constructs
    a StreamingResponse — a rejection always maps to a plain JSON
    HTTPException with no stream body.
    """
    await assert_conversation_owned(conversations, user_id, body.conversation_id)
    try:
        continuation = await use_case.prepare(
            conversation_id=body.conversation_id,
            interaction_id=body.interaction_id,
            result=body.result,
            model_id=body.model_id,
            user_id=user_id,
        )
    except WidgetSubmitRejected as exc:
        raise HTTPException(status_code=_REJECTION_STATUS[exc.reason], detail=exc.message or exc.reason) from exc

    return StreamingResponse(
        stream_run_events(request, continuation),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
