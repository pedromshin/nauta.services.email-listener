"""EmailRepository port — domain abstraction over email persistence."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from app.domain.entities.email import Email


class EmailRepository(Protocol):
    """Port for persisting and retrieving Email domain entities.

    Concrete implementations live in app.infrastructure.supabase.
    """

    async def save(self, email: Email) -> Email:
        """Upsert an email row; returns the persisted entity."""
        ...

    async def find_by_id(self, email_id: str) -> Email | None:
        """Return the email with the given id, or None if not found."""
        ...

    async def find_by_message_id(self, importer_id: str, message_id: str) -> Email | None:
        """Return the email matching (importer_id, message_id), or None."""
        ...

    async def list_by_importer(self, importer_id: str | None, limit: int, offset: int) -> list[Email]:
        """Return emails newest received_at first; importer_id=None lists across all importers (D-18)."""
        ...

    async def update_parse_status(self, email_id: str, status: str, error: str | None) -> None:
        """Update the parse_status and parse_error fields for an email."""
        ...
