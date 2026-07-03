"""GET /v1/chat/models — curated multi-provider chat model registry endpoint (D-04..D-06).

Serves CHAT_MODEL_REGISTRY (chat_model_registry.py) so the client picker
surfaces transport, execution locus, per-Mtok pricing and capability flags
honestly — the GenUI tool is only ever offered to models flagged reliable
for it (D-05).

Note: Intentionally omits 'from __future__ import annotations'. FastAPI/Pydantic v2
needs concrete types at route registration time to build response serializers
(see genui.py for the same note — PEP 563 deferred annotations break
ApiResponse[ChatModelsView] resolution at runtime).
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.domain.services.chat_model_registry import CHAT_MODEL_REGISTRY, chat_registry_version
from app.presentation.api.response import ApiResponse
from app.presentation.middleware.auth import require_api_key

router = APIRouter(
    prefix="/v1/chat",
    tags=["chat"],
    dependencies=[Depends(require_api_key)],
)


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class ChatModelCapabilitiesView(BaseModel):
    """Serialized ChatModelCapabilities."""

    tools: bool
    genui: bool
    streaming: bool
    context_tokens: int


class ChatModelView(BaseModel):
    """Serialized ChatModel registry entry."""

    id: str
    display_name: str
    transport: str
    execution_locus: str
    price_in_per_mtok: float
    price_out_per_mtok: float
    capabilities: ChatModelCapabilitiesView
    best_for: str


class ChatModelsView(BaseModel):
    """Response payload for GET /v1/chat/models — the full curated registry."""

    registry_version: str
    models: list[ChatModelView]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.get("/models")
async def list_chat_models() -> ApiResponse[ChatModelsView]:
    """Return the curated chat model registry the picker renders (D-04..D-06).

    Static, in-process data (no DB/network round-trip) — no DI/use-case layer
    needed. registry_version lets the client detect a stale cached picker.
    """
    models = [
        ChatModelView(
            id=model.id,
            display_name=model.display_name,
            transport=model.transport,
            execution_locus=model.execution_locus,
            price_in_per_mtok=model.price_in_per_mtok,
            price_out_per_mtok=model.price_out_per_mtok,
            capabilities=ChatModelCapabilitiesView(
                tools=model.capabilities.tools,
                genui=model.capabilities.genui,
                streaming=model.capabilities.streaming,
                context_tokens=model.capabilities.context_tokens,
            ),
            best_for=model.best_for,
        )
        for model in CHAT_MODEL_REGISTRY
    ]
    return ApiResponse.ok(ChatModelsView(registry_version=chat_registry_version(), models=models))
