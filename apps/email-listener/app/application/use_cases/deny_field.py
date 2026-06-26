"""DenyFieldUseCase — origin-aware field deny (D-18) + the D-19 rejection memo.

Architecture contract: imports ONLY domain ports and entities.
No infrastructure imports permitted (verified by lint-imports rule).

Origin-aware deny (D-18), mantra "your boxes never disappear; the AI's guesses do":

  AUTO-DETECTED box (content_raw lineage origin == "auto_detected", stamped by
    AutofillFieldsUseCase in 09-02b):
      - soft-reject the box: update_status(component_id, "rejected") — kept in
        history, removed from the default view (it was a machine guess).
      - remember the denial (D-19): append the denied box's canonical polygon to
        the PARENT entity component's content_raw["denied_field_polygons"] list so
        a 09-02b re-run of autofill-fields does NOT re-propose the same box.

  USER-DRAWN box (any other origin / no lineage):
      - keep the geometry — never soft-reject a box the user drew.
      - clear the wrong candidate: clear_candidate_fields(component_id) clears
        entity_type_field_id (reverts to unclassified-with-geometry).
      - supersede the candidate ExtractionRecord(s) (status -> "superseded", D-16)
        so the wrong value/property is cleared.

D-19 memo mechanism (Claude's Discretion): the parent's denied_field_polygons
list is stored under content_raw (the Phase-6 lineage convention — content_raw is
the per-component metadata sidecar). MEDIUM-4: the polygon is appended via the
ComponentRepository.append_denied_polygon ATOMIC server-side jsonb UPDATE (never a
full-row read-modify-write), so concurrent denies cannot lose entries; only
content_raw is touched (not geometry), consistent with supersede-never-mutate.
AutofillFieldsUseCase (09-02b) reads this list to exclude overlapping re-proposals
(D-19).

Tenant-from-component guard (D-18) on every path: importer_id is derived from the
loaded field component, never from the caller.
"""

from __future__ import annotations

import structlog

from app.domain.entities.component import Component
from app.domain.ports.component_repository import ComponentRepository
from app.domain.ports.extraction_repository import ExtractionRepository

logger = structlog.get_logger(__name__)

_AUTO_DETECTED_ORIGIN = "auto_detected"


def _lineage_origin(content_raw: dict[str, object] | None) -> str | None:
    """Return the lineage origin marker from content_raw, or None.

    Recognizes both the canonical nested location (content_raw["lineage"]["origin"],
    the Phase-6 convention) and a flat top-level content_raw["origin"] so that
    however AutofillFieldsUseCase (09-02b) stamps the marker, it is detected.
    """
    if not content_raw:
        return None
    lineage = content_raw.get("lineage")
    if isinstance(lineage, dict):
        origin = lineage.get("origin")
        if isinstance(origin, str):
            return origin
    top_level = content_raw.get("origin")
    return top_level if isinstance(top_level, str) else None


def _component_polygon(component: Component) -> list[list[float]] | None:
    """Return the component's canonical polygon from location, or None."""
    polygon = component.location.get("polygon")
    if isinstance(polygon, list):
        return polygon
    return None


class DenyFieldUseCase:
    """Deny a field box — origin-aware (D-18) + record the D-19 denial memo."""

    def __init__(
        self,
        *,
        components: ComponentRepository,
        extractions: ExtractionRepository,
    ) -> None:
        self._components = components
        self._extractions = extractions

    async def execute(
        self,
        *,
        component_id: str,
        importer_id: str | None = None,
    ) -> Component:
        """Deny the field component; returns the refreshed (or unchanged) Component.

        importer_id (D-18): when None, the tenant is derived from the loaded
        component. When given, a mismatch with the component's importer 404s.

        Raises:
            ValueError: if the component cannot be found (or tenant mismatch).
        """
        log = logger.bind(component_id=component_id)
        log.info("deny_field_start")

        component = await self._components.find_by_id(component_id)
        if component is None:
            log.warning("deny_field_component_not_found")
            raise ValueError(f"Component not found: {component_id}")

        # D-18: derive tenant from the component row; explicit mismatch 404s.
        if importer_id is not None and component.importer_id != importer_id:
            log.warning("deny_field_component_importer_mismatch")
            raise ValueError(f"Component not found: {component_id}")

        origin = _lineage_origin(component.content_raw)
        if origin == _AUTO_DETECTED_ORIGIN:
            return await self._deny_auto_detected(component, log)
        return await self._deny_user_drawn(component, log)

    async def _deny_auto_detected(
        self,
        component: Component,
        log: structlog.stdlib.BoundLogger,
    ) -> Component:
        """Soft-reject the machine guess + remember it on the parent (D-18/D-19)."""
        log.info("deny_field_auto_detected")

        # D-19 (MEDIUM-4): atomically append the denied polygon to the parent
        # entity's memo via a single server-side jsonb UPDATE — never a full-row
        # read-modify-write — so concurrent denies cannot lose entries. Done BEFORE
        # the status flip so the box's live geometry is the one being recorded.
        polygon = _component_polygon(component)
        if polygon is not None and component.parent_component_id is not None:
            await self._components.append_denied_polygon(component.parent_component_id, polygon)
            log.info("deny_field_denial_memo_recorded", parent_component_id=component.parent_component_id)
        else:
            log.warning("deny_field_no_polygon_or_parent_memo_skipped")

        # D-18: soft-reject the auto-detected box (kept in history).
        updated = await self._components.update_status(component.id, "rejected")
        log.info("deny_field_auto_detected_done")
        return updated

    async def _deny_user_drawn(
        self,
        component: Component,
        log: structlog.stdlib.BoundLogger,
    ) -> Component:
        """Keep the user's box; clear the wrong candidate value/property (D-18)."""
        log.info("deny_field_user_drawn")

        # D-18: keep geometry, clear the wrong field mapping.
        updated = await self._components.clear_candidate_fields(component.id)
        # D-16: supersede the candidate ExtractionRecord(s) so the wrong
        # value/property is cleared (never delete).
        await self._extractions.supersede_active(component.id)
        log.info("deny_field_user_drawn_done")
        return updated
