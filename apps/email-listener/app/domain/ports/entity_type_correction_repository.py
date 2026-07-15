"""Domain port for entity-type correction capture + retrieval (LEARN-01/LEARN-02).

Defines the EntityTypeCorrectionExample value object and the
EntityTypeCorrectionRepository protocol so application use cases can type
against the domain layer only, keeping the architecture contract
(application must not import infrastructure).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class EntityTypeCorrectionExample:
    """A single corrected component retrieved as a few-shot example.

    content_text: The region text of the corrected component.
    corrected_entity_type_slug: The entity type slug the human corrected TO.
    score: pg_trgm similarity score in (0, 1].
    """

    content_text: str
    corrected_entity_type_slug: str
    score: float


class EntityTypeCorrectionRepository(Protocol):
    """Protocol for capturing and retrieving entity-type corrections.

    Implementations live in infrastructure. The application layer depends
    only on this protocol, never on the concrete Supabase class (D-07/T-10-10).
    """

    async def save(
        self,
        *,
        component_id: str,
        importer_id: str,
        previous_entity_type_id: str,
        corrected_entity_type_id: str,
    ) -> None:
        """Insert a durable entity_type_corrections row.

        Callers MUST only invoke this for a genuine reclassification
        (previous_entity_type_id is not None AND differs from
        corrected_entity_type_id) — see SetComponentEntityTypeUseCase.
        """
        ...

    async def find_similar(
        self,
        *,
        query_text: str,
        importer_id: str,
        top_n: int = 3,
    ) -> list[EntityTypeCorrectionExample]:
        """Return top-N corrections whose content_text is similar to query_text.

        importer_id-scoped ONLY — no entity_type_id filter. This retrieval
        runs BEFORE classification decides the entity type, so filtering by
        entity_type_id would make it structurally incapable of ever
        returning results (Pitfall 4). Corrections across ALL entity types
        are returned, each tagged with its own corrected_entity_type_slug.

        Degrade-safe: an empty or failed RPC returns [] (never raises,
        mirrors D-13 cold-start-safe retrieval).
        """
        ...
