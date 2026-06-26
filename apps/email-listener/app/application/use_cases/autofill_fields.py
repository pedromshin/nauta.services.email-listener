"""AutofillFieldsUseCase — entity-scoped sub-field auto-detect + autofill (D-13/14/15/19).

Given a selected ENTITY component, this use case:
  1. Resolves the EntityType + property schema from the component's first-class
     entity_type_id column (D-03), guarding role/tenant (D-18).
  2. Auto-detects FIELD boxes INSIDE the entity bbox by filtering the page's
     04-13 token geometry to the entity polygon (reusing propose_regions.py's
     _page_tokens + _union_polygon grounding) and running the SegmenterProtocol
     over only those tokens, then grounding each proposal's polygon in real
     token bboxes (never an invented box).
  3. EXCLUDES any proposal overlapping a remembered denied polygon read from the
     entity's content_raw["denied_field_polygons"] memo (written by 09-02a's
     DenyFieldUseCase) — D-19, a real geometry overlap test (not exact match).
  4. Persists the surviving auto-detected boxes as candidate FIELD Components
     stamped content_raw {"origin": "auto_detected"} (so 09-02a's DenyFieldUseCase
     can branch, D-18), and ALSO incorporates any FIELD children the user already
     drew inside the entity.
  5. For each field child, runs the autofill path (cold-start KB = entity type
     description, + few-shot when embedder/retrieval present) to get a candidate
     value, maps it to the best property (entity_type_field_id), and a per-field
     confidence; persists an ExtractionRecord(status="candidate") per child and
     sets the child's entity_type_field_id via update_field_relationship. Nothing
     auto-confirms (D-14).

LLM-call structure (Claude's Discretion, D-CONTEXT): one autofiller.autofill call
PER field child (mirrors AutofillUseCase's per-component contract exactly, so the
few-shot flywheel + cold-start degradation are reused verbatim) rather than one
call per entity. The constraint — token-grounded boxes + property mapping +
per-field confidence — is satisfied: boxes are grounded in real token bboxes, the
property is the extracted field with the highest per-field confidence, and the
confidence is that field's score.

Architecture contract: imports ONLY domain ports and entities. No infrastructure
imports permitted (verified by lint-imports rule).
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TypeAlias

import structlog

from app.domain.entities.component import Component
from app.domain.entities.entity_type import EntityType
from app.domain.entities.extraction_record import ExtractionRecord
from app.domain.ports.autofill_protocol import AutofillProtocol
from app.domain.ports.component_repository import ComponentRepository
from app.domain.ports.embedding_protocol import EmbeddingProtocol
from app.domain.ports.entity_type_repository import EntityTypeRepository
from app.domain.ports.extraction_repository import ExtractionRepository
from app.domain.ports.retrieval_port import RetrievalPort, RetrievedExample
from app.domain.ports.segmenter_protocol import PageToken, ProposedRegion
from app.domain.services.key_terms import extract_key_terms

logger = structlog.get_logger(__name__)

_FULL_PAGE_POLYGON: list[list[float]] = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
_AUTO_DETECTED_ORIGIN = "auto_detected"
_DENIED_POLYGONS_KEY = "denied_field_polygons"

# A "Box" is (left, top, right, bottom) in normalized [0,1] page coordinates.
_Box: TypeAlias = tuple[float, float, float, float]


@dataclass(frozen=True)
class AutofilledField:
    """One autofilled field child returned to the caller (per-field result view).

    field_component_id: the FIELD child Component id (auto-detected or user-drawn).
    entity_type_field_id: the mapped property (best-confidence extracted field), or None.
    candidate_value: the candidate value for that property, or None.
    confidence: per-field confidence in [0, 1].
    """

    field_component_id: str
    entity_type_field_id: str | None
    candidate_value: object | None
    confidence: float


def _page_tokens(page: Component) -> list[PageToken]:
    """Read 04-13 token geometry from page.content_raw into PageToken objects.

    Mirrors propose_regions._page_tokens — returns [] when no usable tokens.
    """
    raw = page.content_raw
    if not isinstance(raw, dict):
        return []
    raw_tokens = raw.get("tokens")
    if not isinstance(raw_tokens, list):
        return []

    tokens: list[PageToken] = []
    for index, entry in enumerate(raw_tokens):
        if not isinstance(entry, dict):
            continue
        bbox = entry.get("bbox")
        if not (isinstance(bbox, (list, tuple)) and len(bbox) == 4):
            continue
        tokens.append(
            PageToken(
                index=index,
                text=str(entry.get("text", "")),
                bbox=(float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])),
            )
        )
    return tokens


def _union_polygon(boxes: list[tuple[float, float, float, float]]) -> list[list[float]]:
    """Return a 4-corner [x,y] polygon bounding the union of (left,top,width,height) boxes.

    Mirrors propose_regions._union_polygon — falls back to the full-page polygon
    when the box list is empty (never an invented box).
    """
    if not boxes:
        return _FULL_PAGE_POLYGON
    lefts = [b[0] for b in boxes]
    tops = [b[1] for b in boxes]
    rights = [b[0] + b[2] for b in boxes]
    bottoms = [b[1] + b[3] for b in boxes]
    min_left = min(lefts)
    min_top = min(tops)
    max_right = max(rights)
    max_bottom = max(bottoms)
    return [
        [min_left, min_top],
        [max_right, min_top],
        [max_right, max_bottom],
        [min_left, max_bottom],
    ]


def _polygon_bounds(polygon: object) -> _Box | None:
    """Collapse a list of [x,y] points to its (left, top, right, bottom) bounds.

    Returns None when the polygon is missing or malformed.
    """
    if not isinstance(polygon, list) or not polygon:
        return None
    xs: list[float] = []
    ys: list[float] = []
    for point in polygon:
        if not (isinstance(point, (list, tuple)) and len(point) >= 2):
            return None
        try:
            xs.append(float(point[0]))
            ys.append(float(point[1]))
        except (TypeError, ValueError):
            return None
    if not xs or not ys:
        return None
    return (min(xs), min(ys), max(xs), max(ys))


def _token_bbox_to_box(bbox: tuple[float, float, float, float]) -> _Box:
    """Convert a (left, top, width, height) token bbox to (left, top, right, bottom)."""
    left, top, width, height = bbox
    return (left, top, left + width, top + height)


def _bbox_center_inside(box: _Box, container: _Box) -> bool:
    """True when the center of *box* falls inside *container* (containment test)."""
    cx = (box[0] + box[2]) / 2.0
    cy = (box[1] + box[3]) / 2.0
    return container[0] <= cx <= container[2] and container[1] <= cy <= container[3]


def _boxes_overlap(a: _Box, b: _Box) -> bool:
    """True when axis-aligned boxes a and b share any positive-area intersection."""
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def _child_origin(child: Component) -> str | None:
    """Return the lineage origin marker from a child's content_raw, or None.

    Recognizes the flat content_raw["origin"] that AutofillFieldsUseCase stamps on
    auto-detected children (HIGH-1 defense-in-depth dedupe by origin).
    """
    raw = child.content_raw
    if not isinstance(raw, dict):
        return None
    origin = raw.get("origin")
    return origin if isinstance(origin, str) else None


def _dedupe_by_id(children: list[Component]) -> list[Component]:
    """Return children with duplicate ids removed, preserving first-seen order (HIGH-1)."""
    seen: set[str] = set()
    unique: list[Component] = []
    for child in children:
        if child.id in seen:
            continue
        seen.add(child.id)
        unique.append(child)
    return unique


def _denied_boxes(entity: Component) -> list[_Box]:
    """Read the entity's content_raw["denied_field_polygons"] memo into bounds boxes (D-19)."""
    raw = entity.content_raw
    if not isinstance(raw, dict):
        return []
    polygons = raw.get(_DENIED_POLYGONS_KEY)
    if not isinstance(polygons, list):
        return []
    boxes: list[_Box] = []
    for polygon in polygons:
        bounds = _polygon_bounds(polygon)
        if bounds is not None:
            boxes.append(bounds)
    return boxes


