"""Domain port for entity resolution — BlendedRAG candidate surfacing.

Defines the EntityCandidate value object and the EntityResolutionRepository
protocol so application use cases can type against the domain layer only,
keeping the architecture contract (application must not import infrastructure).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class EntityCandidate:
    """A resolution candidate surfaced by the BlendedRAG resolver.

    rrf_score is the fused RRF score across both arms.
    match_type is from the D-09 four-type vocabulary:
        'semantic' | 'identifier_exact' | 'identifier_fuzzy' | 'alias'
    similarity_score is the arm-specific winning sub-score.
    """

    entity_instance_id: str
    display_name: str
    rrf_score: float
    match_type: str
    similarity_score: float


class EntityResolutionRepository(Protocol):
    """Protocol for BlendedRAG entity resolution (dense + lexical, RRF-fused).

    Implementations live in infrastructure. The application layer depends only
    on this protocol, never on the concrete Supabase class (D-07/D-12/T-10-10).
    """

    def find_candidates(
        self,
        *,
        display_name: str,
        identifiers: dict[str, object],
        entity_type_id: str,
        importer_id: str,
        embedding: list[float] | None,
        top_n: int = 5,
        subject_entity_instance_id: str | None = None,
    ) -> list[EntityCandidate]:
        """Return top-N resolution candidates fused by RRF(k=60).

        Dense vector arm is skipped when embedding is None (D-12 degradation).
        Lexical arm always runs. Both arms enforce tenant isolation via
        match_importer_id (T-10-10 cross-tenant isolation).

        subject_entity_instance_id (optional, LEARN-02): when provided, both RPC
        arms exclude candidates the human already dismissed as a duplicate of this
        subject (component_entity_candidate_links.was_dismissed), checked
        symmetrically across both link orderings. None preserves legacy behavior
        (no exclusion) — backward compatible for callers that omit it.
        """
        ...
