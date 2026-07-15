"""SupabaseChatContextEdgeRepository -- implements ChatContextEdgeRepository port.

Reads chat_context_edges rows (Phase 56-04, RCNV-04): the linked-context
injection pipeline's ONE read collaborator. Read-only -- writes
(createContextEdge/removeContextEdge) live in packages/api-client's tRPC
router (56-03), never here. Follows the source_ledger_repository.py adapter
idiom -- a module-level `_row_to_edge` builder, `table().select()` call
shape -- and the fail-open try/except-then-[] posture
`SupabaseKnowledgeGraphRepository.list_captured_sources_for_conversations`
already established, since migration 0037 may be unapplied in this
environment (feature-detect via degrade, not a separate existence probe).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, cast

from supabase import Client

from app.domain.ports.chat_context_edge_repository import ContextEdge

if TYPE_CHECKING:
    from collections.abc import Sequence

logger = logging.getLogger(__name__)

_TABLE = "chat_context_edges"


def _row_to_edge(row: dict[str, Any]) -> ContextEdge:
    return ContextEdge(
        id=str(row["id"]),
        target_conversation_id=str(row["target_conversation_id"]),
        source_ref=cast("dict[str, object]", row.get("source_ref") or {}),
        source_ref_key=str(row.get("source_ref_key") or ""),
        is_active=bool(row.get("is_active", True)),
    )


class SupabaseChatContextEdgeRepository:
    """Supabase implementation of ChatContextEdgeRepository (chat_context_edges).

    Tenant isolation: ownership is enforced at WRITE time (56-03's
    assertSourceRefOwnership) -- this read trusts already-ownership-gated
    stored rows scoped by target_conversation_id (Landmine 2 / T-56-04-02).
    RunChatTurn has no live per-request user identity to re-verify against
    (only importer_id, resolved from settings), so re-checking ownership
    here is structurally impossible -- by design, per 56-RESEARCH.md.
    """

    def __init__(self, client: Client) -> None:
        self._client = client

    async def list_active_context_edges(self, conversation_id: str) -> Sequence[ContextEdge]:
        """Return active edges targeting conversation_id; [] on any failure (incl. unapplied migration 0037)."""
        try:
            result = (
                self._client.table(_TABLE)
                .select("*")
                .eq("target_conversation_id", conversation_id)
                .eq("is_active", True)
                .execute()
            )
        except Exception:
            logger.warning(
                "chat_context_edge_read_failed",
                extra={"conversation_id": conversation_id},
            )
            return []
        rows = cast("list[dict[str, Any]]", result.data or [])
        return [_row_to_edge(row) for row in rows]
