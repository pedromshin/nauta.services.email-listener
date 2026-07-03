"""Chat streaming endpoints — POST /v1/chat/stream + POST /v1/chat/regenerate (STREAM-01, D-24).

Thin FastAPI SSE transport wrapping RunChatTurn.run()/.regenerate() (Phase 22-06):
serializes each yielded ChatRunEvent as one `data: {json}` frame over
text/event-stream. A client disconnect cancels the underlying agent task so
RunChatTurn's own `except asyncio.CancelledError` handler persists the partial
as 'stopped' (D-15/D-25/T-22-27) — this transport never swallows the
cancellation into a fake 'completed'.

Security (T-22-24..T-22-28):
  - X-API-Key auth: require_api_key router dependency, fail-closed (401
    without a valid key; no stream body — dependencies run before the
    endpoint body).
  - Request bodies are Pydantic-validated (conversation_id/assistant_message_id
    must be UUIDs, user_text length-bounded).
  - The emit_ui_spec spec JSON is untrusted model output — passed through
    verbatim in run events; validated at the web boundary, not here (FOUND-6).

Note: Intentionally omits 'from __future__ import annotations' — matches
genui.py/genui_code.py/chat_models.py (FastAPI/Pydantic v2 needs concrete
types at route registration time to build response serializers).
"""

import asyncio
import contextlib
import json
import uuid
from collections.abc import AsyncIterator

import structlog
from dishka.integrations.fastapi import FromDishka, inject
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app.application.use_cases.run_chat_turn import RunChatTurn
from app.domain.ports.chat_repositories import ChatRunEvent
from app.presentation.middleware.auth import require_api_key

logger = structlog.get_logger(__name__)

router = APIRouter(
    prefix="/v1/chat",
    tags=["chat"],
    dependencies=[Depends(require_api_key)],
)

_USER_TEXT_MAX_LEN = 8_000
# How often stream_run_events checks request.is_disconnected() while waiting on
# the agent's next event. Short enough to detect a real disconnect quickly;
# long enough that it never fires during normal (much faster) event production.
_DISCONNECT_POLL_SECONDS = 0.1


def _require_uuid(value: str) -> str:
    try:
        uuid.UUID(value)
    except ValueError as exc:
        raise ValueError(f"{value!r} is not a valid UUID") from exc
    return value


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class ChatStreamRequest(BaseModel):
    """Request body for POST /v1/chat/stream."""

    conversation_id: str = Field(..., description="UUID of the conversation this turn belongs to.")
    user_text: str = Field(..., min_length=1, max_length=_USER_TEXT_MAX_LEN)
    model_id: str = Field(..., min_length=1, description="Curated CHAT_MODEL_REGISTRY model id.")

    @field_validator("conversation_id")
    @classmethod
    def _validate_conversation_id(cls, v: str) -> str:
        return _require_uuid(v)


class ChatRegenerateRequest(BaseModel):
    """Request body for POST /v1/chat/regenerate."""

    conversation_id: str = Field(..., description="UUID of the conversation this turn belongs to.")
    assistant_message_id: str = Field(..., description="UUID of the assistant message to regenerate.")
    model_id: str = Field(..., min_length=1, description="Curated CHAT_MODEL_REGISTRY model id.")

    @field_validator("conversation_id", "assistant_message_id")
    @classmethod
    def _validate_ids(cls, v: str) -> str:
        return _require_uuid(v)


# ---------------------------------------------------------------------------
# SSE serialization + client-disconnect cancellation
# ---------------------------------------------------------------------------


def _format_sse_event(event: ChatRunEvent) -> str:
    """One SSE `data:` frame per run event (JSON-serialized)."""
    payload = json.dumps({"type": event.type, "seq": event.seq, "data": event.data}, ensure_ascii=False)
    return f"data: {payload}\n\n"


async def stream_run_events(
    request: Request,
    events: AsyncIterator[ChatRunEvent],
) -> AsyncIterator[str]:
    """Serialize ChatRunEvents as SSE frames; cancel the run task on client disconnect.

    `events` is consumed via a background asyncio.Task so a detected disconnect
    can `task.cancel()` it — this raises CancelledError INSIDE the agent's
    current await point, which RunChatTurn._execute_turn's own
    `except asyncio.CancelledError` handler turns into a persisted 'stopped'
    partial (D-15/D-25/T-22-27). Simply closing the async generator (aclose())
    would raise GeneratorExit instead, which that handler does not catch —
    real task cancellation is required for the stopped-partial path to run.
    """
    pending: asyncio.Task[ChatRunEvent] = asyncio.ensure_future(events.__anext__())
    try:
        while True:
            done, _pending_set = await asyncio.wait({pending}, timeout=_DISCONNECT_POLL_SECONDS)
            if pending in done:
                try:
                    event = pending.result()
                except StopAsyncIteration:
                    return
                yield _format_sse_event(event)
                pending = asyncio.ensure_future(events.__anext__())
                continue
            if await request.is_disconnected():
                pending.cancel()
                with contextlib.suppress(BaseException):
                    await pending
                return
    finally:
        if not pending.done():
            pending.cancel()


_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/stream")
@inject
async def stream_chat(
    body: ChatStreamRequest,
    request: Request,
    use_case: FromDishka[RunChatTurn],
) -> StreamingResponse:
    """Stream one chat turn's run events over text/event-stream (STREAM-01)."""
    events = use_case.run(conversation_id=body.conversation_id, user_text=body.user_text, model_id=body.model_id)
    return StreamingResponse(
        stream_run_events(request, events),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/regenerate")
@inject
async def regenerate_chat(
    body: ChatRegenerateRequest,
    request: Request,
    use_case: FromDishka[RunChatTurn],
) -> StreamingResponse:
    """Stream a NEW sibling run regenerating an assistant turn (CHAT-04, D-16)."""
    events = use_case.regenerate(
        conversation_id=body.conversation_id,
        assistant_message_id=body.assistant_message_id,
        model_id=body.model_id,
    )
    return StreamingResponse(
        stream_run_events(request, events),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
