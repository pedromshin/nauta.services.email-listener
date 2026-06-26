"""AutofillUseCase — cold-start field extraction + few-shot retrieval (D-13, D-15).

Architecture contract: imports ONLY domain ports and entities.
No infrastructure imports permitted (verified by lint-imports rule).

Cold-start knowledge base source:
  entity_type.description is used as knowledge_base_text.
  At cold start there are zero confirmed examples, so the prompt uses only
  the entity type's preset description + field schema (no retrieval).

Plan 04-08 extension (few-shot upgrade):
  When EmbeddingProtocol and RetrievalPort are provided, the use case
  embeds the region, retrieves top-N confirmed similar examples, and
  injects them into the prompt as few-shot examples (D-15).
  When retrieval returns [] the cold-start path is preserved (D-13).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog

from app.domain.entities.extraction_record import ExtractionRecord
from app.domain.ports.autofill_protocol import AutofillProtocol, AutofillResult
from app.domain.ports.component_repository import ComponentRepository
from app.domain.ports.embedding_protocol import EmbeddingProtocol
from app.domain.ports.entity_type_repository import EntityTypeRepository
from app.domain.ports.extraction_repository import ExtractionRepository
from app.domain.ports.retrieval_port import RetrievalPort, RetrievedExample
from app.domain.services.key_terms import extract_key_terms

logger = structlog.get_logger(__name__)


def _example_to_dict(example: RetrievedExample) -> dict[str, object]:
    """Convert a RetrievedExample to the dict format AutofillProtocol expects."""
    return {
        "content_text": example.content_text,
        "extracted_fields": dict(example.extracted_fields),
        "score": example.score,
    }


class AutofillUseCase:
    """Extract fields for a region Component using entity-type defaults.

    When EmbeddingProtocol + RetrievalPort are injected (04-08 upgrade), the
    use case embeds the region, retrieves confirmed similar examples, and
    passes them as few-shot examples to the autofiller.

    Collaborators (all domain ports):
        components: ComponentRepository — load the region Component.
        entity_types: EntityTypeRepository — load the EntityType + field schema.
        extractions: ExtractionRepository — persist the candidate ExtractionRecord.
        autofiller: AutofillProtocol — LLM-backed field extraction.
        embedder: EmbeddingProtocol | None — Bedrock Titan embedder (04-08).
        retrieval: RetrievalPort | None — hybrid vector+trgm retrieval (04-08).

    Cold-start behaviour (D-13):
        When retrieval returns [] (or embedder/retrieval not set), calls autofiller
        with examples=() — no few-shot block is included.

    Tenant isolation (T-04-26):
        find_by_slug is called with importer_id first; if the entity type is not
        found, falls back to importer_id=None (system-default shared types).
    """

    def __init__(
        self,
        *,
        components: ComponentRepository,
        entity_types: EntityTypeRepository,
        extractions: ExtractionRepository,
        autofiller: AutofillProtocol,
        embedder: EmbeddingProtocol | None = None,
        retrieval: RetrievalPort | None = None,
    ) -> None:
        self._components = components
        self._entity_types = entity_types
        self._extractions = extractions
        self._autofiller = autofiller
        self._embedder = embedder
        self._retrieval = retrieval

    async def execute(
        self,
        *,
        component_id: str,
        entity_type_slug: str,
        importer_id: str | None = None,
    ) -> AutofillResult:
        """Run autofill (with optional few-shot retrieval) and persist ExtractionRecord.

        importer_id (D-18): when None, the tenant is derived from the loaded
        component (ingest assigns it from the sender domain, D-05). When given,
        a mismatch with the component's importer 404s (auth seam for later).

        Raises:
            ValueError: if the component or entity type cannot be found.
        Returns:
            AutofillResult with the extracted fields and confidence scores.
        """
        log = logger.bind(
            component_id=component_id,
            entity_type_slug=entity_type_slug,
        )
        log.info("autofill_start")

        # Load component (T-04-26: importer-scoped load)
        component = await self._components.find_by_id(component_id)
        if component is None:
            log.warning("autofill_component_not_found")
            raise ValueError(f"Component not found: {component_id}")

        # D-18: derive tenant from the component itself; explicit mismatch 404s
        if importer_id is not None and component.importer_id != importer_id:
            log.warning("autofill_component_importer_mismatch")
            raise ValueError(f"Component not found: {component_id}")
        importer_id = component.importer_id
        log = log.bind(importer_id=importer_id)

        # Load entity type — importer-scoped first, fall back to system default
        entity_type = await self._entity_types.find_by_slug(importer_id, entity_type_slug)
        if entity_type is None:
            entity_type = await self._entity_types.find_by_slug(None, entity_type_slug)
        if entity_type is None:
            log.warning("autofill_entity_type_not_found")
            raise ValueError(f"EntityType not found: {entity_type_slug}")

        # Cold-start KB: entity type description is the default knowledge base (D-13).
        knowledge_base_text = entity_type.description or ""

        # ── Few-shot retrieval (04-08 upgrade, D-15) ─────────────────────────────
        # When embedder + retrieval are available, embed the region and retrieve
        # top-N confirmed similar examples to inject as few-shot context.
        # Graceful degradation: if retrieval returns [] or ports are absent,
        # cold-start path is preserved (D-13).
        examples: tuple[dict[str, object], ...] = ()

        if self._embedder is not None and self._retrieval is not None:
            try:
                region_text = component.content_text or ""
                embedding = await self._embedder.embed(text=region_text)
                retrieved: list[RetrievedExample] = await self._retrieval.find_similar_confirmed(
                    component_embedding=embedding,
                    entity_type_id=entity_type.id,
                    importer_id=importer_id,
                    key_terms=extract_key_terms(region_text),
                    top_n=3,
                )
                if retrieved:
                    examples = tuple(_example_to_dict(ex) for ex in retrieved)
                    log.info("autofill_few_shot_retrieved", example_count=len(retrieved))
                else:
                    log.info("autofill_cold_start_empty_retrieval")
            except Exception:
                log.warning("autofill_retrieval_failed_fallback_cold_start", exc_info=True)
                examples = ()

        log.info(
            "autofill_calling_llm",
            entity_type_id=entity_type.id,
            kb_length=len(knowledge_base_text),
            example_count=len(examples),
        )

        # Extract fields
        routing_reason = "few_shot_autofill" if examples else "cold_start_autofill"
        result = await self._autofiller.autofill(
            region_text=component.content_text,
            entity_type=entity_type,
            knowledge_base_text=knowledge_base_text,
            examples=examples,
        )

        # Persist candidate ExtractionRecord (T-04-25: status=candidate only)
        record = ExtractionRecord(
            id=str(uuid.uuid4()),
            importer_id=importer_id,
            component_id=component_id,
            entity_type_id=entity_type.id,
            extracted_fields=result.extracted_fields,
            confidence_score=result.confidence_score,
            confidence_breakdown=result.confidence_breakdown,
            routing_reason=routing_reason,
            status="candidate",
            corrected_fields=None,
            retrieval_context=None,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        await self._extractions.save(record)

        log.info(
            "autofill_done",
            extraction_id=record.id,
            confidence_score=result.confidence_score,
            field_count=len(result.extracted_fields),
        )

        return result
