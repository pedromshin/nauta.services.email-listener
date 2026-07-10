"""ThreadResolver port — domain abstraction over email-to-thread resolution.

Mirrors ImporterResolver (app/domain/ports/importer_resolver.py): a
find-or-create(-or-merge) port resolved once at ingest time, right after the
importer_id is known.
"""

from __future__ import annotations

from datetime import datetime
from typing import Protocol


class ThreadResolver(Protocol):
    """Find-or-create/merge the thread_id for an inbound email.

    Same-importer scoping invariant (T-45-03-01): resolution NEVER reads or
    matches emails outside the given importer_id — threads carry tenant
    scoping via their importer (TENA-01), and a forged References/embedded
    Message-ID must never merge across importers.

    False-split beats false-merge (45-CONTEXT.md): when the grouping signal
    is ambiguous (multiple candidate threads, no confident subject/window
    match), resolution creates a NEW thread rather than guessing a merge — a
    fragmented thread is recoverable, a wrongly-merged one is user-visible
    corruption.
    """

    async def resolve(
        self,
        *,
        importer_id: str,
        message_id: str,
        in_reply_to: str | None,
        references_ids: tuple[str, ...],
        subject: str | None,
        received_at: datetime,
        body_text: str | None,
        body_html: str | None,
    ) -> str:
        """Resolve (and persist if needed) the thread_id for this email.

        Neighbor search covers RFC 5322 headers (Message-ID/In-Reply-To/
        References — Tier 0) plus body-embedded Message-IDs for header-
        stripped Gmail forwards (Tier 1), then falls back to a conservative
        normalized-subject + time-window match (Tier 2) only when no header
        neighbor exists. When neighbors span more than one existing thread,
        the two threads are merged onto the deterministic (lexicographically
        smallest) canonical thread_id.

        Args:
            importer_id: The email's already-resolved importer (tenant scope
                for every candidate query this method issues).
            message_id: This email's own RFC 5322 Message-ID (or the SES
                fallback id when the MIME header is absent).
            in_reply_to: This email's In-Reply-To header value, if any.
            references_ids: This email's References header ids, if any.
            subject: This email's raw (non-normalized) subject.
            received_at: This email's received timestamp — anchors the
                Tier 2 fallback window.
            body_text: Plain-text body, scanned for Tier 1 embedded ids.
            body_html: HTML body, scanned for Tier 1 embedded ids.

        Returns:
            The resolved thread_id — existing, newly created, or the merge
            canonical when neighbors spanned multiple threads.
        """
        ...
