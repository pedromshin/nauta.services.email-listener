"""ConfirmRegionUseCase — learning flywheel D-15 + D-16.

On human confirmation of a region component:
  1. Mark the ExtractionRecord status='confirmed' (D-16: never overwrite priors).
  2. If corrected_fields provided, store them on the record.
  3. Embed the region text + confirmed field values via EmbeddingProtocol (Bedrock Titan).
  4. Persist the embedding on the Component row so the region becomes a retrievable
     few-shot child (D-15 — learning flywheel).

Architecture contract: imports ONLY domain ports and entities.
No infrastructure imports permitted (verified by lint-imports rule).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime

import structlog

from app.domain.entities.extraction_record import ExtractionRecord
from app.domain.ports.component_repository import ComponentRepository
from app.domain.ports.embedding_protocol import EmbeddingProtocol
from app.domain.ports.extraction_repository import ExtractionRepository

logger = structlog.get_logger(__name__)


class ConfirmRegionUseCase:
    """Confirm a region component and index it for few-shot retrieval (D-15).

    Collaborators (all domain ports):
        components: ComponentRepository — load component + persist embedding.
        extractions: ExtractionRepository — load/save ExtractionRecord.
        embedder: EmbeddingProtocol — Bedrock Titan text embeddings (1536-dim).

    D-15 (learning flywheel): after confirmation, the region's embedding is
        persisted on the Component row so hybrid retrieval can surface it as a
        few-shot example for future autofill calls on similar documents.

    D-16 (promote-in-place): the most-recently-created *candidate* row is promoted
        to status='confirmed' by upsert (same primary key, updated status/fields/
        updated_at). A prior *confirmed* record is never downgraded or replaced —
        once confirmed, the row stays confirmed and the update is idempotent (we
        still embed/update the component on repeat confirmations, D-15).
    """

    def __init__(
        self,
        *,
        components: ComponentRepository,
        extractions: ExtractionRepository,
        embedder: EmbeddingProtocol,
    ) -> None:
        self._components = components
        self._extractions = extractions
        self._embedder = embedder

    async def execute(
        self,
        *,
        component_id: str,
        importer_id: str | None = None,
        corrected_fields: dict[str, object] | None = None,
    ) -> None:
        """Confirm the region component and persist its embedding.

        importer_id (D-18): when None, the tenant is derived from the loaded
        component (ingest assigns it from the sender domain, D-05). When given,
        a mismatch with the component's importer 404s (auth seam for later).

        Raises:
            ValueError: if the component cannot be found.
        """
        log = logger.bind(component_id=component_id)
        log.info("confirm_region_start")

        # Load component
        component = await self._components.find_by_id(component_id)
        if component is None:
            log.warning("confirm_region_component_not_found")
            raise ValueError(f"Component not found: {component_id}")

        # D-18: derive tenant from the component itself; explicit mismatch 404s
        if importer_id is not None and component.importer_id != importer_id:
            log.warning("confirm_region_component_importer_mismatch")
            raise ValueError(f"Component not found: {component_id}")
        importer_id = component.importer_id
        log = log.bind(importer_id=importer_id)

        # Load existing extraction records for this component
        existing_records = await self._extractions.find_by_component_id(component_id)

        # Defense in depth (T-04-28): never act on another tenant's records even if
        # RLS is bypassed in some future call context — filter to the caller's tenant.
        existing_records = [r for r in existing_records if r.importer_id == importer_id]

        # Promote the MOST-RECENTLY-CREATED candidate (a re-autofill may have left
        # several; the latest reflects the human's current intent and entity type).
        # D-16: upsert the candidate row in-place (same id) to status='confirmed'.
        # A prior confirmed row is never picked up here (filtered to status=candidate).
        candidate = max(
            (r for r in existing_records if r.status == "candidate"),
            key=lambda r: r.created_at,
            default=None,
        )

        now = datetime.now(UTC)

        if candidate is not None:
            # Promote the candidate: construct a new (frozen) ExtractionRecord with
            # the same id and updated status/fields, then upsert via save() (D-16).
            confirmed_record = ExtractionRecord(
                id=candidate.id,
                importer_id=candidate.importer_id,
                component_id=candidate.component_id,
                entity_type_id=candidate.entity_type_id,
                extracted_fields=candidate.extracted_fields,
                confidence_score=candidate.confidence_score,
                confidence_breakdown=candidate.confidence_breakdown,
                routing_reason=candidate.routing_reason,
                status="confirmed",
                corrected_fields=corrected_fields,
                retrieval_context=candidate.retrieval_context,
                created_at=candidate.created_at,
                updated_at=now,
            )
            await self._extractions.save(confirmed_record)
        else:
            # No candidate found — check if already confirmed (idempotent path)
            already_confirmed = any(r.status == "confirmed" for r in existing_records)
            if not already_confirmed:
                # No candidate and no prior confirmed record: skip record creation to
                # avoid inserting entity_type_id="" which violates the NOT NULL FK.
                # Embedding still runs below (D-15 flywheel must not be skipped).
                log.warning("confirm_region_no_candidate_record_skipped")

        # D-16: sync the component's own extraction_status so the frontend refetch
        # reflects "confirmed" — the extraction record was promoted above, but the
        # component row is the source of truth the detail query returns.
        await self._components.update_status(component_id, "confirmed")

        # Build the embedding text: region content + confirmed/corrected field values.
        # This ensures the embedding captures both the visual region and the structured
        # fields humans confirm — richer signal for few-shot retrieval (D-15).
        fields_text = ""
        effective_fields = corrected_fields or (candidate.extracted_fields if candidate else {})
        if effective_fields:
            try:
                fields_text = " ".join(f"{k}:{v}" for k, v in effective_fields.items())
            except Exception:
                log.warning("confirm_region_fields_text_fallback", exc_info=True)
                try:
                    fields_text = json.dumps(effective_fields, default=str)
                except Exception:
                    log.warning("confirm_region_fields_text_failed", exc_info=True)
                    fields_text = ""

        embed_text = component.content_text or ""
        if fields_text:
            embed_text = f"{embed_text} {fields_text}".strip()

        log.info("confirm_region_embedding", text_length=len(embed_text))
        embedding = await self._embedder.embed(text=embed_text)

        # Persist embedding on the Component row (D-15 — makes region retrievable)
        await self._components.update_embedding(component_id, embedding)

        # D-13 — 4e synthesis-trigger injection point.
        #
        # After the embedding is persisted, Phase 11 (knowledge graph) will inject a
        # `knowledge_synthesizer` collaborator here to derive knowledge_node rows from
        # the confirmed region.  Today knowledge_synthesizer is absent (None), so no
        # call is made and this block is a no-op.
        #
        # When added, the call will look like:
        #
        #   if self._knowledge_synthesizer is not None:
        #       await self._knowledge_synthesizer.synthesize_from_confirmation(
        #           component_id=component_id,
        #           importer_id=importer_id,
        #           confirmed_record=confirmed_record,
        #           corrected_fields=corrected_fields,
        #           source="learned_from_correction",  # knowledge_node_edges.source value
        #       )
        #
        # `source="learned_from_correction"` distinguishes edges derived from a human
        # confirmation from those inferred by automated extraction (D-13 design note).
        # The synthesizer must be a domain port (no infrastructure imports here).

        log.info("confirm_region_done", component_id=component_id)
