"""Per-behavior unit tests for AutofillFieldsUseCase — entity-scoped sub-field
auto-detect + autofill (D-13/D-14/D-19).

Covers the five behaviors from 09-02b Task 1, each individually traceable via `-k`:
  - guard: a non-entity component (role != 'entity' or entity_type_id None) raises.
  - candidate creation: a valid entity produces >=1 candidate FIELD child whose
    persisted ExtractionRecord has status='candidate' (nothing auto-confirms, D-14).
  - origin stamp: auto-detected children carry content_raw origin='auto_detected'
    (so 09-02a DenyFieldUseCase can branch, D-18).
  - D-19 exclusion: a segmenter proposal overlapping a remembered denied polygon
    (entity content_raw.denied_field_polygons) is NOT turned into a field child.
  - tenant mismatch: an explicit importer_id mismatch raises (D-18).

All tests use AsyncMock repositories/protocols (the project convention) plus a
tiny in-memory fake segmenter/autofiller — no infrastructure dependencies.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.autofill_fields import AutofillFieldsUseCase
from app.domain.entities.component import Component
from app.domain.entities.entity_type import EntityType, EntityTypeField
from app.domain.ports.autofill_protocol import AutofillResult
from app.domain.ports.segmenter_protocol import PageToken, ProposedRegion

_ENTITY_ID = "comp-0000-0000-0000-0000-0000000000e1"
_PAGE_ID = "comp-0000-0000-0000-0000-0000000000a1"
_IMPORTER_ID = "imp-0000-0000-0000-0000-000000000001"
_OTHER_IMPORTER_ID = "imp-0000-0000-0000-0000-000000000002"
_ENTITY_TYPE_ID = "etype-0000-0000-0000-0000-000000000001"
_EMAIL_ID = "email-0001"
_ATTACHMENT_ID = "attach-0001"
# Field uuids — entity_type_field_id is a uuid FK (CRIT-1), never a slug.
_FIELD_NAME_ID = "efield-0000-0000-0000-0000-00000000name"
_FIELD_TAX_ID = "efield-0000-0000-0000-0000-000000000tax"

# Entity bbox occupies the top-left quadrant of the page.
_ENTITY_POLYGON = [[0.0, 0.0], [0.5, 0.0], [0.5, 0.5], [0.0, 0.5]]

# Tokens inside the entity (top-left) and outside (bottom-right).
_TOKEN_INSIDE = {"text": "ACME", "bbox": [0.1, 0.1, 0.1, 0.05]}
_TOKEN_INSIDE_2 = {"text": "Corp", "bbox": [0.25, 0.1, 0.1, 0.05]}
_TOKEN_OUTSIDE = {"text": "FOOTER", "bbox": [0.7, 0.8, 0.1, 0.05]}


def _entity_type() -> EntityType:
    return EntityType(
        id=_ENTITY_TYPE_ID,
        importer_id=None,
        slug="company",
        label="Company",
        description="A company entity",
        is_active=True,
        embedding=None,
        fields=(
            EntityTypeField(
                id=_FIELD_NAME_ID,
                slug="name",
                label="Name",
                data_type="string",
                is_identifier=True,
                is_required=True,
                description="Legal name",
                sort_order=0,
            ),
            EntityTypeField(
                id=_FIELD_TAX_ID,
                slug="tax_id",
                label="Tax ID",
                data_type="string",
                is_identifier=False,
                is_required=False,
                description="Tax identifier",
                sort_order=1,
            ),
        ),
    )


def _entity_component(
    *,
    role: str | None = "entity",
    entity_type_id: str | None = _ENTITY_TYPE_ID,
    importer_id: str = _IMPORTER_ID,
    content_raw: dict[str, object] | None = None,
) -> Component:
    return Component(
        id=_ENTITY_ID,
        email_id=_EMAIL_ID,
        importer_id=importer_id,
        attachment_id=_ATTACHMENT_ID,
        parent_component_id=_PAGE_ID,
        source_type="region",
        location={"page_index": 0, "polygon": _ENTITY_POLYGON},
        content_text="ACME Corp",
        content_markdown=None,
        content_raw=content_raw,
        embedding=None,
        sequence_index=0,
        extraction_status="candidate",
        role=role,
        entity_type_id=entity_type_id,
    )


def _page_component(*, tokens: list[dict[str, object]]) -> Component:
    return Component(
        id=_PAGE_ID,
        email_id=_EMAIL_ID,
        importer_id=_IMPORTER_ID,
        attachment_id=_ATTACHMENT_ID,
        parent_component_id=None,
        source_type="attachment_page",
        location={"page_index": 0, "polygon": [[0, 0], [1, 0], [1, 1], [0, 1]]},
        content_text="ACME Corp ... FOOTER",
        content_markdown=None,
        content_raw={"tokens": tokens},
        embedding=None,
        sequence_index=0,
        extraction_status="pending",
    )


class _FakeSegmenter:
    """Returns canned proposals; records the tokens it was handed."""

    def __init__(self, proposals: list[ProposedRegion]) -> None:
        self._proposals = proposals
        self.seen_tokens: tuple[PageToken, ...] = ()

    async def segment(self, *, tokens: tuple[PageToken, ...], page_index: int) -> list[ProposedRegion]:
        self.seen_tokens = tokens
        return self._proposals


class _FakeAutofiller:
    """Returns a candidate extraction for the first field of the entity type."""

    def __init__(self, *, value: object = "ACME Corp", confidence: float = 0.9) -> None:
        self._value = value
        self._confidence = confidence
        self.calls: list[str] = []

    async def autofill(
        self,
        *,
        region_text: str,
        entity_type: EntityType,
        knowledge_base_text: str,
        examples: tuple[dict[str, object], ...] = (),
    ) -> AutofillResult:
        self.calls.append(region_text)
        first_slug = entity_type.fields[0].slug if entity_type.fields else "value"
        return AutofillResult(
            extracted_fields={first_slug: self._value},
            confidence_score=self._confidence,
            confidence_breakdown={first_slug: self._confidence},
        )


def _proposal(*, token_indices: tuple[int, ...], text: str = "ACME Corp") -> ProposedRegion:
    return ProposedRegion(
        content_text=text,
        token_indices=token_indices,
        entity_type_hint=None,
        parent_index=None,
        page_index=0,
    )


def _build_use_case(
    *,
    entity: Component,
    page: Component,
    entity_type: EntityType | None,
    segmenter: _FakeSegmenter,
    autofiller: _FakeAutofiller,
    existing_children: list[Component] | None = None,
) -> tuple[AutofillFieldsUseCase, AsyncMock, AsyncMock]:
    components = AsyncMock()

    async def _find_by_id(component_id: str) -> Component | None:
        if component_id == _ENTITY_ID:
            return entity
        return None

    components.find_by_id.side_effect = _find_by_id
    components.find_pages_by_attachment.return_value = [page]
    components.find_by_page_component_id.return_value = existing_children or []
    # save_many echoes its input with refreshed identity (mirrors the real repo).
    components.save_many.side_effect = list

    async def _update_field_relationship(cid: str, _parent: str | None, field: str | None) -> Component:
        base = _field_child_lookup(cid, existing_children)
        return Component(**{**base.__dict__, "entity_type_field_id": field})

    components.update_field_relationship.side_effect = _update_field_relationship

    entity_types = AsyncMock()
    entity_types.find_by_id.return_value = entity_type

    extractions = AsyncMock()
    extractions.save.side_effect = lambda record: record

    use_case = AutofillFieldsUseCase(
        components=components,
        entity_types=entity_types,
        extractions=extractions,
        autofiller=autofiller,
        segmenter=segmenter,
    )
    return use_case, components, extractions


def _field_child_lookup(component_id: str, children: list[Component] | None) -> Component:
    for child in children or []:
        if child.id == component_id:
            return child
    # Auto-detected child created during the run — synthesize a stand-in.
    return Component(
        id=component_id,
        email_id=_EMAIL_ID,
        importer_id=_IMPORTER_ID,
        attachment_id=_ATTACHMENT_ID,
        parent_component_id=_ENTITY_ID,
        source_type="region",
        location={"page_index": 0, "polygon": _ENTITY_POLYGON},
        content_text="",
        content_markdown=None,
        content_raw={"origin": "auto_detected"},
        embedding=None,
        sequence_index=0,
        extraction_status="candidate",
        role="field",
    )


# ── Guard: non-entity component raises ───────────────────────────────────────


def test_autofill_fields_non_entity_role_raises() -> None:
    entity = _entity_component(role="field")
    page = _page_component(tokens=[_TOKEN_INSIDE])
    use_case, components, _ = _build_use_case(
        entity=entity,
        page=page,
        entity_type=_entity_type(),
        segmenter=_FakeSegmenter([]),
        autofiller=_FakeAutofiller(),
    )
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(use_case.execute(entity_component_id=_ENTITY_ID))
    components.save_many.assert_not_called()


def test_autofill_fields_missing_entity_type_id_raises() -> None:
    entity = _entity_component(entity_type_id=None)
    page = _page_component(tokens=[_TOKEN_INSIDE])
    use_case, _, _ = _build_use_case(
        entity=entity,
        page=page,
        entity_type=_entity_type(),
        segmenter=_FakeSegmenter([]),
        autofiller=_FakeAutofiller(),
    )
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(use_case.execute(entity_component_id=_ENTITY_ID))


def test_autofill_fields_missing_component_raises() -> None:
    components = AsyncMock()
    components.find_by_id.return_value = None
    entity_types = AsyncMock()
    extractions = AsyncMock()
    use_case = AutofillFieldsUseCase(
        components=components,
        entity_types=entity_types,
        extractions=extractions,
        autofiller=_FakeAutofiller(),
        segmenter=_FakeSegmenter([]),
    )
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(use_case.execute(entity_component_id="missing"))


# ── Candidate creation (D-14: nothing auto-confirms) ─────────────────────────


def test_autofill_fields_valid_entity_creates_candidate_field_child() -> None:
    entity = _entity_component()
    page = _page_component(tokens=[_TOKEN_INSIDE, _TOKEN_INSIDE_2, _TOKEN_OUTSIDE])
    segmenter = _FakeSegmenter([_proposal(token_indices=(0, 1))])
    autofiller = _FakeAutofiller()
    use_case, components, extractions = _build_use_case(
        entity=entity,
        page=page,
        entity_type=_entity_type(),
        segmenter=segmenter,
        autofiller=autofiller,
    )

    results = asyncio.run(use_case.execute(entity_component_id=_ENTITY_ID))

    # At least one field child + at least one candidate ExtractionRecord.
    assert len(results) >= 1
    assert components.save_many.called
    assert extractions.save.called
    saved_record = extractions.save.call_args[0][0]
    assert saved_record.status == "candidate"
    # The result view carries the property mapping + candidate value + confidence.
    first = results[0]
    assert first.entity_type_field_id is not None
    assert first.candidate_value is not None
    assert 0.0 <= first.confidence <= 1.0


def test_autofill_fields_maps_field_uuid_not_slug_into_relationship() -> None:
    # CRIT-1: the value persisted into entity_type_field_id (a uuid FK) must be
    # the field's uuid id — NOT its slug. The fake autofiller extracts the first
    # field ("name"), whose uuid is _FIELD_NAME_ID.
    entity = _entity_component()
    page = _page_component(tokens=[_TOKEN_INSIDE, _TOKEN_INSIDE_2])
    segmenter = _FakeSegmenter([_proposal(token_indices=(0, 1))])
    use_case, components, _ = _build_use_case(
        entity=entity,
        page=page,
        entity_type=_entity_type(),
        segmenter=segmenter,
        autofiller=_FakeAutofiller(),
    )

    results = asyncio.run(use_case.execute(entity_component_id=_ENTITY_ID))

    components.update_field_relationship.assert_called()
    written_field_id = components.update_field_relationship.call_args[0][2]
    assert written_field_id == _FIELD_NAME_ID
    assert written_field_id != "name"  # never the slug
    # The per-field result view mirrors the same uuid identity.
    assert results[0].entity_type_field_id == _FIELD_NAME_ID


def test_autofill_fields_grounds_only_tokens_inside_entity() -> None:
    # The segmenter must only ever see tokens whose bbox is inside the entity
    # polygon — the outside FOOTER token is filtered out (entity-scoped detect).
    entity = _entity_component()
    page = _page_component(tokens=[_TOKEN_INSIDE, _TOKEN_INSIDE_2, _TOKEN_OUTSIDE])
    segmenter = _FakeSegmenter([_proposal(token_indices=(0, 1))])
    use_case, _, _ = _build_use_case(
        entity=entity,
        page=page,
        entity_type=_entity_type(),
        segmenter=segmenter,
        autofiller=_FakeAutofiller(),
    )
    asyncio.run(use_case.execute(entity_component_id=_ENTITY_ID))

    seen_texts = [t.text for t in segmenter.seen_tokens]
    assert "ACME" in seen_texts
    assert "Corp" in seen_texts
    assert "FOOTER" not in seen_texts


# ── Origin stamp (D-18 branch source) ────────────────────────────────────────


def test_autofill_fields_auto_detected_children_are_origin_stamped() -> None:
    entity = _entity_component()
    page = _page_component(tokens=[_TOKEN_INSIDE, _TOKEN_INSIDE_2])
    segmenter = _FakeSegmenter([_proposal(token_indices=(0, 1))])
    use_case, components, _ = _build_use_case(
        entity=entity,
        page=page,
        entity_type=_entity_type(),
        segmenter=segmenter,
        autofiller=_FakeAutofiller(),
    )
    asyncio.run(use_case.execute(entity_component_id=_ENTITY_ID))

    saved_children = components.save_many.call_args[0][0]
    assert saved_children, "expected auto-detected field children to be persisted"
    for child in saved_children:
        assert child.role == "field"
        assert child.parent_component_id == _ENTITY_ID
        assert child.source_type == "region"
        assert child.extraction_status == "candidate"
        origin = (child.content_raw or {}).get("origin")
        assert origin == "auto_detected"


def test_autofill_fields_polygon_is_token_grounded_not_invented() -> None:
    # The child polygon must be the union of the selected tokens' bboxes — for
    # tokens at x∈[0.1,0.35], y∈[0.1,0.15] the bounds are well inside the entity.
    entity = _entity_component()
    page = _page_component(tokens=[_TOKEN_INSIDE, _TOKEN_INSIDE_2])
    segmenter = _FakeSegmenter([_proposal(token_indices=(0, 1))])
    use_case, components, _ = _build_use_case(
        entity=entity,
        page=page,
        entity_type=_entity_type(),
        segmenter=segmenter,
        autofiller=_FakeAutofiller(),
    )
    asyncio.run(use_case.execute(entity_component_id=_ENTITY_ID))

    child = components.save_many.call_args[0][0][0]
    polygon = child.location["polygon"]
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    # Union of [0.1,0.1,0.1,0.05] and [0.25,0.1,0.1,0.05] → x∈[0.1,0.35], y∈[0.1,0.15]
    assert min(xs) == pytest.approx(0.1)
    assert max(xs) == pytest.approx(0.35)
    assert min(ys) == pytest.approx(0.1)
    assert max(ys) == pytest.approx(0.15)


# ── D-19 exclusion (denied_field_polygons memo) ──────────────────────────────


def test_autofill_fields_excludes_proposal_overlapping_denied_polygon() -> None:
    # The entity remembers a denied polygon covering the tokens the segmenter
    # would propose; that proposal must be excluded (no field child created).
    denied = [[0.05, 0.05], [0.4, 0.05], [0.4, 0.2], [0.05, 0.2]]  # covers both inside tokens
    entity = _entity_component(content_raw={"denied_field_polygons": [denied]})
    page = _page_component(tokens=[_TOKEN_INSIDE, _TOKEN_INSIDE_2])
    segmenter = _FakeSegmenter([_proposal(token_indices=(0, 1))])
    use_case, components, extractions = _build_use_case(
        entity=entity,
        page=page,
        entity_type=_entity_type(),
        segmenter=segmenter,
        autofiller=_FakeAutofiller(),
    )

    results = asyncio.run(use_case.execute(entity_component_id=_ENTITY_ID))

    # The overlapping proposal is excluded — no auto-detected child, no autofill.
    assert results == []
    # save_many is either not called or called with an empty child list.
    if components.save_many.called:
        assert components.save_many.call_args[0][0] == []
    extractions.save.assert_not_called()


def test_autofill_fields_keeps_proposal_not_overlapping_denied_polygon() -> None:
    # A denied polygon far from the proposed tokens does NOT exclude the proposal.
    denied = [[0.8, 0.8], [0.9, 0.8], [0.9, 0.9], [0.8, 0.9]]
    entity = _entity_component(content_raw={"denied_field_polygons": [denied]})
    page = _page_component(tokens=[_TOKEN_INSIDE, _TOKEN_INSIDE_2])
    segmenter = _FakeSegmenter([_proposal(token_indices=(0, 1))])
    use_case, _components, extractions = _build_use_case(
        entity=entity,
        page=page,
        entity_type=_entity_type(),
        segmenter=segmenter,
        autofiller=_FakeAutofiller(),
    )

    results = asyncio.run(use_case.execute(entity_component_id=_ENTITY_ID))

    assert len(results) >= 1
    extractions.save.assert_called()


# ── Existing user-drawn field children are incorporated ──────────────────────


def test_autofill_fields_incorporates_existing_user_drawn_field_children() -> None:
    existing = Component(
        id="comp-0000-0000-0000-0000-0000000000f1",
        email_id=_EMAIL_ID,
        importer_id=_IMPORTER_ID,
        attachment_id=_ATTACHMENT_ID,
        parent_component_id=_ENTITY_ID,
        source_type="region",
        location={"page_index": 0, "polygon": [[0.1, 0.3], [0.3, 0.3], [0.3, 0.4], [0.1, 0.4]]},
        content_text="user box",
        content_markdown=None,
        content_raw={"lineage": {"origin": "human_add"}},
        embedding=None,
        sequence_index=0,
        extraction_status="candidate",
        role="field",
    )
    entity = _entity_component()
    page = _page_component(tokens=[_TOKEN_INSIDE])
    segmenter = _FakeSegmenter([])  # no auto-detection
    autofiller = _FakeAutofiller()
    use_case, _, extractions = _build_use_case(
        entity=entity,
        page=page,
        entity_type=_entity_type(),
        segmenter=segmenter,
        autofiller=autofiller,
        existing_children=[existing],
    )

    results = asyncio.run(use_case.execute(entity_component_id=_ENTITY_ID))

    # The existing user-drawn field child is autofilled as a candidate.
    field_ids = [r.field_component_id for r in results]
    assert existing.id in field_ids
    assert extractions.save.called


# ── HIGH-1: each child is autofilled EXACTLY once (reflecting mock) ──────────


def test_autofill_fields_autofills_each_child_exactly_once_when_repo_reflects_saved_rows() -> None:
    # HIGH-1 regression: a repository whose find_by_page_component_id REFLECTS the
    # rows just persisted by save_many must not cause a field box to be autofilled
    # twice. With the old code, freshly-persisted candidate (origin='auto_detected')
    # children were re-read by _existing_field_children (which excluded only
    # rejected/superseded) and processed a SECOND time — 2x LLM calls, duplicate
    # ExtractionRecord saves + update_field_relationship writes.
    entity = _entity_component()
    page = _page_component(tokens=[_TOKEN_INSIDE, _TOKEN_INSIDE_2])
    segmenter = _FakeSegmenter([_proposal(token_indices=(0, 1))])
    autofiller = _FakeAutofiller()

    components = AsyncMock()

    async def _find_by_id(component_id: str) -> Component | None:
        return entity if component_id == _ENTITY_ID else None

    components.find_by_id.side_effect = _find_by_id
    components.find_pages_by_attachment.return_value = [page]

    # The reflecting repo: save_many records the saved rows AND
    # find_by_page_component_id returns them (as a real Supabase impl would).
    saved_rows: list[Component] = []

    async def _save_many(rows: list[Component]) -> list[Component]:
        saved_rows.extend(rows)
        return list(rows)

    async def _find_by_page_component_id(_parent_id: str) -> list[Component]:
        return list(saved_rows)

    components.save_many.side_effect = _save_many
    components.find_by_page_component_id.side_effect = _find_by_page_component_id

    async def _update_field_relationship(cid: str, _parent: str | None, field: str | None) -> Component:
        base = _field_child_lookup(cid, saved_rows)
        return Component(**{**base.__dict__, "entity_type_field_id": field})

    components.update_field_relationship.side_effect = _update_field_relationship

    entity_types = AsyncMock()
    entity_types.find_by_id.return_value = _entity_type()
    extractions = AsyncMock()
    extractions.save.side_effect = lambda record: record

    use_case = AutofillFieldsUseCase(
        components=components,
        entity_types=entity_types,
        extractions=extractions,
        autofiller=autofiller,
        segmenter=segmenter,
    )

    results = asyncio.run(use_case.execute(entity_component_id=_ENTITY_ID))

    # Exactly one auto-detected child was created and autofilled once.
    assert len(saved_rows) == 1
    assert len(results) == 1
    # One LLM autofill call, one ExtractionRecord save, one relationship write —
    # never doubled by the reflected read.
    assert len(autofiller.calls) == 1
    assert extractions.save.call_count == 1
    assert components.update_field_relationship.call_count == 1
    # No duplicate field_component_id in the result view.
    ids = [r.field_component_id for r in results]
    assert len(ids) == len(set(ids))


def test_autofill_fields_dedupes_when_existing_read_includes_persisted_child() -> None:
    # Even if the reflected read also surfaces a user-drawn child plus the
    # just-persisted auto-detected one, each distinct id is autofilled once.
    user_child = Component(
        id="comp-0000-0000-0000-0000-0000000000f9",
        email_id=_EMAIL_ID,
        importer_id=_IMPORTER_ID,
        attachment_id=_ATTACHMENT_ID,
        parent_component_id=_ENTITY_ID,
        source_type="region",
        location={"page_index": 0, "polygon": [[0.1, 0.3], [0.3, 0.3], [0.3, 0.4], [0.1, 0.4]]},
        content_text="user box",
        content_markdown=None,
        content_raw={"lineage": {"origin": "human_add"}},
        embedding=None,
        sequence_index=0,
        extraction_status="candidate",
        role="field",
    )
    entity = _entity_component()
    page = _page_component(tokens=[_TOKEN_INSIDE, _TOKEN_INSIDE_2])
    segmenter = _FakeSegmenter([_proposal(token_indices=(0, 1))])
    autofiller = _FakeAutofiller()

    components = AsyncMock()

    async def _find_by_id(component_id: str) -> Component | None:
        return entity if component_id == _ENTITY_ID else None

    components.find_by_id.side_effect = _find_by_id
    components.find_pages_by_attachment.return_value = [page]

    saved_rows: list[Component] = []

    async def _save_many(rows: list[Component]) -> list[Component]:
        saved_rows.extend(rows)
        return list(rows)

    async def _find_by_page_component_id(_parent_id: str) -> list[Component]:
        # Reflects BOTH the user-drawn child and every just-saved auto-detected one.
        return [user_child, *saved_rows]

    components.save_many.side_effect = _save_many
    components.find_by_page_component_id.side_effect = _find_by_page_component_id

    async def _update_field_relationship(cid: str, _parent: str | None, field: str | None) -> Component:
        base = _field_child_lookup(cid, [user_child, *saved_rows])
        return Component(**{**base.__dict__, "entity_type_field_id": field})

    components.update_field_relationship.side_effect = _update_field_relationship

    entity_types = AsyncMock()
    entity_types.find_by_id.return_value = _entity_type()
    extractions = AsyncMock()
    extractions.save.side_effect = lambda record: record

    use_case = AutofillFieldsUseCase(
        components=components,
        entity_types=entity_types,
        extractions=extractions,
        autofiller=autofiller,
        segmenter=segmenter,
    )

    results = asyncio.run(use_case.execute(entity_component_id=_ENTITY_ID))

    # The auto-detected child + the user-drawn child, each exactly once.
    result_ids = [r.field_component_id for r in results]
    assert len(result_ids) == len(set(result_ids))
    assert user_child.id in result_ids
    assert len(saved_rows) == 1
    assert saved_rows[0].id in result_ids
    # 2 distinct children → exactly 2 autofills / saves / relationship writes.
    assert len(autofiller.calls) == 2
    assert extractions.save.call_count == 2
    assert components.update_field_relationship.call_count == 2


# ── LOW-5: float page_index coercion ─────────────────────────────────────────


def test_coerce_page_index_handles_float() -> None:
    from app.application.use_cases.autofill_fields import _coerce_page_index

    component = _entity_component()
    float_component = Component(**{**component.__dict__, "location": {"page_index": 2.0, "polygon": _ENTITY_POLYGON}})
    str_component = Component(**{**component.__dict__, "location": {"page_index": "3", "polygon": _ENTITY_POLYGON}})
    missing_component = Component(**{**component.__dict__, "location": {"polygon": _ENTITY_POLYGON}})

    assert _coerce_page_index(float_component) == 2  # was 0 before LOW-5
    assert _coerce_page_index(str_component) == 3
    assert _coerce_page_index(missing_component) == 0


# ── Tenant mismatch (D-18) ───────────────────────────────────────────────────


def test_autofill_fields_tenant_mismatch_raises() -> None:
    entity = _entity_component(importer_id=_IMPORTER_ID)
    page = _page_component(tokens=[_TOKEN_INSIDE])
    use_case, components, extractions = _build_use_case(
        entity=entity,
        page=page,
        entity_type=_entity_type(),
        segmenter=_FakeSegmenter([_proposal(token_indices=(0,))]),
        autofiller=_FakeAutofiller(),
    )
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(use_case.execute(entity_component_id=_ENTITY_ID, importer_id=_OTHER_IMPORTER_ID))
    components.save_many.assert_not_called()
    extractions.save.assert_not_called()


def test_autofill_fields_missing_entity_type_record_raises() -> None:
    entity = _entity_component()
    page = _page_component(tokens=[_TOKEN_INSIDE])
    use_case, _, _ = _build_use_case(
        entity=entity,
        page=page,
        entity_type=None,  # entity_types.find_by_id returns None
        segmenter=_FakeSegmenter([]),
        autofiller=_FakeAutofiller(),
    )
    with pytest.raises(ValueError, match="EntityType not found"):
        asyncio.run(use_case.execute(entity_component_id=_ENTITY_ID))
