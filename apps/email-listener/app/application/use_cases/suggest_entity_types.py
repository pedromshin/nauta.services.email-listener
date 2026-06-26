"""SuggestEntityTypesUseCase — auto-classify candidate regions with entity-type suggestions.

SUGGEST-ONLY (D-05): sets role='entity' + entity_type_id on matched regions but
leaves extraction_status='candidate' (a suggestion awaiting user confirmation).
Never sets status to 'confirmed'; never auto-promotes.

BEST-EFFORT: the Bedrock classifier call is wrapped in try/except.  A failure
leaves all regions unclassified — ingestion is never blocked.

IDEMPOTENT: re-running updates suggestions for candidate regions.  Accepted /
confirmed / rejected regions (extraction_status not 'candidate') are skipped.

Architecture contract: imports ONLY domain ports and entities.
No infrastructure imports permitted.
"""

from __future__ import annotations

import structlog

from app.domain.ports.component_repository import ComponentRepository
from app.domain.ports.entity_type_classifier_protocol import (
    EntityTypeClassifierProtocol,
    EntityTypeSuggestion,
    RegionToClassify,
)
from app.domain.ports.entity_type_repository import EntityTypeRepository

logger = structlog.get_logger(__name__)

# Minimum confidence to accept a classification suggestion.
# Regions below this threshold are left unclassified.
CONFIDENCE_THRESHOLD: float = 0.5


class SuggestEntityTypesUseCase:
    """Classify a document's candidate regions and set entity-type suggestions.

    Collaborators (all domain ports):
        components: ComponentRepository — load regions, set role + entity_type_id.
        entity_types: EntityTypeRepository — load the importer's active types.
        classifier: EntityTypeClassifierProtocol — ONE Bedrock call for all regions.

    Suggest-only: applies role='entity' + entity_type_id but never sets
    extraction_status='confirmed'.  The suggestion is a candidate the user
    must confirm before it becomes authoritative (D-05).

    Best-effort: any exception from the classifier is logged and swallowed;
    regions are left unclassified rather than blocking ingest.
    """

    def __init__(
        self,
        *,
        components: ComponentRepository,
        entity_types: EntityTypeRepository,
        classifier: EntityTypeClassifierProtocol,
    ) -> None:
        self._components = components
        self._entity_types = entity_types
        self._classifier = classifier

    async def execute(self, *, email_id: str, importer_id: str) -> None:
        """Suggest entity types for the email's unclassified candidate regions.

        Does NOT raise.  All errors are logged and absorbed (best-effort).
        """
        log = logger.bind(email_id=email_id, importer_id=importer_id)
        log.info("suggest_entity_types_start")

        # Load importer's active entity types for the classification catalog.
        active_types = await self._entity_types.list_active(importer_id)
        if not active_types:
            # Fall back to system-default (importer_id=None) types.
            active_types = await self._entity_types.list_active(None)
        if not active_types:
            log.info("suggest_entity_types_no_entity_types")
            return

        # Server-side query for the email's unclassified candidate regions. NOT
        # find_by_email_id + client filter: an email can have thousands of region
        # components (OCR-level), which exceeds the PostgREST 1000-row default and
        # would silently drop the handful of real candidates.
        all_candidates = await self._components.find_unclassified_candidate_regions(email_id)
        candidate_regions = [c for c in all_candidates if c.content_text and c.content_text.strip()]

        if not candidate_regions:
            log.info("suggest_entity_types_no_candidate_regions")
            return

        log.info(
            "suggest_entity_types_classifying",
            candidate_region_count=len(candidate_regions),
            entity_type_count=len(active_types),
        )

        regions_input = tuple(RegionToClassify(component_id=c.id, text=c.content_text) for c in candidate_regions)

        # ONE Bedrock call for ALL regions (RELIABILITY constraint).
        try:
            suggestions: tuple[EntityTypeSuggestion, ...] = await self._classifier.classify(
                regions=regions_input,
                entity_types=tuple(active_types),
            )
        except Exception:
            log.warning("suggest_entity_types_classifier_failed", exc_info=True)
            return

        if not suggestions:
            log.info("suggest_entity_types_no_suggestions")
            return

        # Build a slug -> entity_type_id lookup for applying suggestions.
        slug_to_type_id = {et.slug: et.id for et in active_types}

        applied = 0
        skipped_low_confidence = 0
        skipped_unknown_slug = 0

        for suggestion in suggestions:
            if suggestion.entity_type_slug is None or suggestion.confidence < CONFIDENCE_THRESHOLD:
                skipped_low_confidence += 1
                continue

            entity_type_id = slug_to_type_id.get(suggestion.entity_type_slug)
            if entity_type_id is None:
                log.debug(
                    "suggest_entity_types_unknown_slug",
                    component_id=suggestion.component_id,
                    slug=suggestion.entity_type_slug,
                )
                skipped_unknown_slug += 1
                continue

            # Set role='entity' + entity_type_id as a CANDIDATE suggestion.
            # extraction_status remains 'candidate' — never auto-confirmed.
            try:
                await self._components.update_role(suggestion.component_id, "entity")
                await self._components.update_entity_type(suggestion.component_id, entity_type_id)
                applied += 1
                log.debug(
                    "suggest_entity_types_applied",
                    component_id=suggestion.component_id,
                    entity_type_slug=suggestion.entity_type_slug,
                    confidence=suggestion.confidence,
                )
            except Exception:
                log.warning(
                    "suggest_entity_types_apply_failed",
                    component_id=suggestion.component_id,
                    exc_info=True,
                )

        log.info(
            "suggest_entity_types_done",
            applied=applied,
            skipped_low_confidence=skipped_low_confidence,
            skipped_unknown_slug=skipped_unknown_slug,
            total_suggestions=len(suggestions),
        )
