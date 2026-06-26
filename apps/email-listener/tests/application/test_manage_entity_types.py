"""Per-behavior unit tests for the manage_entity_types use cases (D-26/D-27).

Covers the six behaviors from 09-03 Task 2, each individually traceable via `-k`:
  - CreateEntityType with a duplicate (system) slug -> ValueError (repo marker,
    mapped to 409 by the endpoint).
  - CreateField / UpdateField with field_type not in ALLOWED_FIELD_TYPES -> ValueError.
  - CreateField with a slug already present on the entity type -> ValueError
    (D-27 per-type slug uniqueness, checked before the insert).
  - DeleteField where count_confirmed_references > 0 -> SOFT-DEACTIVATE (never a
    hard delete; the D-04 FK is preserved, D-27). Zero references -> hard delete.
  - ReorderFields assigns sort_order in the given id order.
  - All writes operate on the system-default scope (importer_id NULL).

All tests use AsyncMock repositories (the project convention) — no infrastructure.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.manage_entity_types import (
    ALLOWED_FIELD_TYPES,
    CreateEntityTypeUseCase,
    CreateFieldUseCase,
    DeleteFieldResult,
    DeleteFieldUseCase,
    ReorderFieldsUseCase,
    UpdateEntityTypeUseCase,
    UpdateFieldUseCase,
)
from app.domain.entities.entity_type import EntityType, EntityTypeField

_ENTITY_TYPE_ID = "etype-0000-0000-0000-0000-000000000001"
_FIELD_ID = "efield-0000-0000-0000-0000-000000000001"
_SIBLING_FIELD_ID = "efield-0000-0000-0000-0000-000000000002"


def _field(
    slug: str = "name",
    *,
    field_id: str = _FIELD_ID,
    data_type: str = "string",
) -> EntityTypeField:
    return EntityTypeField(
        id=field_id,
        slug=slug,
        label=slug.title(),
        data_type=data_type,
        is_identifier=False,
        is_required=False,
        description=None,
        sort_order=0,
    )


def _entity_type(*, fields: tuple[EntityTypeField, ...] = ()) -> EntityType:
    return EntityType(
        id=_ENTITY_TYPE_ID,
        importer_id=None,
        slug="company",
        label="Company",
        description="A company entity",
        is_active=True,
        embedding=None,
        fields=fields,
    )


# ── CreateEntityTypeUseCase ──────────────────────────────────────────────────


def test_create_entity_type_writes_via_repo() -> None:
    created = _entity_type()
    repo = AsyncMock()
    repo.find_by_slug.return_value = None  # no existing system type with this slug
    repo.create_entity_type.return_value = created

    use_case = CreateEntityTypeUseCase(entity_types=repo)
    result = asyncio.run(use_case.execute(slug="company", label="Company", description="A company entity"))

    # HIGH-2: the system-slug pre-check runs against importer_id=None before insert.
    repo.find_by_slug.assert_awaited_once_with(None, "company")
    repo.create_entity_type.assert_awaited_once_with(slug="company", label="Company", description="A company entity")
    assert result.slug == "company"


def test_create_entity_type_duplicate_system_slug_precheck_raises() -> None:
    # HIGH-2: a duplicate SYSTEM slug is caught by the app-level pre-check (the DB
    # UNIQUE(importer_id, slug) never fires for NULL importer_id), so create_entity_type
    # is never reached and a 'slug exists' marker → 409 is raised.
    repo = AsyncMock()
    repo.find_by_slug.return_value = _entity_type()  # an existing system type

    use_case = CreateEntityTypeUseCase(entity_types=repo)
    with pytest.raises(ValueError, match="slug exists"):
        asyncio.run(use_case.execute(slug="company", label="Company"))

    repo.find_by_slug.assert_awaited_once_with(None, "company")
    repo.create_entity_type.assert_not_awaited()


def test_create_entity_type_duplicate_slug_db_backstop_raises() -> None:
    # Defense in depth: even if the pre-check passes (TOCTOU), the repo's
    # 23505 → 'slug exists' ValueError (now backed by the 0014 partial unique
    # index) still surfaces as a 409.
    repo = AsyncMock()
    repo.find_by_slug.return_value = None
    repo.create_entity_type.side_effect = ValueError("entity type slug exists: company")

    use_case = CreateEntityTypeUseCase(entity_types=repo)
    with pytest.raises(ValueError, match="slug exists"):
        asyncio.run(use_case.execute(slug="company", label="Company"))


# ── UpdateEntityTypeUseCase ──────────────────────────────────────────────────


def test_update_entity_type_writes_partial() -> None:
    updated = _entity_type()
    repo = AsyncMock()
    repo.update_entity_type.return_value = updated

    use_case = UpdateEntityTypeUseCase(entity_types=repo)
    result = asyncio.run(use_case.execute(entity_type_id=_ENTITY_TYPE_ID, label="Co.", is_active=False))

    repo.update_entity_type.assert_awaited_once_with(_ENTITY_TYPE_ID, label="Co.", description=None, is_active=False)
    assert result.id == _ENTITY_TYPE_ID


def test_update_entity_type_deactivate() -> None:
    updated = _entity_type()
    repo = AsyncMock()
    repo.update_entity_type.return_value = updated

    use_case = UpdateEntityTypeUseCase(entity_types=repo)
    asyncio.run(use_case.execute(entity_type_id=_ENTITY_TYPE_ID, is_active=False))

    _, kwargs = repo.update_entity_type.call_args
    assert kwargs["is_active"] is False


# ── CreateFieldUseCase ───────────────────────────────────────────────────────


def test_create_field_writes_via_repo() -> None:
    repo = AsyncMock()
    repo.find_entity_type_by_id.return_value = _entity_type(fields=())
    repo.create_field.return_value = _field("shipper")

    use_case = CreateFieldUseCase(entity_types=repo)
    result = asyncio.run(
        use_case.execute(entity_type_id=_ENTITY_TYPE_ID, slug="shipper", label="Shipper", field_type="string")
    )

    repo.create_field.assert_awaited_once()
    assert result.slug == "shipper"


def test_create_field_invalid_field_type_raises() -> None:
    repo = AsyncMock()
    repo.find_entity_type_by_id.return_value = _entity_type(fields=())

    use_case = CreateFieldUseCase(entity_types=repo)
    with pytest.raises(ValueError, match="field_type"):
        asyncio.run(use_case.execute(entity_type_id=_ENTITY_TYPE_ID, slug="x", label="X", field_type="bogus"))

    repo.create_field.assert_not_awaited()


def test_create_field_duplicate_slug_in_type_raises() -> None:
    repo = AsyncMock()
    repo.find_entity_type_by_id.return_value = _entity_type(fields=(_field("name"),))

    use_case = CreateFieldUseCase(entity_types=repo)
    with pytest.raises(ValueError, match="slug exists"):
        asyncio.run(use_case.execute(entity_type_id=_ENTITY_TYPE_ID, slug="name", label="Name", field_type="string"))

    repo.create_field.assert_not_awaited()


def test_create_field_missing_entity_type_raises() -> None:
    repo = AsyncMock()
    repo.find_entity_type_by_id.return_value = None

    use_case = CreateFieldUseCase(entity_types=repo)
    with pytest.raises(ValueError, match="EntityType not found"):
        asyncio.run(use_case.execute(entity_type_id="missing", slug="x", label="X", field_type="string"))

    repo.create_field.assert_not_awaited()


def test_create_field_accepts_every_allowed_field_type() -> None:
    repo = AsyncMock()
    repo.find_entity_type_by_id.return_value = _entity_type(fields=())
    repo.create_field.return_value = _field("x")

    use_case = CreateFieldUseCase(entity_types=repo)
    for field_type in ALLOWED_FIELD_TYPES:
        repo.create_field.reset_mock()
        asyncio.run(
            use_case.execute(entity_type_id=_ENTITY_TYPE_ID, slug=f"f_{field_type}", label="X", field_type=field_type)
        )
        repo.create_field.assert_awaited_once()


# ── UpdateFieldUseCase ───────────────────────────────────────────────────────


def test_update_field_writes_via_repo() -> None:
    repo = AsyncMock()
    repo.update_field.return_value = _field("shipper")

    use_case = UpdateFieldUseCase(entity_types=repo)
    result = asyncio.run(use_case.execute(field_id=_FIELD_ID, label="Shipper Co."))

    repo.update_field.assert_awaited_once()
    assert result.slug == "shipper"


def test_update_field_invalid_field_type_raises() -> None:
    repo = AsyncMock()

    use_case = UpdateFieldUseCase(entity_types=repo)
    with pytest.raises(ValueError, match="field_type"):
        asyncio.run(use_case.execute(field_id=_FIELD_ID, field_type="nope"))

    repo.update_field.assert_not_awaited()


def test_update_field_rename_to_sibling_slug_raises() -> None:
    # WR-03: renaming a field to a slug already held by a SIBLING field on the
    # same entity type is rejected before the write (mirrors create's pre-check).
    repo = AsyncMock()
    sibling = _field("name", field_id=_SIBLING_FIELD_ID)
    target = _field("old_slug", field_id=_FIELD_ID)
    repo.find_entity_type_by_field_id.return_value = _entity_type(fields=(sibling, target))

    use_case = UpdateFieldUseCase(entity_types=repo)
    with pytest.raises(ValueError, match="slug exists"):
        asyncio.run(use_case.execute(field_id=_FIELD_ID, slug="name"))

    repo.find_entity_type_by_field_id.assert_awaited_once_with(_FIELD_ID)
    repo.update_field.assert_not_awaited()


def test_update_field_rename_to_own_slug_is_allowed() -> None:
    # Renaming a field to its own current slug is a no-op (excluded by id), not a
    # 409 — the guard must compare against siblings only.
    repo = AsyncMock()
    target = _field("name", field_id=_FIELD_ID)
    repo.find_entity_type_by_field_id.return_value = _entity_type(fields=(target,))
    repo.update_field.return_value = target

    use_case = UpdateFieldUseCase(entity_types=repo)
    asyncio.run(use_case.execute(field_id=_FIELD_ID, slug="name"))

    repo.update_field.assert_awaited_once()


def test_update_field_unique_slug_passes() -> None:
    # A rename to a slug not held by any sibling proceeds to the write.
    repo = AsyncMock()
    sibling = _field("name", field_id=_SIBLING_FIELD_ID)
    target = _field("old_slug", field_id=_FIELD_ID)
    repo.find_entity_type_by_field_id.return_value = _entity_type(fields=(sibling, target))
    repo.update_field.return_value = _field("fresh", field_id=_FIELD_ID)

    use_case = UpdateFieldUseCase(entity_types=repo)
    asyncio.run(use_case.execute(field_id=_FIELD_ID, slug="fresh"))

    repo.update_field.assert_awaited_once()


def test_update_field_without_slug_skips_uniqueness_check() -> None:
    # When no slug is supplied, the guard (and its lookup) must not run.
    repo = AsyncMock()
    repo.update_field.return_value = _field("name", field_id=_FIELD_ID)

    use_case = UpdateFieldUseCase(entity_types=repo)
    asyncio.run(use_case.execute(field_id=_FIELD_ID, label="New Label"))

    repo.find_entity_type_by_field_id.assert_not_awaited()
    repo.update_field.assert_awaited_once()


# ── DeleteFieldUseCase (D-27 delete-guard) ───────────────────────────────────


def test_delete_field_with_zero_references_hard_deletes() -> None:
    repo = AsyncMock()
    repo.count_confirmed_references.return_value = 0

    use_case = DeleteFieldUseCase(entity_types=repo)
    result = asyncio.run(use_case.execute(field_id=_FIELD_ID))

    repo.count_confirmed_references.assert_awaited_once_with(_FIELD_ID)
    repo.delete_field.assert_awaited_once_with(_FIELD_ID)
    repo.deactivate_field.assert_not_awaited()
    assert isinstance(result, DeleteFieldResult)
    assert result.hard_deleted is True
    assert result.soft_deactivated is False


def test_delete_field_with_confirmed_references_soft_deactivates() -> None:
    repo = AsyncMock()
    repo.count_confirmed_references.return_value = 3
    repo.deactivate_field.return_value = _field("name")

    use_case = DeleteFieldUseCase(entity_types=repo)
    result = asyncio.run(use_case.execute(field_id=_FIELD_ID))

    repo.count_confirmed_references.assert_awaited_once_with(_FIELD_ID)
    # Never hard-delete a referenced field — the D-04 FK must not be orphaned.
    repo.delete_field.assert_not_awaited()
    repo.deactivate_field.assert_awaited_once_with(_FIELD_ID)
    assert result.hard_deleted is False
    assert result.soft_deactivated is True


# ── ReorderFieldsUseCase ─────────────────────────────────────────────────────


def test_reorder_fields_assigns_sort_order_in_id_order() -> None:
    repo = AsyncMock()
    ordered = ["f-3", "f-1", "f-2"]

    use_case = ReorderFieldsUseCase(entity_types=repo)
    asyncio.run(use_case.execute(entity_type_id=_ENTITY_TYPE_ID, ordered_field_ids=ordered))

    repo.reorder_fields.assert_awaited_once_with(_ENTITY_TYPE_ID, ordered)
