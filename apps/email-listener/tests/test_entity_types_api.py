"""Thin integration tests for the /v1/entity-types write router (D-26/D-27).

Mirrors test_components_api.py: builds the real app with a minimal dishka
container providing only the manage-entity-type use cases as AsyncMocks. Covers
the endpoint-level contracts the router owns (the use-case logic itself is unit
tested in tests/application/test_manage_entity_types.py):
  - 200 create entity type + 409 on the slug-exists marker (T-09-22).
  - 422 on a field_type outside the allowlist (Pydantic boundary, T-09-21).
  - 404 on a not-found update.
  - DELETE surfaces the guard outcome (hard_deleted vs soft_deactivated, T-09-23).
  - X-API-Key required (T-09-20).
"""

from __future__ import annotations

import os
from unittest.mock import AsyncMock

from dishka import Provider, Scope, make_async_container
from fastapi.testclient import TestClient

from app.application.use_cases.manage_entity_types import (
    CreateEntityTypeUseCase,
    CreateFieldUseCase,
    DeleteFieldResult,
    DeleteFieldUseCase,
    ReorderFieldsUseCase,
    UpdateEntityTypeUseCase,
    UpdateFieldUseCase,
)
from app.domain.entities.entity_type import EntityType, EntityTypeField
from app.main import create_app
from app.settings import get_settings

_ENTITY_TYPE_ID = "00000000-0000-0000-0000-0000000000e1"
_FIELD_ID = "00000000-0000-0000-0000-0000000000f1"


def _entity_type() -> EntityType:
    return EntityType(
        id=_ENTITY_TYPE_ID,
        importer_id=None,
        slug="company",
        label="Company",
        description="A company entity",
        is_active=True,
        embedding=None,
        fields=(),
    )


def _field(slug: str = "shipper") -> EntityTypeField:
    return EntityTypeField(
        id=_FIELD_ID,
        slug=slug,
        label=slug.title(),
        data_type="string",
        is_identifier=False,
        is_required=False,
        description=None,
        sort_order=0,
    )


def _make_test_client(
    *,
    create_type: AsyncMock | None = None,
    update_type: AsyncMock | None = None,
    create_field: AsyncMock | None = None,
    update_field: AsyncMock | None = None,
    delete_field: AsyncMock | None = None,
    reorder_fields: AsyncMock | None = None,
) -> TestClient:
    """Build the real app with a minimal dishka container of mocked use cases."""
    provider = Provider(scope=Scope.APP)
    provider.provide(lambda: create_type or AsyncMock(spec=CreateEntityTypeUseCase), provides=CreateEntityTypeUseCase)
    provider.provide(lambda: update_type or AsyncMock(spec=UpdateEntityTypeUseCase), provides=UpdateEntityTypeUseCase)
    provider.provide(lambda: create_field or AsyncMock(spec=CreateFieldUseCase), provides=CreateFieldUseCase)
    provider.provide(lambda: update_field or AsyncMock(spec=UpdateFieldUseCase), provides=UpdateFieldUseCase)
    provider.provide(lambda: delete_field or AsyncMock(spec=DeleteFieldUseCase), provides=DeleteFieldUseCase)
    provider.provide(lambda: reorder_fields or AsyncMock(spec=ReorderFieldsUseCase), provides=ReorderFieldsUseCase)

    app = create_app()
    app.state.dishka_container = make_async_container(provider)
    return TestClient(app, raise_server_exceptions=False)


