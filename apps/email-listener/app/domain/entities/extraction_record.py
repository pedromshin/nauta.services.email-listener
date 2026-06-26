"""Domain entity for an extraction record row. No external dependencies."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class ExtractionRecord:
    """A single LLM extraction result linking a component to an entity type.

    Mirrors the extraction_records table 1:1.
    """

    id: str
    importer_id: str
    component_id: str
    entity_type_id: str
    extracted_fields: dict[str, object]
    confidence_score: float
    confidence_breakdown: dict[str, object] | None
    routing_reason: str | None
    status: str
    corrected_fields: dict[str, object] | None
    retrieval_context: dict[str, object] | None
    created_at: datetime
    updated_at: datetime
