"""Per-use-case unit tests for DenyFieldUseCase — origin-aware deny (D-18/D-19).

Two branches, each individually traceable via `-k`:
  - auto-detected box  -> update_status("rejected") + the denied polygon ATOMICALLY
    appended to the PARENT entity component via append_denied_polygon (MEDIUM-4 —
    no full-row read-modify-write); D-18 soft-reject + D-19 remember.
  - user-drawn box     -> clear_candidate_fields + candidate ExtractionRecord
    superseded; geometry untouched, NOT rejected ("your boxes never disappear").

All tests use AsyncMock repositories — no infrastructure dependencies.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.deny_field import DenyFieldUseCase
from app.domain.entities.component import Component

_FIELD_ID = "comp-0000-0000-0000-0000-000000000001"
_PARENT_ID = "comp-0000-0000-0000-0000-000000000099"
_IMPORTER_ID = "imp-0000-0000-0000-0000-000000000001"
_OTHER_IMPORTER_ID = "imp-0000-0000-0000-0000-000000000002"

_FIELD_POLYGON = [[0.2, 0.2], [0.4, 0.2], [0.4, 0.3], [0.2, 0.3]]


def _make_field(
    *,
    content_raw: dict[str, object] | None,
    parent_component_id: str | None = _PARENT_ID,
    importer_id: str = _IMPORTER_ID,
    polygon: list[list[float]] | None = None,
) -> Component:
    return Component(
        id=_FIELD_ID,
        email_id="email-0001",
        importer_id=importer_id,
        attachment_id="attach-0001",
        parent_component_id=parent_component_id,
        source_type="region",
        location={"page_index": 0, "polygon": polygon if polygon is not None else _FIELD_POLYGON},
        content_text="field text",
        content_markdown=None,
        content_raw=content_raw,
        embedding=None,
        sequence_index=0,
        extraction_status="candidate",
        role="field",
        entity_type_field_id="efield-0000-0000-0000-0000-000000000001",
    )


# ── Auto-detected deny branch (D-18 soft-reject + D-19 memo) ─────────────────


def test_deny_field_auto_detected_soft_rejects_and_memos_parent() -> None:
    field = _make_field(content_raw={"lineage": {"origin": "auto_detected"}})
    rejected = Component(**{**field.__dict__, "extraction_status": "rejected"})

    components = AsyncMock()
    components.find_by_id.return_value = field
    components.update_status.return_value = rejected
    extractions = AsyncMock()

    use_case = DenyFieldUseCase(components=components, extractions=extractions)
    result = asyncio.run(use_case.execute(component_id=_FIELD_ID))

    # D-18: the machine guess is soft-rejected.
    components.update_status.assert_called_once_with(_FIELD_ID, "rejected")
    assert result.extraction_status == "rejected"

    # D-19 / MEDIUM-4: the denied polygon is appended to the PARENT atomically via
    # append_denied_polygon (the parent id + the field's polygon) — never a
    # full-row read-modify-write (save_many).
    components.append_denied_polygon.assert_called_once_with(_PARENT_ID, _FIELD_POLYGON)
    components.save_many.assert_not_called()

    # Auto-detected path never supersedes an ExtractionRecord.
    extractions.supersede_active.assert_not_called()
    # The field box geometry is never cleared on the auto-detected path.
    components.clear_candidate_fields.assert_not_called()


def test_deny_field_auto_detected_atomic_append_does_not_reread_parent() -> None:
    # MEDIUM-4: accumulation onto any pre-existing memo is the DB function's job
    # (atomic jsonb `||`), so the use case appends exactly the new polygon and does
    # NOT read-modify-write the parent — find_by_id is called only for the field.
    field = _make_field(content_raw={"lineage": {"origin": "auto_detected"}})
    rejected = Component(**{**field.__dict__, "extraction_status": "rejected"})

    components = AsyncMock()
    components.find_by_id.return_value = field
    components.update_status.return_value = rejected
    extractions = AsyncMock()

    use_case = DenyFieldUseCase(components=components, extractions=extractions)
    asyncio.run(use_case.execute(component_id=_FIELD_ID))

    # Only the field is loaded — the parent is never re-read (no lost-update window).
    components.find_by_id.assert_called_once_with(_FIELD_ID)
    components.append_denied_polygon.assert_called_once_with(_PARENT_ID, _FIELD_POLYGON)
    components.save_many.assert_not_called()


def test_deny_field_auto_detected_top_level_origin_marker() -> None:
    # The origin marker is detected whether nested under lineage or flat.
    field = _make_field(content_raw={"origin": "auto_detected"})
    rejected = Component(**{**field.__dict__, "extraction_status": "rejected"})

    components = AsyncMock()
    components.find_by_id.return_value = field
    components.update_status.return_value = rejected
    extractions = AsyncMock()

    use_case = DenyFieldUseCase(components=components, extractions=extractions)
    asyncio.run(use_case.execute(component_id=_FIELD_ID))

    components.update_status.assert_called_once_with(_FIELD_ID, "rejected")
    components.append_denied_polygon.assert_called_once_with(_PARENT_ID, _FIELD_POLYGON)


# ── User-drawn deny branch (D-18 keep geometry, clear value) ─────────────────


def test_deny_field_user_drawn_clears_candidate_and_supersedes_record() -> None:
    field = _make_field(content_raw={"lineage": {"origin": "human_add"}})
    cleared = Component(**{**field.__dict__, "entity_type_field_id": None})

    components = AsyncMock()
    components.find_by_id.return_value = field
    components.clear_candidate_fields.return_value = cleared
    extractions = AsyncMock()

    use_case = DenyFieldUseCase(components=components, extractions=extractions)
    result = asyncio.run(use_case.execute(component_id=_FIELD_ID))

    # D-18: keep geometry, clear the wrong field mapping.
    components.clear_candidate_fields.assert_called_once_with(_FIELD_ID)
    assert result.entity_type_field_id is None
    # D-16: the candidate ExtractionRecord is superseded (value/property cleared).
    extractions.supersede_active.assert_called_once_with(_FIELD_ID)

    # "Your boxes never disappear" — user-drawn box is NOT soft-rejected.
    components.update_status.assert_not_called()
    # No parent memo on the user-drawn path.
    components.save_many.assert_not_called()


def test_deny_field_user_drawn_with_no_content_raw_is_user_drawn() -> None:
    # Absent lineage => treated as user-drawn (the safe default: keep the box).
    field = _make_field(content_raw=None)
    cleared = Component(**{**field.__dict__, "entity_type_field_id": None})

    components = AsyncMock()
    components.find_by_id.return_value = field
    components.clear_candidate_fields.return_value = cleared
    extractions = AsyncMock()

    use_case = DenyFieldUseCase(components=components, extractions=extractions)
    asyncio.run(use_case.execute(component_id=_FIELD_ID))

    components.clear_candidate_fields.assert_called_once_with(_FIELD_ID)
    extractions.supersede_active.assert_called_once_with(_FIELD_ID)
    components.update_status.assert_not_called()


# ── Guards (missing component, tenant mismatch) ──────────────────────────────


def test_deny_field_missing_component_404s() -> None:
    components = AsyncMock()
    components.find_by_id.return_value = None
    extractions = AsyncMock()

    use_case = DenyFieldUseCase(components=components, extractions=extractions)
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(use_case.execute(component_id="missing-id"))

    components.update_status.assert_not_called()
    components.clear_candidate_fields.assert_not_called()
    extractions.supersede_active.assert_not_called()


def test_deny_field_tenant_mismatch_404s() -> None:
    field = _make_field(
        content_raw={"lineage": {"origin": "auto_detected"}},
        importer_id=_IMPORTER_ID,
    )
    components = AsyncMock()
    components.find_by_id.return_value = field
    extractions = AsyncMock()

    use_case = DenyFieldUseCase(components=components, extractions=extractions)
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(use_case.execute(component_id=_FIELD_ID, importer_id=_OTHER_IMPORTER_ID))

    # D-18: nothing is written on a tenant mismatch.
    components.update_status.assert_not_called()
    components.clear_candidate_fields.assert_not_called()
    components.save_many.assert_not_called()
    extractions.supersede_active.assert_not_called()