def test_create_entity_type_returns_200() -> None:
    use_case = AsyncMock(spec=CreateEntityTypeUseCase)
    use_case.execute.return_value = _entity_type()

    client = _make_test_client(create_type=use_case)
    resp = client.post("/v1/entity-types", json={"slug": "company", "label": "Company"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["slug"] == "company"


def test_create_entity_type_duplicate_slug_returns_409() -> None:
    use_case = AsyncMock(spec=CreateEntityTypeUseCase)
    use_case.execute.side_effect = ValueError("entity type slug exists: company")

    client = _make_test_client(create_type=use_case)
    resp = client.post("/v1/entity-types", json={"slug": "company", "label": "Company"})

    assert resp.status_code == 409


def test_update_entity_type_not_found_returns_404() -> None:
    use_case = AsyncMock(spec=UpdateEntityTypeUseCase)
    use_case.execute.side_effect = ValueError(f"EntityType not found: {_ENTITY_TYPE_ID}")

    client = _make_test_client(update_type=use_case)
    resp = client.patch(f"/v1/entity-types/{_ENTITY_TYPE_ID}", json={"label": "Co."})

    assert resp.status_code == 404


def test_create_field_invalid_field_type_returns_422() -> None:
    # The Pydantic boundary rejects an out-of-allowlist field_type (D-27) before
    # the use case runs.
    use_case = AsyncMock(spec=CreateFieldUseCase)

    client = _make_test_client(create_field=use_case)
    resp = client.post(
        f"/v1/entity-types/{_ENTITY_TYPE_ID}/fields",
        json={"slug": "x", "label": "X", "field_type": "bogus"},
    )

    assert resp.status_code == 422
    use_case.execute.assert_not_awaited()


def test_create_field_returns_200_for_allowed_field_type() -> None:
    use_case = AsyncMock(spec=CreateFieldUseCase)
    use_case.execute.return_value = _field("shipper")

    client = _make_test_client(create_field=use_case)
    resp = client.post(
        f"/v1/entity-types/{_ENTITY_TYPE_ID}/fields",
        json={"slug": "shipper", "label": "Shipper", "field_type": "string"},
    )

    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["field_type"] == "string"
    # HIGH-3: the field uuid is now surfaced so the client can address it.
    assert body["id"] == _FIELD_ID


def test_delete_field_soft_deactivated_surfaced_in_body() -> None:
    use_case = AsyncMock(spec=DeleteFieldUseCase)
    use_case.execute.return_value = DeleteFieldResult(
        field_id=_FIELD_ID,
        hard_deleted=False,
        soft_deactivated=True,
        confirmed_references=2,
    )

    client = _make_test_client(delete_field=use_case)
    resp = client.delete(f"/v1/entity-types/fields/{_FIELD_ID}")

    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["soft_deactivated"] is True
    assert body["hard_deleted"] is False


def test_delete_field_hard_deleted_surfaced_in_body() -> None:
    use_case = AsyncMock(spec=DeleteFieldUseCase)
    use_case.execute.return_value = DeleteFieldResult(
        field_id=_FIELD_ID,
        hard_deleted=True,
        soft_deactivated=False,
        confirmed_references=0,
    )

    client = _make_test_client(delete_field=use_case)
    resp = client.delete(f"/v1/entity-types/fields/{_FIELD_ID}")

    assert resp.status_code == 200
    assert resp.json()["data"]["hard_deleted"] is True


def test_reorder_fields_returns_200() -> None:
    use_case = AsyncMock(spec=ReorderFieldsUseCase)

    client = _make_test_client(reorder_fields=use_case)
    resp = client.post(
        f"/v1/entity-types/{_ENTITY_TYPE_ID}/fields/reorder",
        json={"ordered_field_ids": ["f-2", "f-1"]},
    )

    assert resp.status_code == 200
    use_case.execute.assert_awaited_once()


def test_entity_types_requires_api_key() -> None:
    """All routes are protected by router-level X-API-Key (T-09-20)."""
    old_key = os.environ.get("API_KEY")
    os.environ["API_KEY"] = "test-secret-key"
    get_settings.cache_clear()
    try:
        use_case = AsyncMock(spec=CreateEntityTypeUseCase)
        use_case.execute.return_value = _entity_type()
        client = _make_test_client(create_type=use_case)

        resp_noauth = client.post("/v1/entity-types", json={"slug": "company", "label": "Company"})
        assert resp_noauth.status_code == 401

        resp_authed = client.post(
            "/v1/entity-types",
            json={"slug": "company", "label": "Company"},
            headers={"X-API-Key": "test-secret-key"},
        )
        assert resp_authed.status_code == 200
    finally:
        if old_key is None:
            os.environ.pop("API_KEY", None)
        else:
            os.environ["API_KEY"] = old_key
        get_settings.cache_clear()
