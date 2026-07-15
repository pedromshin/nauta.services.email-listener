"""Domain entity for an entity-type correction row. No external dependencies.

Captures a genuine entity-type reclassification (LEARN-01) — mirrors the
extraction_records.corrected_fields "structured, addressable correction"
shape (D-16), but for the entity-type axis instead of the field-value axis.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class EntityTypeCorrection:
    """A single genuine entity-type reclassification.

    Mirrors the entity_type_corrections table 1:1.
    previous_entity_type_id and corrected_entity_type_id are always different
    (a no-op is never captured — see SetComponentEntityTypeUseCase).
    """

    id: str
    importer_id: str
    component_id: str
    previous_entity_type_id: str
    corrected_entity_type_id: str
    created_at: datetime