def _example_to_dict(example: RetrievedExample) -> dict[str, object]:
    """Convert a RetrievedExample to the dict format AutofillProtocol expects."""
    return {
        "content_text": example.content_text,
        "extracted_fields": dict(example.extracted_fields),
        "score": example.score,
    }


def _best_field_mapping(
    extracted_fields: dict[str, object],
    confidence_breakdown: dict[str, object] | None,
    overall_confidence: float,
    entity_type: EntityType,
) -> tuple[str | None, object | None, float]:
    """Map an AutofillResult to the best (entity_type_field_id, value, confidence).

    The "best" property is the extracted field with the highest per-field
    confidence whose slug exists on the entity type's schema; the value is that
    field's extracted value; the confidence is its per-field score (falling back
    to the overall score when no per-field breakdown is available).

    The returned identity is the field's uuid ``id`` — NOT its slug. The slug is
    the LLM's schema key (used to look the field up); ``entity_type_field_id`` is
    a uuid FK (CRIT-1), so the mapping must persist the uuid the column references.
    """
    field_by_slug = {f.slug: f for f in entity_type.fields}
    best_field_id: str | None = None
    best_value: object | None = None
    best_conf: float = 0.0

    for slug, value in extracted_fields.items():
        field = field_by_slug.get(slug)
        if field is None or value is None or value == "":
            continue
        conf = _coerce_confidence(confidence_breakdown, slug, overall_confidence)
        if best_field_id is None or conf > best_conf:
            best_field_id = field.id
            best_value = value
            best_conf = conf

    if best_field_id is None:
        return (None, None, overall_confidence)
    return (best_field_id, best_value, best_conf)


