"""Per-use-case unit tests for the relationship setters (D-10/D-11).

SetComponentRoleUseCase, SetComponentEntityTypeUseCase,
SetComponentFieldRelationshipUseCase.

Each setter: writes via its repo method, derives tenant from the component row
(D-18), 404s on missing component / tenant mismatch, and clears on None. All
tests use AsyncMock repositories — no infrastructure dependencies — and are
named per-use-case so a single regression is individually traceable via `-k`.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.set_component_relationship import (
    SetComponentEntityTypeUseCase,
    SetComponentFieldRelationshipUseCase,
    SetComponentRoleUseCase,
)
from app.domain.entities.component import Component

_COMP_ID = "comp-0000-0000-0000-0000-000000000001"
_PARENT_ID = "comp-0000-0000-0000-0000-000000000099"
_IMPORTER_ID = "imp-0000-0000-0000-0000-000000000001"
_OTHER_IMPORTER_ID = "imp-0000-0000-0000-0000-000000000002"
_ENTITY_TYPE_ID = "etype-0000-0000-0000-0000-000000000001"
_FIELD_ID = "efield-0000-0000-0000-0000-000000000001"


def _make_component(
    comp_id: str = _COMP_ID,
    *,
    role: str | None = None,
    entity_type_id: str | None = None,
    entity_type_field_id: str | None = None,
    parent_component_id: str | None = None,
    importer_id: str = _IMPORTER_ID,
) -> Component:
    return Component(
        id=comp_id,
        email_id="email-0001",
        importer_id=importer_id,
        attachment_id="attach-0001",
        parent_component_id=parent_component_id,
        source_type="region",
        location={"page_index": 0, "polygon": [[0, 0], [1, 0], [1, 1], [0, 1]]},
        content_text="region text",
        content_markdown=None,
        content_raw=None,
        embedding=None,
        sequence_index=0,
        extraction_status="candidate",
        role=role,
        entity_type_id=entity_type_id,
        entity_type_field_id=entity_type_field_id,
    )


# ── SetComponentRoleUseCase ──────────────────────────────────────────────────


def test_set_role_writes_via_update_role() -> None:
    component = _make_component()
    updated = _make_component(role="entity")
    components = AsyncMock()
    components.find_by_id.return_value = component
    components.update_role.return_value = updated

    use_case = SetComponentRoleUseCase(components=components)
    result = asyncio.run(use_case.execute(component_id=_COMP_ID, role="entity"))

    components.update_role.assert_called_once_with(_COMP_ID, "entity")
    assert result.role == "entity"


def test_set_role_none_clears_the_role() -> None:
    component = _make_component(role="entity")
    updated = _make_component(role=None)
    components = AsyncMock()
    components.find_by_id.return_value = component
    components.update_role.return_value = updated

    use_case = SetComponentRoleUseCase(components=components)
    result = asyncio.run(use_case.execute(component_id=_COMP_ID, role=None))

    components.update_role.assert_called_once_with(_COMP_ID, None)
    assert result.role is None


def test_set_role_missing_component_404s() -> None:
    components = AsyncMock()
    components.find_by_id.return_value = None

    use_case = SetComponentRoleUseCase(components=components)
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(use_case.execute(component_id="missing-id", role="entity"))

    components.update_role.assert_not_called()


def test_set_role_tenant_mismatch_404s() -> None:
    component = _make_component(importer_id=_IMPORTER_ID)
    components = AsyncMock()
    components.find_by_id.return_value = component

    use_case = SetComponentRoleUseCase(components=components)
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(use_case.execute(component_id=_COMP_ID, role="entity", importer_id=_OTHER_IMPORTER_ID))

    # D-18: no write when the caller's tenant does not match the component row.
    components.update_role.assert_not_called()


# ── SetComponentEntityTypeUseCase ────────────────────────────────────────────


def test_set_entity_type_writes_via_update_entity_type() -> None:
    component = _make_component(role="entity")
    updated = _make_component(role="entity", entity_type_id=_ENTITY_TYPE_ID)
    components = AsyncMock()
    components.find_by_id.return_value = component
    components.update_entity_type.return_value = updated

    use_case = SetComponentEntityTypeUseCase(components=components)
    result = asyncio.run(use_case.execute(component_id=_COMP_ID, entity_type_id=_ENTITY_TYPE_ID))

    components.update_entity_type.assert_called_once_with(_COMP_ID, _ENTITY_TYPE_ID)
    assert result.entity_type_id == _ENTITY_TYPE_ID


def test_set_entity_type_none_clears() -> None:
    component = _make_component(role="entity", entity_type_id=_ENTITY_TYPE_ID)
    updated = _make_component(role="entity", entity_type_id=None)
    components = AsyncMock()
    components.find_by_id.return_value = component
    components.update_entity_type.return_value = updated

    use_case = SetComponentEntityTypeUseCase(components=components)
    result = asyncio.run(use_case.execute(component_id=_COMP_ID, entity_type_id=None))

    components.update_entity_type.assert_called_once_with(_COMP_ID, None)
    assert result.entity_type_id is None


def test_set_entity_type_missing_component_404s() -> None:
    components = AsyncMock()
    components.find_by_id.return_value = None

    use_case = SetComponentEntityTypeUseCase(components=components)
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(use_case.execute(component_id="missing-id", entity_type_id=_ENTITY_TYPE_ID))

    components.update_entity_type.assert_not_called()


def test_set_entity_type_tenant_mismatch_404s() -> None:
    component = _make_component(importer_id=_IMPORTER_ID)
    components = AsyncMock()
    components.find_by_id.return_value = component

    use_case = SetComponentEntityTypeUseCase(components=components)
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(
            use_case.execute(
                component_id=_COMP_ID,
                entity_type_id=_ENTITY_TYPE_ID,
                importer_id=_OTHER_IMPORTER_ID,
            )
        )

    components.update_entity_type.assert_not_called()


# ── SetComponentFieldRelationshipUseCase ─────────────────────────────────────


def test_set_field_relationship_writes_parent_and_field_together() -> None:
    component = _make_component(role="field")
    updated = _make_component(
        role="field",
        parent_component_id=_PARENT_ID,
        entity_type_field_id=_FIELD_ID,
    )
    components = AsyncMock()
    components.find_by_id.return_value = component
    components.update_field_relationship.return_value = updated

    use_case = SetComponentFieldRelationshipUseCase(components=components)
    result = asyncio.run(
        use_case.execute(
            component_id=_COMP_ID,
            parent_component_id=_PARENT_ID,
            entity_type_field_id=_FIELD_ID,
        )
    )

    components.update_field_relationship.assert_called_once_with(_COMP_ID, _PARENT_ID, _FIELD_ID)
    assert result.parent_component_id == _PARENT_ID
    assert result.entity_type_field_id == _FIELD_ID


def test_set_field_relationship_both_none_clears() -> None:
    component = _make_component(
        role="field",
        parent_component_id=_PARENT_ID,
        entity_type_field_id=_FIELD_ID,
    )
    updated = _make_component(role="field", parent_component_id=None, entity_type_field_id=None)
    components = AsyncMock()
    components.find_by_id.return_value = component
    components.update_field_relationship.return_value = updated

    use_case = SetComponentFieldRelationshipUseCase(components=components)
    result = asyncio.run(
        use_case.execute(
            component_id=_COMP_ID,
            parent_component_id=None,
            entity_type_field_id=None,
        )
    )

    components.update_field_relationship.assert_called_once_with(_COMP_ID, None, None)
    assert result.parent_component_id is None
    assert result.entity_type_field_id is None


def test_set_field_relationship_missing_component_404s() -> None:
    components = AsyncMock()
    components.find_by_id.return_value = None

    use_case = SetComponentFieldRelationshipUseCase(components=components)
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(
            use_case.execute(
                component_id="missing-id",
                parent_component_id=_PARENT_ID,
                entity_type_field_id=_FIELD_ID,
            )
        )

    components.update_field_relationship.assert_not_called()


def test_set_field_relationship_tenant_mismatch_404s() -> None:
    component = _make_component(importer_id=_IMPORTER_ID)
    components = AsyncMock()
    components.find_by_id.return_value = component

    use_case = SetComponentFieldRelationshipUseCase(components=components)
    with pytest.raises(ValueError, match="Component not found"):
        asyncio.run(
            use_case.execute(
                component_id=_COMP_ID,
                parent_component_id=_PARENT_ID,
                entity_type_field_id=_FIELD_ID,
                importer_id=_OTHER_IMPORTER_ID,
            )
        )

    components.update_field_relationship.assert_not_called()
