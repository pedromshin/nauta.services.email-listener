"""Use case: backfill one raw email into the ingestion pipeline.

Transport for historical mail that never traversed SES (Gmail import, mbox
replay): the caller supplies the raw MIME bytes plus the forwarding
recipient(s) that anchor user attribution, and this use case persists the
bytes into the writable backfill raw store, then delegates to the SAME
IngestInboundEmailUseCase the SNS path uses — full pipeline parity
(threading, importer resolution, attachment parsing, entity resolution).

Idempotent: the store is an upsert and ingest re-keys on
(importer_id, message_id), so re-submitting the same backfill id re-ingests
in place rather than duplicating.
"""

from __future__ import annotations

import re
from collections.abc import Sequence

import structlog

from app.application.use_cases.ingest_inbound_email import IngestInboundEmailUseCase
from app.domain.entities.email import Email
from app.domain.ports.raw_email_store import BACKFILL_MESSAGE_ID_PREFIX, BackfillRawEmailStore

logger = structlog.get_logger(__name__)

# Storage-key-safe backfill id (Supabase Storage rejects exotic characters,
# and the id must survive raw_storage_key.rsplit("/") round-tripping).
_BACKFILL_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,200}$")


class InvalidBackfillIdError(ValueError):
    """Raised when the caller-supplied backfill id is not storage-key safe."""


class BackfillInboundEmailUseCase:
    """Store caller-supplied raw MIME, then run the standard ingestion pipeline."""

    def __init__(self, store: BackfillRawEmailStore, ingest: IngestInboundEmailUseCase) -> None:
        self._store = store
        self._ingest = ingest

    async def execute(self, *, backfill_id: str, raw_mime: bytes, recipients: Sequence[str] = ()) -> Email:
        """Ingest one backfilled email; returns the persisted Email.

        backfill_id is the caller's stable id for this message (e.g. the Gmail
        message id) — it is namespaced with BACKFILL_MESSAGE_ID_PREFIX so the
        raw-store routing and any future SES id can never collide.
        """
        if not _BACKFILL_ID_RE.fullmatch(backfill_id):
            raise InvalidBackfillIdError(f"backfill_id must match {_BACKFILL_ID_RE.pattern}")

        message_id = (
            backfill_id
            if backfill_id.startswith(BACKFILL_MESSAGE_ID_PREFIX)
            else f"{BACKFILL_MESSAGE_ID_PREFIX}{backfill_id}"
        )
        await self._store.store(message_id, raw_mime)
        logger.info("backfill_raw_stored", message_id=message_id, size_bytes=len(raw_mime))
        return await self._ingest.execute(message_id, recipients=recipients)
