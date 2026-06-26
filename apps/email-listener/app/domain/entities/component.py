"""Domain entity for a parsed component/region. No external dependencies."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Component:
    """A parsed content region extracted from an email or attachment.

    Supports nesting via parent_component_id (D-09).
    Carries normalized polygon geometry in location (D-12).
    """

    id: str
    email_id: str
    importer_id: str
    attachment_id: str | None
    parent_component_id: str | None
    source_type: str
    location: dict[str, object]
    content_text: str
    content_markdown: str | None
    content_raw: dict[str, object] | None
    embedding: tuple[float, ...] | None
    sequence_index: int
    extraction_status: str
    # Phase 9 relationship model (D-01/D-02/D-03/D-04). Defaulted so existing
    # constructors that omit them keep working (propose_regions/classify_document).
    role: str | None = None
    entity_type_id: str | None = None
    entity_type_field_id: str | None = None
