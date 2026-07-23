"""RoutingRawEmailStore — routes raw-MIME reads by message-id namespace.

SES-delivered ids resolve against the read-only S3 inbound store; backfill
ids (BACKFILL_MESSAGE_ID_PREFIX) resolve against the writable Supabase store.
Injected as THE RawEmailStore, so IngestInboundEmailUseCase and
ReprocessEmailUseCase work identically for live and backfilled emails — the
reprocess round-trip (raw_storage_key -> bare id -> fetch) re-routes to the
same store that originally persisted the bytes.

Composes two injected ports; imports domain only (import-linter clean).
"""

from __future__ import annotations

from app.domain.ports.raw_email_store import (
    BACKFILL_MESSAGE_ID_PREFIX,
    BackfillRawEmailStore,
    RawEmailStore,
)


class RoutingRawEmailStore:
    """Prefix-routing composite of the SES (S3) and backfill (Supabase) stores."""

    def __init__(self, ses_store: RawEmailStore, backfill_store: BackfillRawEmailStore) -> None:
        self._ses_store = ses_store
        self._backfill_store = backfill_store

    def _route(self, message_id: str) -> RawEmailStore:
        if message_id.startswith(BACKFILL_MESSAGE_ID_PREFIX):
            return self._backfill_store
        return self._ses_store

    def key_for(self, message_id: str) -> str:
        return self._route(message_id).key_for(message_id)

    async def fetch(self, message_id: str) -> bytes:
        return await self._route(message_id).fetch(message_id)
