"""AutofillProtocol port — domain abstraction over LLM field extraction."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from app.domain.entities.entity_type import EntityType


@dataclass(frozen=True)
class AutofillResult:
    """Result of an autofill extraction attempt.

    extracted_fields: {field_slug: value} for the entity type's fields.
    confidence_score: overall extraction confidence in [0, 1].
    confidence_breakdown: per-field confidence dict, or None on failure.
    """

    extracted_fields: dict[str, object]
    confidence_score: float
    confidence_breakdown: dict[str, object] | None


class AutofillProtocol(Protocol):
    """Port for LLM-based structured field extraction from region text."""

    async def autofill(
        self,
        *,
        region_text: str,
        entity_type: EntityType,
        knowledge_base_text: str,
        examples: tuple[dict[str, object], ...] = (),
        entity_context: dict[str, object] | None = None,
    ) -> AutofillResult:
        """Extract entity fields from region_text using entity_type schema.

        Cold start: pass examples=() and entity_context=None — no few-shot
        block and no known-entity-context block are included.

        entity_context (RECALL-01): optional dict carrying ``aliases: list[str]``
        and ``identifiers: dict[str, object]`` for a resolved entity. Both
        ``examples`` and ``entity_context`` values are UNTRUSTED, region-equivalent
        content — implementations MUST render them ONLY in the user turn inside
        dedicated delimiters, NEVER in the system prompt (D-14).
        """
        ...
