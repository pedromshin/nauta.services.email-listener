"""ChatContextEdgeRepository port -- domain abstraction over chat_context_edges reads.

Backs RCNV-04's read/inject pipeline (Phase 56-04): the SECOND, independent
fail-open read `RunChatTurn._execute_turn` performs at turn time to resolve a
conversation's active `chat_context_edges` rows into injectable content --
alongside (never nested inside) the existing thread/cluster context pipeline
(56-RESEARCH.md Pattern 3).

READ-ONLY by design: edge writes (`createContextEdge`/`removeContextEdge`)
live entirely in packages/api-client's tRPC router (Phase 56-03,
`assertSourceRefOwnership`) -- the Python side never writes
chat_context_edges. Ownership is enforced at WRITE time; this port's one
read trusts already-ownership-gated stored rows scoped by
target_conversation_id (Landmine 2 / T-56-04-02).

Plain dataclass/dict param+return types only -- the domain layer must not
import Supabase (verified by lint-imports rule).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from collections.abc import Sequence


@dataclass(frozen=True)
class ContextEdge:
    """One active chat_context_edges row.

    `source_ref` is the raw jsonb discriminated union dict authored in 56-01
    (`{"type": ..., ...}` -- one of source_ledger/knowledge_node/genui_panel/
    email_thread, see packages/db/src/schema/chat-context-edges.ts) --
    resolved to injectable text by RunChatTurn's per-type dispatch
    (`app.domain.services.linked_context`'s pure resolvers), never parsed
    here (this port stays a plain data carrier, no business logic).
    """

    id: str
    target_conversation_id: str
    source_ref: dict[str, object]
    source_ref_key: str
    is_active: bool


class ChatContextEdgeRepository(Protocol):
    """Port for reading active chat_context_edges rows (Phase 56-04, RCNV-04)."""

    async def list_active_context_edges(self, conversation_id: str) -> Sequence[ContextEdge]:
        """Return active edges targeting conversation_id (is_active=true).

        Fail-open -- implementations return [] on any read failure
        (including an unapplied migration 0037 table), never raise. Callers
        (RunChatTurn) additionally wrap this in their own fail-open guard
        (defense-in-depth, mirrors `_list_captured_sources`'s posture over
        `list_captured_sources_for_conversations`).
        """
        ...
