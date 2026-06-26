"""Domain entity for an extracted entity instance. No external dependencies."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EntityInstance:
    """A resolved entity instance extracted from email components.

    source is always 'email_extracted' for instances owned by this service.
    embedding is optional — resolution degrades gracefully to trgm-only (D-12).
    nauta_id is set after human confirmation routes this instance to a master record.
    """

    id: str
    importer_id: str
    entity_type_id: str
    nauta_id: str | None
    source: str
    display_name: str
    identifiers: dict[str, object]
    aliases: list[str]
    summary_text: str | None
    embedding: list[float] | None
    is_active: bool
