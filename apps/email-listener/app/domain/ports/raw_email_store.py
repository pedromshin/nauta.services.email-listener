"""RawEmailStore port — domain abstraction over the raw MIME object store."""

from __future__ import annotations

from typing import Protocol


class RawEmailStore(Protocol):
    """Port for fetching raw inbound email bytes keyed by SES message id.

    Concrete implementation lives in app.infrastructure.s3.
    """

    def key_for(self, message_id: str) -> str:
        """Return the storage key where the raw MIME for this message lives."""
        ...

    async def fetch(self, message_id: str) -> bytes:
        """Return the raw MIME bytes for the given SES message id."""
        ...
