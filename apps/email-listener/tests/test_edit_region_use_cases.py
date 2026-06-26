"""Unit tests for edit_region use cases.

Tests cover all seven region-edit operations:
  AcceptRegionUseCase, RejectRegionUseCase, RedrawRegionUseCase,
  SplitRegionUseCase, MergeRegionsUseCase, NestRegionUseCase, CreateRegionUseCase

All tests use AsyncMock repository — no infrastructure dependencies.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.edit_region import (
    AcceptRegionUseCase,
    CreateRegionUseCase,
    MergeRegionsUseCase,
    NestRegionUseCase,
    RedrawRegionUseCase,
    RejectRegionUseCase,
    SplitRegionUseCase,
)
from app.domain.entities.component import Component

_COMP_ID = "comp-0000-0000-0000-0000-000000000001"
_COMP_ID_2 = "comp-0000-0000-0000-0000-000000000002"
_PAGE_ID = "page-0000-0000-0000-0000-000000000001"
_IMPORTER_ID = "imp-0000-0000-0000-0000-000000000001"
_EMAIL_ID = "email-0001"
_ATTACHMENT_ID = "attach-0001"

_VALID_POLYGON = [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]]


def _make_component(
    comp_id: str = _COMP_ID,
    extraction_status: str = "pending",
    parent_component_id: str | None = None,
    email_id: str = _EMAIL_ID,
    attachment_id: str | None = _ATTACHMENT_ID,
    content_raw: dict[str, object] | None = None,
) -> Component:
    return Component(
        id=comp_id,
        email_id=email_id,
        importer_id=_IMPORTER_ID,
        attachment_id=attachment_id,
        parent_component_id=parent_component_id,
        source_type="region",
        location={"page_index": 0, "polygon": [[0, 0], [1, 0], [1, 1], [0, 1]]},
        content_text="region text",
        content_markdown=None,
        content_raw=content_raw,
        embedding=None,
        sequence_index=0,
        extraction_status=extraction_status,
    )


def _make_page_component(page_id: str = _PAGE_ID) -> Component:
    return Component(
        id=page_id,
        email_id=_EMAIL_ID,
        importer_id=_IMPORTER_ID,
        attachment_id=_ATTACHMENT_ID,
        parent_component_id=None,
        source_type="attachment_page",
        location={"page_index": 0, "polygon": [[0, 0], [1, 0], [1, 1], [0, 1]]},
        content_text="page text with tokens",
        content_markdown=None,
        content_raw=None,
        embedding=None,
        sequence_index=0,
        extraction_status="pending",
    )


# ── AcceptRegionUseCase ────────────────────────────────────────────────────────


def test_accept_region_status_becomes_candidate() -> None:
    component = _make_component(extraction_status="pending")
    components = AsyncMock()
    components.find_by_id.return_value = component
    updated = Component(**{**component.__dict__, "extraction_status": "candidate"})
    components.update_status.return_value = updated

    use_case = AcceptRegionUseCase(components=components)
    result = asyncio.run(use_case.execute(component_id=_COMP_ID))

    components.update_status.assert_called_once_with(_COMP_ID, "candidate")
    assert result.extraction_status == "candidate"


def test_accept_region_not_found_raises_value_error() -> None:
    components = AsyncMock()
    components.find_by_id.return_value = None

    use_case = AcceptRegionUseCase(components=components)
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(use_case.execute(component_id="missing-id"))


# ── RejectRegionUseCase ────────────────────────────────────────────────────────


def test_reject_region_status_becomes_rejected() -> None:
    component = _make_component(extraction_status="pending")
    components = AsyncMock()
    components.find_by_id.return_value = component
    updated = Component(**{**component.__dict__, "extraction_status": "rejected"})
    components.update_status.return_value = updated

    use_case = RejectRegionUseCase(components=components)
    result = asyncio.run(use_case.execute(component_id=_COMP_ID))

    components.update_status.assert_called_once_with(_COMP_ID, "rejected")
    assert result.extraction_status == "rejected"


def test_reject_region_not_found_raises_value_error() -> None:
    components = AsyncMock()
    components.find_by_id.return_value = None

    use_case = RejectRegionUseCase(components=components)
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(use_case.execute(component_id="missing-id"))


# ── RedrawRegionUseCase ────────────────────────────────────────────────────────


def test_redraw_creates_new_candidate_and_supersedes_original() -> None:
    original = _make_component(
        extraction_status="pending",
        parent_component_id=_PAGE_ID,
    )
    page = _make_page_component()

    # CR-02 safe ordering: save_many is called TWICE — first with the new
    # candidate (must return non-empty), then with the superseded original.
    new_candidate_placeholder = _make_component(comp_id="new-id", extraction_status="candidate")
    superseded_placeholder = _make_component(extraction_status="superseded")

    components = AsyncMock()
    components.find_by_id.side_effect = [original, page]
    components.save_many.side_effect = [
        [new_candidate_placeholder],  # first call: persist new child
        [superseded_placeholder],  # second call: persist superseded original
    ]

    use_case = RedrawRegionUseCase(components=components)
    asyncio.run(
        use_case.execute(
            component_id=_COMP_ID,
            polygon=_VALID_POLYGON,
            page_index=0,
        )
    )

    # CR-02: first save_many call must be the NEW candidate (not the superseded original)
    assert components.save_many.call_count == 2
    first_call_saved = components.save_many.call_args_list[0][0][0]
    second_call_saved = components.save_many.call_args_list[1][0][0]

    assert len(first_call_saved) == 1
    assert first_call_saved[0].extraction_status == "candidate"
    assert first_call_saved[0].id != _COMP_ID  # new component, not the original

    assert len(second_call_saved) == 1
    assert second_call_saved[0].id == _COMP_ID
    assert second_call_saved[0].extraction_status == "superseded"


def test_redraw_new_component_lineage_origin() -> None:
    original = _make_component(
        extraction_status="pending",
        parent_component_id=_PAGE_ID,
    )
    page = _make_page_component()

    new_candidate_placeholder = _make_component(comp_id="new-id", extraction_status="candidate")
    superseded_placeholder = _make_component(extraction_status="superseded")

    components = AsyncMock()
    components.find_by_id.side_effect = [original, page]
    components.save_many.side_effect = [
        [new_candidate_placeholder],
        [superseded_placeholder],
    ]

    use_case = RedrawRegionUseCase(components=components)
    asyncio.run(
        use_case.execute(
            component_id=_COMP_ID,
            polygon=_VALID_POLYGON,
            page_index=0,
        )
    )

    # Lineage is on the new candidate (first save_many call)
    first_call_saved = components.save_many.call_args_list[0][0][0]
    new_child = first_call_saved[0]
    lineage = (new_child.content_raw or {}).get("lineage", {})
    assert lineage.get("origin") == "human_redraw"
    assert lineage.get("supersedes") == _COMP_ID


def test_redraw_original_records_superseded_by() -> None:
    original = _make_component(
        extraction_status="pending",
        parent_component_id=_PAGE_ID,
    )
    page = _make_page_component()

    new_candidate_placeholder = _make_component(comp_id="new-id", extraction_status="candidate")
    superseded_placeholder = _make_component(extraction_status="superseded")

    components = AsyncMock()
    components.find_by_id.side_effect = [original, page]
    components.save_many.side_effect = [
        [new_candidate_placeholder],
        [superseded_placeholder],
    ]

    use_case = RedrawRegionUseCase(components=components)
    asyncio.run(
        use_case.execute(
            component_id=_COMP_ID,
            polygon=_VALID_POLYGON,
            page_index=0,
        )
    )

    # Superseded lineage is on the second save_many call
    second_call_saved = components.save_many.call_args_list[1][0][0]
    superseded = second_call_saved[0]
    lineage = (superseded.content_raw or {}).get("lineage", {})
    assert "superseded_by" in lineage


def test_redraw_not_found_raises_value_error() -> None:
    components = AsyncMock()
    components.find_by_id.return_value = None

    use_case = RedrawRegionUseCase(components=components)
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(
            use_case.execute(
                component_id="missing-id",
                polygon=_VALID_POLYGON,
                page_index=0,
            )
        )


# ── SplitRegionUseCase ─────────────────────────────────────────────────────────


def test_split_creates_n_new_candidates_and_supersedes_original() -> None:
    original = _make_component(
        extraction_status="pending",
        parent_component_id=_PAGE_ID,
    )
    page = _make_page_component()

    regions = [
        {"polygon": _VALID_POLYGON, "page_index": 0},
        {"polygon": [[0.5, 0.5], [0.9, 0.5], [0.9, 0.9], [0.5, 0.9]], "page_index": 0},
    ]

    # SplitRegionUseCase also uses safe ordering: new children first, then superseded original.
    # Both save_many calls must return non-empty to avoid RuntimeError.
    new_child_1 = _make_component(comp_id="split-child-1", extraction_status="candidate")
    new_child_2 = _make_component(comp_id="split-child-2", extraction_status="candidate")
    superseded_placeholder = _make_component(extraction_status="superseded")

    components = AsyncMock()
    components.find_by_id.side_effect = [original, page]
    components.save_many.side_effect = [
        [new_child_1, new_child_2],  # first call: persist new children
        [superseded_placeholder],  # second call: persist superseded original
    ]

    use_case = SplitRegionUseCase(components=components)
    asyncio.run(
        use_case.execute(
            component_id=_COMP_ID,
            regions=regions,
        )
    )

    assert components.save_many.call_count == 2
    first_call_saved = components.save_many.call_args_list[0][0][0]
    second_call_saved = components.save_many.call_args_list[1][0][0]

    # First call: the new child candidates (not the original)
    new_candidates = [c for c in first_call_saved if c.extraction_status == "candidate"]
    assert len(new_candidates) == 2
    for c in new_candidates:
        assert c.id != _COMP_ID
        lineage = (c.content_raw or {}).get("lineage", {})
        assert lineage.get("origin") == "human_split"

    # Second call: the superseded original
    assert len(second_call_saved) == 1
    assert second_call_saved[0].id == _COMP_ID
    assert second_call_saved[0].extraction_status == "superseded"


def test_split_not_found_raises_value_error() -> None:
    components = AsyncMock()
    components.find_by_id.return_value = None

    use_case = SplitRegionUseCase(components=components)
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(
            use_case.execute(
                component_id="missing-id",
                regions=[
                    {"polygon": _VALID_POLYGON, "page_index": 0},
                    {"polygon": _VALID_POLYGON, "page_index": 0},
                ],
            )
        )


# WR-04: Split minimum region count


def test_split_requires_at_least_2_regions() -> None:
    """WR-04: split with fewer than 2 regions raises ValueError before any DB call."""
    components = AsyncMock()
    use_case = SplitRegionUseCase(components=components)
    with pytest.raises(ValueError, match="at least 2"):
        asyncio.run(
            use_case.execute(
                component_id=_COMP_ID,
                regions=[{"polygon": _VALID_POLYGON, "page_index": 0}],
            )
        )

    # Validation is pre-DB — no I/O should have occurred
    components.find_by_id.assert_not_called()


def test_split_requires_at_least_2_regions_on_empty_list() -> None:
    """WR-04: split with empty regions list also raises ValueError."""
    components = AsyncMock()
    use_case = SplitRegionUseCase(components=components)
    with pytest.raises(ValueError, match="at least 2"):
        asyncio.run(
            use_case.execute(
                component_id=_COMP_ID,
                regions=[],
            )
        )

    components.find_by_id.assert_not_called()


# ── MergeRegionsUseCase ────────────────────────────────────────────────────────


def test_merge_creates_one_new_candidate_and_supersedes_all_originals() -> None:
    comp1 = _make_component(comp_id=_COMP_ID, extraction_status="pending")
    comp2 = _make_component(comp_id=_COMP_ID_2, extraction_status="pending")
    page = _make_page_component()

    # MergeRegionsUseCase also uses safe ordering: new merged component first,
    # then superseded originals. First save_many must return non-empty.
    merged_comp = _make_component(comp_id="merged-comp", extraction_status="candidate")
    superseded_1 = _make_component(comp_id=_COMP_ID, extraction_status="superseded")
    superseded_2 = _make_component(comp_id=_COMP_ID_2, extraction_status="superseded")

    components = AsyncMock()
    components.find_by_id.side_effect = [comp1, comp2, page]
    components.save_many.side_effect = [
        [merged_comp],  # first call: persist new merged component
        [superseded_1, superseded_2],  # second call: persist superseded originals
    ]

    use_case = MergeRegionsUseCase(components=components)
    asyncio.run(
        use_case.execute(
            component_ids=[_COMP_ID, _COMP_ID_2],
        )
    )

    assert components.save_many.call_count == 2
    first_call_saved = components.save_many.call_args_list[0][0][0]
    second_call_saved = components.save_many.call_args_list[1][0][0]

    # First call: the new merged candidate
    new_candidates = [c for c in first_call_saved if c.extraction_status == "candidate"]
    assert len(new_candidates) == 1
    lineage = (new_candidates[0].content_raw or {}).get("lineage", {})
    assert lineage.get("origin") == "human_merge"

    # Second call: both originals superseded
    superseded_ids = {c.id for c in second_call_saved if c.extraction_status == "superseded"}
    assert _COMP_ID in superseded_ids
    assert _COMP_ID_2 in superseded_ids


def test_merge_raises_value_error_when_different_email_ids() -> None:
    comp1 = _make_component(comp_id=_COMP_ID, email_id="email-A")
    comp2 = _make_component(comp_id=_COMP_ID_2, email_id="email-B")

    components = AsyncMock()
    components.find_by_id.side_effect = [comp1, comp2]

    use_case = MergeRegionsUseCase(components=components)
    with pytest.raises(ValueError, match="same email"):
        asyncio.run(
            use_case.execute(
                component_ids=[_COMP_ID, _COMP_ID_2],
            )
        )


def test_merge_raises_value_error_when_different_attachment_ids() -> None:
    comp1 = _make_component(comp_id=_COMP_ID, attachment_id="attach-A")
    comp2 = _make_component(comp_id=_COMP_ID_2, attachment_id="attach-B")

    components = AsyncMock()
    components.find_by_id.side_effect = [comp1, comp2]

    use_case = MergeRegionsUseCase(components=components)
    with pytest.raises(ValueError, match="same email"):
        asyncio.run(
            use_case.execute(
                component_ids=[_COMP_ID, _COMP_ID_2],
            )
        )


def test_merge_not_found_raises_value_error() -> None:
    components = AsyncMock()
    components.find_by_id.return_value = None

    use_case = MergeRegionsUseCase(components=components)
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(
            use_case.execute(
                component_ids=[_COMP_ID, _COMP_ID_2],
            )
        )


# ── NestRegionUseCase ──────────────────────────────────────────────────────────


def test_nest_region_updates_parent_no_supersede() -> None:
    component = _make_component(extraction_status="candidate")
    parent_id = "parent-comp-id"
    updated = Component(**{**component.__dict__, "parent_component_id": parent_id})

    components = AsyncMock()
    components.find_by_id.return_value = component
    components.update_parent.return_value = updated

    use_case = NestRegionUseCase(components=components)
    result = asyncio.run(use_case.execute(component_id=_COMP_ID, parent_component_id=parent_id))

    components.update_parent.assert_called_once_with(_COMP_ID, parent_id)
    components.save_many.assert_not_called()
    assert result.parent_component_id == parent_id


def test_nest_region_can_set_parent_to_none() -> None:
    component = _make_component(extraction_status="candidate", parent_component_id="some-parent")
    updated = Component(**{**component.__dict__, "parent_component_id": None})

    components = AsyncMock()
    components.find_by_id.return_value = component
    components.update_parent.return_value = updated

    use_case = NestRegionUseCase(components=components)
    result = asyncio.run(use_case.execute(component_id=_COMP_ID, parent_component_id=None))

    components.update_parent.assert_called_once_with(_COMP_ID, None)
    assert result.parent_component_id is None


def test_nest_region_not_found_raises_value_error() -> None:
    components = AsyncMock()
    components.find_by_id.return_value = None

    use_case = NestRegionUseCase(components=components)
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(use_case.execute(component_id="missing-id", parent_component_id="parent-id"))


# CR-01: Cycle detection tests


def test_nest_self_raises_value_error() -> None:
    """CR-01: a component cannot be nested inside itself."""
    components = AsyncMock()
    use_case = NestRegionUseCase(components=components)
    with pytest.raises(ValueError, match="cannot be nested inside itself"):
        asyncio.run(use_case.execute(component_id=_COMP_ID, parent_component_id=_COMP_ID))

    # No DB call needed — self-nesting is caught before any I/O
    components.find_by_id.assert_not_called()


def test_nest_direct_cycle_raises_value_error() -> None:
    """CR-01: nesting A under B when B is already under A creates a direct cycle."""
    # B has A as its parent — so making A a child of B creates a cycle
    parent_b = _make_component(comp_id=_COMP_ID_2, parent_component_id=_COMP_ID)

    components = AsyncMock()
    # Cycle check walks _COMP_ID_2's ancestry: find_by_id(_COMP_ID_2) returns B
    # (parent=_COMP_ID = A), then discovers _COMP_ID already in visited → cycle
    components.find_by_id.return_value = parent_b

    use_case = NestRegionUseCase(components=components)
    with pytest.raises(ValueError, match="cycle"):
        asyncio.run(use_case.execute(component_id=_COMP_ID, parent_component_id=_COMP_ID_2))


def test_nest_deep_cycle_raises_value_error() -> None:
    """CR-01: nesting creates a cycle deeper in the ancestry chain (A→B→C→A)."""
    comp_c_id = "comp-0000-0000-0000-0000-000000000003"
    # Chain: we want C (comp_c_id) to have B (_COMP_ID_2) as parent,
    # B has A (_COMP_ID) as parent, and we try to nest A under C → cycle.
    comp_c = _make_component(comp_id=comp_c_id, parent_component_id=_COMP_ID_2)
    comp_b = _make_component(comp_id=_COMP_ID_2, parent_component_id=_COMP_ID)

    # find_by_id will be called with C first, then B; B's parent is A (_COMP_ID)
    # which is in visited → raises ValueError
    components = AsyncMock()
    components.find_by_id.side_effect = [comp_c, comp_b]

    use_case = NestRegionUseCase(components=components)
    with pytest.raises(ValueError, match="cycle"):
        asyncio.run(use_case.execute(component_id=_COMP_ID, parent_component_id=comp_c_id))


# ── CreateRegionUseCase ────────────────────────────────────────────────────────


def test_create_region_works_with_zero_existing_children() -> None:
    page = _make_page_component()

    components = AsyncMock()
    components.find_by_id.return_value = page
    components.find_by_page_component_id.return_value = []  # zero proposals
    new_comp = _make_component(extraction_status="candidate", parent_component_id=_PAGE_ID)
    components.save_many.return_value = [new_comp]

    use_case = CreateRegionUseCase(components=components)
    asyncio.run(
        use_case.execute(
            page_component_id=_PAGE_ID,
            polygon=_VALID_POLYGON,
            page_index=0,
        )
    )

    assert components.save_many.called
    saved = components.save_many.call_args[0][0]
    assert len(saved) == 1
    created = saved[0]
    assert created.extraction_status == "candidate"
    assert created.source_type == "region"
    assert created.parent_component_id == _PAGE_ID
    lineage = (created.content_raw or {}).get("lineage", {})
    assert lineage.get("origin") == "human_add"


def test_create_region_derives_importer_from_page() -> None:
    page = _make_page_component()

    components = AsyncMock()
    components.find_by_id.return_value = page
    components.find_by_page_component_id.return_value = []
    new_comp = _make_component(extraction_status="candidate", parent_component_id=_PAGE_ID)
    components.save_many.return_value = [new_comp]

    use_case = CreateRegionUseCase(components=components)
    asyncio.run(
        use_case.execute(
            page_component_id=_PAGE_ID,
            polygon=_VALID_POLYGON,
            page_index=0,
        )
    )

    saved = components.save_many.call_args[0][0]
    assert saved[0].importer_id == _IMPORTER_ID  # derived from page row (D-18)


def test_create_region_not_found_raises_value_error() -> None:
    components = AsyncMock()
    components.find_by_id.return_value = None

    use_case = CreateRegionUseCase(components=components)
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(
            use_case.execute(
                page_component_id="missing-page-id",
                polygon=_VALID_POLYGON,
                page_index=0,
            )
        )


# CR-05: RuntimeError on empty save_many


def test_create_region_raises_runtime_error_when_save_many_empty() -> None:
    """CR-05: CreateRegionUseCase raises RuntimeError when save_many returns []."""
    page = _make_page_component()

    components = AsyncMock()
    components.find_by_id.return_value = page
    components.find_by_page_component_id.return_value = []
    components.save_many.return_value = []  # simulate infrastructure failure

    use_case = CreateRegionUseCase(components=components)
    with pytest.raises(RuntimeError, match="save_many returned empty"):
        asyncio.run(
            use_case.execute(
                page_component_id=_PAGE_ID,
                polygon=_VALID_POLYGON,
                page_index=0,
            )
        )
