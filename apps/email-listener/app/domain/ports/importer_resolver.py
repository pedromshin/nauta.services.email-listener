"""ImporterResolver port — domain abstraction over sender-to-importer resolution."""

from __future__ import annotations

from typing import Protocol


class ImporterResolver(Protocol):
    """Find-or-create an importer record keyed by forwarding-sender address.

    Returns the importer_id (UUID string) for the given sender.
    Malformed senders (no parseable domain) fall back to a configured default
    without creating any DB row — ingestion never hard-fails on a bad From header.
    """

    async def resolve(self, sender_address: str) -> str:
        """Resolve a sender address to an importer_id.

        Args:
            sender_address: The forwarding sender's email address
                (e.g. "maria@exporter.com").

        Returns:
            The importer_id UUID string for the resolved (or created) importer.
            Returns the configured default_importer_id for malformed senders.
        """
        ...
