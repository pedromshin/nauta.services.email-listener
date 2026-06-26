"""PromoteEntityOnConfirmUseCase — on-confirm entity promotion + provenance (D-02/D-09/D-11).

When a user confirms an entity-role component this use case:
  1. Derives the importer_id from the component row (D-21).
  2. Loads confirmed field children + their extraction records to build identifiers
     and a legible display_name (Type · primary identifier).
  3. Upserts an entity_instances row (source='email_extracted') for the component.
  4. Writes occurrence links (was_selected=True) from each confirmed field child to
     the entity instance so the /entities gallery + detail page surfaces occurrences
     and field values correctly.
  5. Runs BlendedRAG resolution to surface duplicate candidates.
  6. Writes one component_entity_candidate_links row per candidate (D-09 provenance).
  7. If a surviving identity matches, appends the variant spelling as an alias (D-11).

Suggest-only (D-05): never writes a merge or flips nauta_id automatically.
All writes are idempotent — re-running promote for the same component_id is safe.

Architecture contract: imports ONLY domain ports and entities.
No infrastructure imports permitted.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import TYPE_CHECKING

import structlog

from app.domain.entities.entity_instance import EntityInstance
from app.domain.entities.extraction_record import ExtractionRecord
from app.domain.ports.component_repository import ComponentRepository
from app.domain.ports.entity_instance_repository import EntityInstanceRepository
from app.domain.ports.entity_resolution_repository import EntityResolutionRepository
from app.domain.ports.entity_type_repository import EntityTypeRepository
from app.domain.ports.extraction_repository import ExtractionRepository

if TYPE_CHECKING:
    from app.domain.entities.component import Component
    from app.domain.entities.entity_type import EntityType, EntityTypeField

logger = structlog.get_logger(__name__)

_SOURCE = "email_extracted"


def _get_field_value(
    field_child: Component,
    slug: str,
    extraction_records: list[ExtractionRecord],
) -> object | None:
    """Extract the effective value for a field child from its extraction records.

    corrected_fields wins over extracted_fields. Returns the value keyed by slug,
    or None if no confirmed extraction record or the slug is absent/null.
    """
    confirmed = max(
        (r for r in extraction_records if r.component_id == field_child.id and r.status == "confirmed"),
        key=lambda r: r.created_at,
        default=None,
    )
    if confirmed is None:
        return None
    # corrected_fields overrides extracted_fields when present
    effective: dict[str, object] = dict(confirmed.corrected_fields or confirmed.extracted_fields)
    value = effective.get(slug)
    return value if value is not None else None


def _build_identifiers_and_display_name(
    field_children: list[Component],
    all_extraction_records: list[ExtractionRecord],
    entity_type: EntityType,
    fallback_name: str,
) -> tuple[dict[str, object], str]:
    """Derive identifiers dict and display_name from confirmed field children.

    Returns (identifiers, display_name) where:
      identifiers = {slug: value} for non-null confirmed field values.
      display_name = "{entity_type.label} · {primary_value}" where primary_value
        is the value of the first is_identifier=True field (by sort_order),
        falling back to the first confirmed field value, then to fallback_name.
    """
    # Build a lookup: entity_type_field_id -> EntityTypeField
    field_by_id: dict[str, EntityTypeField] = {f.id: f for f in entity_type.fields}

    # Collect (field, slug, value) for all field children that have a mapped field
    # and a non-null value.
    field_values: list[tuple[EntityTypeField, str, object]] = []
    for child in field_children:
        if not child.entity_type_field_id:
            continue
        etf = field_by_id.get(child.entity_type_field_id)
        if etf is None:
            continue
        value = _get_field_value(child, etf.slug, all_extraction_records)
        if value is None:
            continue
        field_values.append((etf, etf.slug, value))

    # identifiers: slug -> value (all non-null confirmed values)
    identifiers: dict[str, object] = {slug: value for _, slug, value in field_values}

    # display_name: "Type · primary identifier value"
    primary_value: object | None = None

    # First: look for is_identifier=True fields sorted by sort_order
    identifier_fields = sorted(
        [(etf, slug, value) for etf, slug, value in field_values if etf.is_identifier],
        key=lambda t: t[0].sort_order,
    )
    if identifier_fields:
        primary_value = identifier_fields[0][2]
    elif field_values:
        # Fall back to the first confirmed field value (any field, by sort_order)
        sorted_fields = sorted(field_values, key=lambda t: t[0].sort_order)
        primary_value = sorted_fields[0][2]

    display_name = f"{entity_type.label} · {primary_value}" if primary_value is not None else fallback_name

    return identifiers, display_name


class PromoteEntityOnConfirmUseCase:
    """Promote a confirmed entity component to an entity_instances row.

    Collaborators:
        components: ComponentRepository — load the source component (D-21 tenant).
        entity_instances: EntityInstanceRepository — upsert identity row + provenance.
        entity_types: EntityTypeRepository — load EntityType for label + field schema.
        extractions: ExtractionRepository — load field-child extraction records.
        resolution_repo: SupabaseEntityResolutionRepository — BlendedRAG candidates.

    D-21: importer_id is derived from the component row, never from a caller arg.
    D-05: no merge is written — only candidate provenance is recorded.
    D-11: a confirmed display_name variant is appended as an alias on the match.
    """

    def __init__(
        self,
        *,
        components: ComponentRepository,
        entity_instances: EntityInstanceRepository,
        entity_types: EntityTypeRepository,
        extractions: ExtractionRepository,
        resolution_repo: EntityResolutionRepository,
    ) -> None:
        self._components = components
        self._entity_instances = entity_instances
        self._entity_types = entity_types
        self._extractions = extractions
        self._resolution_repo = resolution_repo

    async def execute(self, *, component_id: str) -> None:
        """Promote a confirmed entity component to entity_instances.

        Raises:
            ValueError: if the component cannot be found or has no entity_type_id.
        """
        log = logger.bind(component_id=component_id)
        log.info("promote_entity_on_confirm_start")

        component = await self._components.find_by_id(component_id)
        if component is None:
            log.warning("promote_entity_on_confirm_component_not_found")
            raise ValueError(f"Component not found: {component_id}")

        if not component.entity_type_id:
            log.warning("promote_entity_on_confirm_no_entity_type")
            raise ValueError(f"Component has no entity_type_id: {component_id}")

        # D-21: importer_id from the component row
        importer_id = component.importer_id
        entity_type_id = component.entity_type_id
        log = log.bind(importer_id=importer_id, entity_type_id=entity_type_id)

        # Fallback display_name from content_text (used when no field values found)
        fallback_name = (component.content_text or "").strip()[:200] or component_id

        # Convert embedding from tuple (Component) to list[float] (EntityInstance)
        embedding: list[float] | None = list(component.embedding) if component.embedding else None

        # Build a stable deterministic id: same component always maps to same instance.
        # Use a UUID5 (SHA1 namespace) from the component_id so upsert is idempotent.
        instance_id = str(uuid.uuid5(uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8"), component_id))

        # ── Enrich: load confirmed field children + their extraction records ───
        field_children = await self._entity_instances.find_confirmed_field_children(component_id)
        log.info("promote_entity_field_children_loaded", count=len(field_children))

        # Load EntityType for label + field schema (slug, is_identifier, sort_order)
        entity_type = await self._entity_types.find_by_id(entity_type_id)

        # Load extraction records for all field children in parallel
        all_extraction_records: list[ExtractionRecord] = []
        if field_children and entity_type is not None:
            records_lists = await _gather_extraction_records(field_children, self._extractions)
            for recs in records_lists:
                all_extraction_records.extend(recs)

        # Build identifiers and display_name
        if entity_type is not None and field_children:
            identifiers, display_name = _build_identifiers_and_display_name(
                field_children=field_children,
                all_extraction_records=all_extraction_records,
                entity_type=entity_type,
                fallback_name=fallback_name,
            )
        else:
            identifiers = {}
            display_name = (
                f"{entity_type.label} · {fallback_name}"
                if entity_type is not None and fallback_name != component_id
                else fallback_name
            )

        entity_instance = EntityInstance(
            id=instance_id,
            importer_id=importer_id,
            entity_type_id=entity_type_id,
            nauta_id=None,
            source=_SOURCE,
            display_name=display_name,
            identifiers=identifiers,
            aliases=[],
            embedding=embedding,
            summary_text=None,
            is_active=True,
        )

        # Upsert — idempotent on id (D-10 re-runnable)
        persisted = await self._entity_instances.upsert(entity_instance)
        log.info("promote_entity_on_confirm_upserted", instance_id=persisted.id)

        # ── Occurrence links: write was_selected=True for each field child ─────
        # These links are identity assignments (the field child IS this entity's
        # occurrence), not duplicate suggestions. The self-skip below (for the
        # BlendedRAG duplicate loop) is separate — do not confuse the two.
        for field_child in field_children:
            try:
                await self._entity_instances.record_candidate_link(
                    component_id=field_child.id,
                    entity_instance_id=persisted.id,
                    entity_type_id=entity_type_id,
                    match_type="identifier_exact",
                    similarity_score=1.0,
                    was_selected=True,
                )
            except Exception:
                log.warning(
                    "promote_entity_field_child_link_failed",
                    field_child_id=field_child.id,
                    exc_info=True,
                )

        # Run BlendedRAG resolution to surface candidates (D-07/D-12)
        candidates = self._resolution_repo.find_candidates(
            display_name=persisted.display_name,
            identifiers=persisted.identifiers,
            entity_type_id=entity_type_id,
            importer_id=importer_id,
            embedding=persisted.embedding,
        )

        # Write provenance for each candidate (D-09); D-05 no merge
        for candidate in candidates:
            # A freshly-promoted entity always lexically matches itself; that
            # self-hit is not a duplicate suggestion. Skip provenance + alias for
            # the instance itself so the gallery never shows an entity as its own
            # pending duplicate (D-18 pending-duplicates correctness).
            if candidate.entity_instance_id == instance_id:
                continue
            try:
                await self._entity_instances.record_candidate_link(
                    component_id=component_id,
                    entity_instance_id=candidate.entity_instance_id,
                    entity_type_id=entity_type_id,
                    match_type=candidate.match_type,
                    similarity_score=candidate.rrf_score,
                )
            except Exception:
                log.warning(
                    "promote_entity_candidate_link_failed",
                    entity_instance_id=candidate.entity_instance_id,
                    exc_info=True,
                )

            # D-11 alias flywheel: record the variant display_name as an alias on
            # the surviving (different) identity.
            try:
                await self._entity_instances.append_alias(
                    entity_instance_id=candidate.entity_instance_id,
                    alias=display_name,
                )
            except Exception:
                log.warning(
                    "promote_entity_alias_write_failed",
                    entity_instance_id=candidate.entity_instance_id,
                    exc_info=True,
                )

        log.info("promote_entity_on_confirm_done", candidates=len(candidates))


async def _gather_extraction_records(
    field_children: list[Component],
    extractions: ExtractionRepository,
) -> list[list[ExtractionRecord]]:
    """Load extraction records for all field children concurrently."""
    tasks = [extractions.find_by_component_id(child.id) for child in field_children]
    return list(await asyncio.gather(*tasks))
