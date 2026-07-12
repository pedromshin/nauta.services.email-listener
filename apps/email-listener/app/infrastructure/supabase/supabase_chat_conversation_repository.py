"""SupabaseChatConversationRepository — chat_conversations reads/writes.

touch() is the turn loop's one write (D-10, D-12): a Rule 2 addition (not in
the 22-06 plan's literal files_modified list) so the turn loop can remember
the last-used model (D-10) and set the first-turn snippet title (D-12)
directly from Python, without a round-trip through the web-owned tRPC
conversation CRUD surface (22-05). See 22-06-SUMMARY.md.

owner_user_id() (Phase 44-09, TENA-03 gap closure) is a single-column read
backing the presentation-layer's fail-closed ownership gate
(assert_conversation_owned in chat_stream.py) — never a join.

get_thread_id()/list_by_thread_id() (Phase 54-05, CLUS-02/CLUS-06) read the
thread_id column migration 0036 adds — AUTHORED but APPLIED TO NO
ENVIRONMENT as of Phase 54-01's own run tonight. Both methods feature-detect
the column's absence (or ANY other read failure) by catching broadly and
returning the empty/None result — mirrors
packages/api-client/src/router/_column-detect.ts's tableColumnExists
fail-closed posture on the TS side, adapted here as a live-query try/except
(supabase-py's PostgREST transport has no direct information_schema probe;
catching the query's own failure IS the feature-detection point).

WR-06: supabase-py's Client is synchronous; every blocking call is offloaded
to a thread-pool worker via asyncio.to_thread().
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, cast

import structlog

from app.domain.ports.chat_repositories import ChatConversation

if TYPE_CHECKING:
    from supabase import Client

logger = structlog.get_logger(__name__)

_TABLE = "chat_conversations"


class SupabaseChatConversationRepository:
    """Supabase implementation of ChatConversationRepository over chat_conversations."""

    def __init__(self, *, client: Client) -> None:
        self._client = client

    async def touch(self, *, conversation_id: str, model_id: str, title: str | None = None) -> None:
        row: dict[str, Any] = {"model_id": model_id, "updated_at": datetime.now(UTC).isoformat()}
        if title is not None:
            row["title"] = title
        await asyncio.to_thread(lambda: self._client.table(_TABLE).update(row).eq("id", conversation_id).execute())

    async def owner_user_id(self, conversation_id: str) -> str | None:
        """Return the owning user_id for conversation_id, or None if the row does not exist.

        Single-column equality read on chat_conversations.user_id (NOT NULL,
        migrations 0031-0033) — never a join. A null column value (should
        never happen given the NOT NULL constraint, but treated defensively)
        also resolves to None — fail-closed/unowned rather than raising.
        """
        response = await asyncio.to_thread(
            lambda: self._client.table(_TABLE).select("user_id").eq("id", conversation_id).limit(1).execute()
        )
        rows = response.data
        if not rows:
            return None
        row = cast("dict[str, Any]", rows[0])
        user_id = row.get("user_id")
        return str(user_id) if user_id is not None else None

    async def get_thread_id(self, conversation_id: str) -> str | None:
        """Feature-detects chat_conversations.thread_id (migration 0036); None on any failure.

        Fail-open (T-54-05-04): an absent column (0036 unapplied — Postgres
        42703), a missing row, or any other read failure all resolve to
        None — RunChatTurn treats that identically to "no thread linked"
        and skips cluster-context injection cleanly, never a 500.
        """
        try:
            response = await asyncio.to_thread(
                lambda: self._client.table(_TABLE).select("thread_id").eq("id", conversation_id).limit(1).execute()
            )
        except Exception:
            logger.warning("chat_conversations_thread_id_read_failed", conversation_id=conversation_id)
            return None
        rows = response.data
        if not rows:
            return None
        row = cast("dict[str, Any]", rows[0])
        thread_id = row.get("thread_id")
        return str(thread_id) if thread_id is not None else None

    async def list_by_thread_id(
        self,
        *,
        thread_id: str,
        importer_id: str,
        exclude_conversation_id: str | None = None,
        limit: int = 8,
    ) -> list[ChatConversation]:
        """Return sibling conversations sharing thread_id, scoped to importer_id (Phase 54-05, CLUS-06).

        Feature-detects the thread_id column exactly like get_thread_id —
        an absent column (or any other read failure) resolves to [] rather
        than raising. Most-recently-updated first.
        """
        try:
            response = await asyncio.to_thread(
                lambda: (
                    self._client.table(_TABLE)
                    .select("id, title, model_id")
                    .eq("thread_id", thread_id)
                    .eq("importer_id", importer_id)
                    .order("updated_at", desc=True)
                    .limit(limit)
                    .execute()
                )
            )
        except Exception:
            logger.warning("chat_conversations_list_by_thread_id_failed", thread_id=thread_id)
            return []
        rows = cast("list[dict[str, Any]]", response.data or [])
        return [
            ChatConversation(
                id=str(row["id"]), title=str(row.get("title") or ""), model_id=str(row.get("model_id") or "")
            )
            for row in rows
            if str(row["id"]) != exclude_conversation_id
        ]
