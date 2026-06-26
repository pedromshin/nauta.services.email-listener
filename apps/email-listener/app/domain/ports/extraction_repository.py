"""ExtractionRepository port — domain abstraction over extraction record persistence."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from app.domain.entities.extraction_record import ExtractionRecord


class ExtractionRepository(Protocol):
    """Port for persisting and retrieving ExtractionRecord domain entities."""

    async def save(self, record: ExtractionRecord) -> ExtractionRecord:
        """Insert or upsert an extraction record; returns the persisted entity."""
        ...

    async def find_by_component_id(self, component_id: str) -> list[ExtractionRecord]:
        """Return all extraction records for a given component."""
        ...

    async def supersede_active(self, component_id: str) -> None:
        """Mark all active extraction records for the component as superseded (D-16)."""
        ...