def _coerce_confidence(
    confidence_breakdown: dict[str, object] | None,
    slug: str,
    fallback: float,
) -> float:
    """Read a per-field confidence from the breakdown, clamped to [0, 1]."""
    if isinstance(confidence_breakdown, dict):
        raw = confidence_breakdown.get(slug)
        if isinstance(raw, (int, float)):
            return max(0.0, min(1.0, float(raw)))
    return max(0.0, min(1.0, fallback))


class AutofillFieldsUseCase:
    """Entity-scoped sub-field auto-detect + autofill (D-13/14/15/19).

    Collaborators (all domain ports):
        components: ComponentRepository — load entity/page, persist field children.
        entity_types: EntityTypeRepository — resolve EntityType + property schema by id.
        extractions: ExtractionRepository — persist candidate ExtractionRecords.
        autofiller: AutofillProtocol — LLM-backed per-field extraction.
        segmenter: SegmenterProtocol — LLM-backed sub-field box detection.
        embedder: EmbeddingProtocol | None — few-shot embedder (D-15).
        retrieval: RetrievalPort | None — few-shot retrieval (D-15).

    Tenant isolation (D-18): importer_id is derived from the loaded entity
    component row; an explicit mismatch 404s (auth seam).
    """

    def __init__(
        self,
        *,
        components: ComponentRepository,
        entity_types: EntityTypeRepository,
        extractions: ExtractionRepository,
        autofiller: AutofillProtocol,
        segmenter: object,
        embedder: EmbeddingProtocol | None = None,
        retrieval: RetrievalPort | None = None,
    ) -> None:
        self._components = components
        self._entity_types = entity_types
        self._extractions = extractions
        self._autofiller = autofiller
        self._segmenter = segmenter
        self._embedder = embedder
        self._retrieval = retrieval

    async def execute(
        self,
        *,
        entity_component_id: str,
        importer_id: str | None = None,
    ) -> list[AutofilledField]:
        """Auto-detect + autofill the entity's sub-fields; return per-field results.

        Raises:
            ValueError: entity missing / not role='entity' / entity_type_id None /
                tenant mismatch / entity type not found.
        """
        log = logger.bind(entity_component_id=entity_component_id)
        log.info("autofill_fields_start")

        entity = await self._load_entity(entity_component_id, importer_id, log)
        importer_id = entity.importer_id

        entity_type = await self._entity_types.find_by_id(entity.entity_type_id or "")
        if entity_type is None:
            log.warning("autofill_fields_entity_type_not_found")
            raise ValueError(f"EntityType not found: {entity.entity_type_id}")

        # ── Auto-detect new field boxes inside the entity bbox ───────────────
        auto_children = await self._detect_field_boxes(entity=entity, log=log)
        persisted_children = await self._components.save_many(auto_children) if auto_children else []

        # ── Incorporate existing user-drawn FIELD children ───────────────────
        # HIGH-1: exclude the children we JUST persisted from the existing read so
        # a reflecting repository (find_by_page_component_id that now returns the
        # saved rows) does not surface them a second time.
        persisted_ids = {child.id for child in persisted_children}
        existing_children = await self._existing_field_children(entity, exclude_ids=persisted_ids)

        # HIGH-1: de-duplicate by child.id (order-preserving) so each field box is
        # autofilled EXACTLY once — never twice (no duplicate LLM calls /
        # ExtractionRecords / update_field_relationship writes / UI entries).
        all_children = _dedupe_by_id([*persisted_children, *existing_children])
        log.info(
            "autofill_fields_children_resolved",
            auto_detected=len(persisted_children),
            user_drawn=len(existing_children),
            total=len(all_children),
        )

        # ── Autofill each field child as a CANDIDATE (nothing auto-confirms) ──
        # Semaphore(4) caps concurrent Bedrock calls — 18 fields ≈ 17s parallel
        # instead of ≈ 63s sequential, staying inside the ALB 60s idle timeout.
        _sem = asyncio.Semaphore(4)

        async def _limited(child: Component) -> AutofilledField:
            async with _sem:
                return await self._autofill_child(
                    child=child,
                    entity_type=entity_type,
                    importer_id=importer_id,
                )

        results = list(await asyncio.gather(*(_limited(c) for c in all_children)))

        log.info("autofill_fields_done", field_count=len(results))
        return results

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _load_entity(
        self,
        entity_component_id: str,
        importer_id: str | None,
        log: structlog.stdlib.BoundLogger,
    ) -> Component:
        """Load + guard the entity component (role, entity_type_id, tenant)."""
        entity = await self._components.find_by_id(entity_component_id)
        if entity is None:
            log.warning("autofill_fields_component_not_found")
            raise ValueError(f"Component not found: {entity_component_id}")

        # D-13: must be an entity region with a known entity type.
        if entity.role != "entity" or entity.entity_type_id is None:
            log.warning("autofill_fields_not_an_entity", role=entity.role)
            raise ValueError(f"Component not found: {entity_component_id}")

        # D-18: derive tenant from the component row; explicit mismatch 404s.
        if importer_id is not None and entity.importer_id != importer_id:
            log.warning("autofill_fields_component_importer_mismatch")
            raise ValueError(f"Component not found: {entity_component_id}")
        return entity

    async def _detect_field_boxes(
        self,
        *,
        entity: Component,
        log: structlog.stdlib.BoundLogger,
    ) -> list[Component]:
        """Segment the entity's interior tokens into grounded, denied-aware children."""
        entity_bounds = _polygon_bounds(entity.location.get("polygon"))
        if entity_bounds is None:
            log.warning("autofill_fields_entity_polygon_missing")
            return []

        page = await self._find_entity_page(entity)
        if page is None:
            log.warning("autofill_fields_page_not_found")
            return []

        page_index = _coerce_page_index(entity)
        interior_tokens = [
            token for token in _page_tokens(page) if _bbox_center_inside(_token_bbox_to_box(token.bbox), entity_bounds)
        ]
        if not interior_tokens:
            log.info("autofill_fields_no_interior_tokens")
            return []

        try:
            proposals = await self._segmenter.segment(  # type: ignore[attr-defined]
                tokens=tuple(interior_tokens),
                page_index=page_index,
            )
        except Exception:
            log.exception("autofill_fields_segment_failed")
            return []

        denied = _denied_boxes(entity)
        token_by_index = {token.index: token for token in interior_tokens}
        children: list[Component] = []

        for seq_idx, proposal in enumerate(proposals):
            child = self._build_child(
                proposal=proposal,
                entity=entity,
                token_by_index=token_by_index,
                denied=denied,
                page_index=page_index,
                sequence_offset=seq_idx,
                log=log,
            )
            if child is not None:
                children.append(child)
        return children

    def _build_child(
        self,
        *,
        proposal: ProposedRegion,
        entity: Component,
        token_by_index: dict[int, PageToken],
        denied: list[_Box],
        page_index: int,
        sequence_offset: int,
        log: structlog.stdlib.BoundLogger,
    ) -> Component | None:
        """Ground a proposal in real token bboxes; skip if it overlaps a denied box."""
        selected_boxes = [token_by_index[i].bbox for i in proposal.token_indices if i in token_by_index]
        entity_polygon = entity.location.get("polygon")
        polygon = (
            _union_polygon(selected_boxes)
            if selected_boxes
            else (entity_polygon if isinstance(entity_polygon, list) and entity_polygon else _FULL_PAGE_POLYGON)
        )

        # D-19: exclude proposals overlapping any remembered denied polygon.
        proposal_bounds = _polygon_bounds(polygon)
        if proposal_bounds is not None and any(_boxes_overlap(proposal_bounds, d) for d in denied):
            log.info("autofill_fields_proposal_excluded_denied")
            return None

        return Component(
            id=str(uuid.uuid4()),
            email_id=entity.email_id,
            importer_id=entity.importer_id,
            attachment_id=entity.attachment_id,
            parent_component_id=entity.id,
            source_type="region",
            location={"page_index": page_index, "polygon": polygon},
            content_text=proposal.content_text,
            content_markdown=None,
            content_raw={"origin": _AUTO_DETECTED_ORIGIN},
            embedding=None,
            sequence_index=sequence_offset,
            extraction_status="candidate",
            role="field",
        )

    async def _find_entity_page(self, entity: Component) -> Component | None:
        """Return the attachment_page component on the entity's page, or None."""
        if entity.attachment_id is None:
            return None
        pages = await self._components.find_pages_by_attachment(entity.attachment_id)
        if not pages:
            return None
        target_index = _coerce_page_index(entity)
        for page in pages:
            if _coerce_page_index(page) == target_index:
                return page
        return pages[0]

    async def _existing_field_children(
        self,
        entity: Component,
        *,
        exclude_ids: frozenset[str] | set[str] = frozenset(),
    ) -> list[Component]:
        """Return the entity's existing FIELD children (role='field', live status).

        HIGH-1 defense-in-depth: the just-persisted auto-detected children (status
        'candidate', origin 'auto_detected') are excluded by id AND by origin so a
        repository that reflects the saved rows back through
        find_by_page_component_id never causes a field box to be autofilled twice.
        """
        children = await self._components.find_by_page_component_id(entity.id)
        return [
            child
            for child in children
            if child.role == "field"
            and child.extraction_status not in ("rejected", "superseded")
            and child.id not in exclude_ids
            and _child_origin(child) != _AUTO_DETECTED_ORIGIN
        ]

    async def _autofill_child(
        self,
        *,
        child: Component,
        entity_type: EntityType,
        importer_id: str,
    ) -> AutofilledField:
        """Run autofill for one field child; persist a candidate record + mapping."""
        log = logger.bind(field_component_id=child.id, entity_type_id=entity_type.id)
        knowledge_base_text = entity_type.description or ""
        examples = await self._retrieve_examples(child, entity_type, importer_id, log)

        routing_reason = "few_shot_autofill_fields" if examples else "cold_start_autofill_fields"
        result = await self._autofiller.autofill(
            region_text=child.content_text,
            entity_type=entity_type,
            knowledge_base_text=knowledge_base_text,
            examples=examples,
        )

        field_id, value, confidence = _best_field_mapping(
            result.extracted_fields,
            result.confidence_breakdown,
            result.confidence_score,
            entity_type,
        )

        record = ExtractionRecord(
            id=str(uuid.uuid4()),
            importer_id=importer_id,
            component_id=child.id,
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

        # D-04/D-11: persist the property mapping on the field child (parent kept).
        if field_id is not None:
            await self._components.update_field_relationship(
                child.id,
                child.parent_component_id,
                field_id,
            )

        log.info("autofill_fields_child_done", entity_type_field_id=field_id, confidence=confidence)
        return AutofilledField(
            field_component_id=child.id,
            entity_type_field_id=field_id,
            candidate_value=value,
            confidence=confidence,
        )

    async def _retrieve_examples(
        self,
        child: Component,
        entity_type: EntityType,
        importer_id: str,
        log: structlog.stdlib.BoundLogger,
    ) -> tuple[dict[str, object], ...]:
        """Embed + retrieve few-shot examples; cold-start safe on [] (D-13/D-15)."""
        if self._embedder is None or self._retrieval is None:
            return ()
        try:
            region_text = child.content_text or ""
            embedding = await self._embedder.embed(text=region_text)
            retrieved = await self._retrieval.find_similar_confirmed(
                component_embedding=embedding,
                entity_type_id=entity_type.id,
                importer_id=importer_id,
                key_terms=extract_key_terms(region_text),
                top_n=3,
            )
            if retrieved:
                return tuple(_example_to_dict(ex) for ex in retrieved)
            return ()
        except Exception:
            log.warning("autofill_fields_retrieval_failed_fallback_cold_start", exc_info=True)
            return ()


def _coerce_page_index(component: Component) -> int:
    """Read page_index from a component's location, defaulting to 0.

    LOW-5: coerce numerically first so a float page_index (e.g. ``2.0`` from JSON)
    maps to ``2`` rather than silently collapsing to ``0`` (``"2.0".isdigit()`` is
    False). bool is excluded explicitly (it is an int subclass we do not want to
    treat as a page index).
    """
    raw = component.location.get("page_index", 0)
    if isinstance(raw, bool):
        return 0
    if isinstance(raw, (int, float)):
        return int(raw)
    if isinstance(raw, str):
        text = raw.strip()
        try:
            return int(float(text)) if text else 0
        except ValueError:
            return 0
    return 0
