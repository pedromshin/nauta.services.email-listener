"""RetrievalPort port — domain abstraction over hybrid vector+trigram retrieval.

Implementations run S4-S6 hybrid retrieval (vector cosine + pg_trgm identifier
match, merged with RRF k=60) over confirmed email components to surface
few-shot examples for the autofill prompt (D-15, RESEARCH §4.1, §4.3).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class RetrievedExample:
    """A single confirmed component retrieved as a few-shot example.

    component_id: UUID of the email_component row.
    content_text: The region text that was confirmed.
    extracted_fields: The confirmed {field_slug: value} mapping.
    score: RRF-merged similarity score in (0, 1].
    """

    component_id: str
    content_text: str
    extracted_fields: dict[str, object]
    score: float


class RetrievalPort(Protocol):
    """Port for hybrid vector + trigram retrieval over confirmed regions."""

    async def find_similar_confirmed(
        self,
        *,
        component_embedding: tuple[float, ...],
        entity_type_id: str,
        importer_id: str,
        key_terms: tuple[str, ...],
        top_n: int = 3,
    ) -> list[RetrievedExample]:
        """Return top-N confirmed components similar to the given embedding.

        Runs both a vector cosine query and a pg_trgm trigram query, merges
        results with RRF k=60, and returns at most top_n RetrievedExample
        objects sorted by descending RRF score.

        Both sub-queries MUST filter by importer_id (T-04-28 cross-tenant).
        Empty confirmed set returns [] (cold-start safe — D-13).
        """
        ...
