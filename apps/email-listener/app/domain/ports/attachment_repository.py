"""AttachmentRepository port — domain abstraction over attachment persistence."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from app.domain.entities.attachment import Attachment


class AttachmentRepository(Protocol):
    """Port for persisting and retrieving Attachment domain entities."""

    async def save(self, attachment: Attachment) -> Attachment:
        """Upsert an attachment row; returns the persisted entity."""
        ...

    async def count_by_email_ids(self, email_ids: list[str]) -> dict[str, int]:
        """Return a mapping of email_id to attachment count for the given ids."""
        ...

    async def find_by_email_id(self, email_id: str) -> list[Attachment]:
        """Return all attachments belonging to the given email_id."""
        ...
