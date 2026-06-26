"""Tests for the /v1/components endpoints (autofill + field-relationship boundary)."""

from __future__ import annotations

import os
from unittest.mock import AsyncMock

import pytest
from dishka import Provider, Scope, make_async_container
from fastapi.testclient import TestClient

from app.application.use_cases.autofill import AutofillUseCase
from app.application.use_cases.autofill_fields import AutofilledField, AutofillFieldsUseCase
from app.application.use_cases.deny_field import DenyFieldUseCase
from app.application.use_cases.set_component_relationship import (
    SetComponentEntityTypeUseCase,
    SetComponentFieldRelationshipUseCase,
    SetComponentRoleUseCase,
)
from app.domain.entities.component import Component
from app.domain.ports.autofill_protocol import AutofillResult
from app.main import create_app
from app.settings import get_settings

_RESULT = AutofillResult(
    extracted_fields={"vendor_name": "Acme", "invoice_number": "INV-001"},
    confidence_score=0.85,
    confidence_breakdown={"vendor_name": 0.9, "invoice_number": 0.8},
)


def _make_test_client(mock_use_case: AutofillUseCase) -> TestClient:
    """Build a test app with a minimal dishka container providing only AutofillUseCase."""

    def provide_use_case() -> AutofillUseCase:
        return mock_use_case

    provider = Provider(scope=Scope.APP)
    provider.provide(provide_use_case, provides=AutofillUseCase)

    app = create_app()
    app.state.dishka_container = make_async_container(provider)
    return TestClient(app, raise_server_exceptions=False)


def test_autofill_returns_200_with_proposed_fields() -> None:
    """POST /v1/components/{id}/autofill returns 200 with AutofillResultView."""
    mock_use_case = AsyncMock(spec=AutofillUseCase)
    mock_use_case.execute.return_value = _RESULT

    client = _make_test_client(mock_use_case)
    resp = client.post(
        "/v1/components/00000000-0000-0000-0000-000000000001/autofill",
        json={"entity_type_slug": "invoice"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["extracted_fields"]["vendor_name"] == "Acme"
    assert body["data"]["confidence_score"] == pytest.approx(0.85)


def test_autofill_requires_api_key() -> None:
    """POST /v1/components/{id}/autofill returns 401 without X-API-Key when auth is configured."""
    old_key = os.environ.get("API_KEY")
    os.environ["API_KEY"] = "test-secret-key"
    get_settings.cache_clear()
    try:
        mock_use_case = AsyncMock(spec=AutofillUseCase)
        mock_use_case.execute.return_value = _RESULT

        def provide_use_case() -> AutofillUseCase:
            return mock_use_case

        provider = Provider(scope=Scope.APP)
        provider.provide(provide_use_case, provides=AutofillUseCase)

        app = create_app()
        app.state.dishka_container = make_async_container(provider)
        auth_client = TestClient(app, raise_server_exceptions=False)

        # No X-API-Key header → 401
        resp = auth_client.post(
            "/v1/components/00000000-0000-0000-0000-000000000001/autofill",
            json={"entity_type_slug": "invoice"},
        )
        assert resp.status_code == 401

        # With correct X-API-Key → 200
        resp_authed = auth_client.post(
            "/v1/components/00000000-0000-0000-0000-000000000001/autofill",
            json={"entity_type_slug": "invoice"},
            headers={"X-API-Key": "test-secret-key"},
        )
        assert resp_authed.status_code == 200
    finally:
        if old_key is None:
            os.environ.pop("API_KEY", None)
        else:
            os.environ["API_KEY"] = old_key
        get_settings.cache_clear()


def test_autofill_404_on_unknown_component() -> None:
    """POST /v1/components/{id}/autofill returns 404 when use case raises ValueError."""
    unknown_id = "ffffffff-ffff-ffff-ffff-ffffffffffff"
    mock_use_case = AsyncMock(spec=AutofillUseCase)
    mock_use_case.execute.side_effect = ValueError(f"Component not found: {unknown_id}")

    client = _make_test_client(mock_use_case)
    resp = client.post(
        f"/v1/components/{unknown_id}/autofill",
        json={"entity_type_slug": "invoice"},
    )

    assert resp.status_code == 404


# ---- Field-relationship boundary: UUID validation (Bundle C / D-04) ----

_COMPONENT_UUID = "00000000-0000-0000-0000-000000000001"
_PARENT_UUID = "00000000-0000-0000-0000-000000000099"
_FIELD_UUID = "00000000-0000-0000-0000-0000000000aa"


def _field_relationship_component() -> Component:
    return Component(
        id=_COMPONENT_UUID,
        email_id="email-0001",
        importer_id="imp-0001",
        attachment_id="attach-0001",
        parent_component_id=_PARENT_UUID,
        source_type="region",
        location={"page_index": 0, "polygon": [[0, 0], [1, 0], [1, 1], [0, 1]]},
        content_text="region text",
        content_markdown=None,
        content_raw=None,
        embedding=None,
        sequence_index=0,
        extraction_status="candidate",
        role="field",
        entity_type_id=None,
        entity_type_field_id=_FIELD_UUID,
    )


def _make_field_relationship_client(
    mock_use_case: SetComponentFieldRelationshipUseCase,
) -> TestClient:
    """Build a test app whose only provided use case is the field-relationship setter."""

    def provide_use_case() -> SetComponentFieldRelationshipUseCase:
        return mock_use_case

    provider = Provider(scope=Scope.APP)
    provider.provide(provide_use_case, provides=SetComponentFieldRelationshipUseCase)

    app = create_app()
    app.state.dishka_container = make_async_container(provider)
    return TestClient(app, raise_server_exceptions=False)


def test_field_relationship_valid_uuids_returns_200() -> None:
    """A well-formed entity_type_field_id (uuid) reaches the use case → 200."""
    mock_use_case = AsyncMock(spec=SetComponentFieldRelationshipUseCase)
    mock_use_case.execute.return_value = _field_relationship_component()

    client = _make_field_relationship_client(mock_use_case)
    resp = client.patch(
        f"/v1/components/{_COMPONENT_UUID}/field-relationship",
        json={
            "parent_component_id": _PARENT_UUID,
            "entity_type_field_id": _FIELD_UUID,
        },
    )

    assert resp.status_code == 200
    # The use case must receive plain str ids (coerced from the UUID boundary type).
    _, kwargs = mock_use_case.execute.call_args
    assert kwargs["parent_component_id"] == _PARENT_UUID
    assert kwargs["entity_type_field_id"] == _FIELD_UUID
    assert isinstance(kwargs["entity_type_field_id"], str)
    assert isinstance(kwargs["parent_component_id"], str)


def test_field_relationship_null_ids_clear_relationship() -> None:
    """Both ids null clears the relationship (D-11) → 200, use case sees None."""
    mock_use_case = AsyncMock(spec=SetComponentFieldRelationshipUseCase)
    mock_use_case.execute.return_value = _field_relationship_component()

    client = _make_field_relationship_client(mock_use_case)
    resp = client.patch(
        f"/v1/components/{_COMPONENT_UUID}/field-relationship",
        json={"parent_component_id": None, "entity_type_field_id": None},
    )

    assert resp.status_code == 200
    _, kwargs = mock_use_case.execute.call_args
    assert kwargs["parent_component_id"] is None
    assert kwargs["entity_type_field_id"] is None


def test_field_relationship_malformed_field_id_returns_422() -> None:
    """A non-uuid entity_type_field_id is rejected at the boundary (422), never reaches Postgres."""
    mock_use_case = AsyncMock(spec=SetComponentFieldRelationshipUseCase)
    mock_use_case.execute.return_value = _field_relationship_component()

    client = _make_field_relationship_client(mock_use_case)
    resp = client.patch(
        f"/v1/components/{_COMPONENT_UUID}/field-relationship",
        json={"parent_component_id": None, "entity_type_field_id": "not-a-uuid"},
    )

    assert resp.status_code == 422
    mock_use_case.execute.assert_not_called()


def test_field_relationship_malformed_parent_id_returns_422() -> None:
    """A non-uuid parent_component_id is rejected at the boundary (422) too."""
    mock_use_case = AsyncMock(spec=SetComponentFieldRelationshipUseCase)
    mock_use_case.execute.return_value = _field_relationship_component()

    client = _make_field_relationship_client(mock_use_case)
    resp = client.patch(
        f"/v1/components/{_COMPONENT_UUID}/field-relationship",
        json={"parent_component_id": "bogus", "entity_type_field_id": _FIELD_UUID},
    )

    assert resp.status_code == 422
    mock_use_case.execute.assert_not_called()


# ---- Thin-integration tests for the 4 new Phase-9 routes ----
# (TEST-DEBT 09-gap D1) /role, /entity-type, /deny, /autofill-fields — each:
# 200 happy-path + ValueError→404 + malformed-uuid→422. Mirrors the entity-types
# router suite: build the real app with a minimal dishka container of one mock.

_MALFORMED_UUID = "not-a-uuid"


def _single_use_case_client(provided_type: type, mock_use_case: object) -> TestClient:
    """Build the real app whose only provided dependency is `provided_type`."""
    provider = Provider(scope=Scope.APP)
    provider.provide(lambda: mock_use_case, provides=provided_type)
    app = create_app()
    app.state.dishka_container = make_async_container(provider)
    return TestClient(app, raise_server_exceptions=False)


def _region_component(*, role: str | None = "entity") -> Component:
    return Component(
        id=_COMPONENT_UUID,
        email_id="email-0001",
        importer_id="imp-0001",
        attachment_id="attach-0001",
        parent_component_id=None,
        source_type="region",
        location={"page_index": 0, "polygon": [[0, 0], [1, 0], [1, 1], [0, 1]]},
        content_text="region text",
        content_markdown=None,
        content_raw=None,
        embedding=None,
        sequence_index=0,
        extraction_status="candidate",
        role=role,
        entity_type_id=None,
    )


# ── PATCH /{id}/role ─────────────────────────────────────────────────────────


def test_set_role_returns_200() -> None:
    mock = AsyncMock(spec=SetComponentRoleUseCase)
    mock.execute.return_value = _region_component(role="entity")
    client = _single_use_case_client(SetComponentRoleUseCase, mock)

    resp = client.patch(f"/v1/components/{_COMPONENT_UUID}/role", json={"role": "entity"})

    assert resp.status_code == 200
    assert resp.json()["data"]["component_id"] == _COMPONENT_UUID
    _, kwargs = mock.execute.call_args
    assert kwargs["role"] == "entity"


def test_set_role_404_on_unknown_component() -> None:
    mock = AsyncMock(spec=SetComponentRoleUseCase)
    mock.execute.side_effect = ValueError("Component not found: x")
    client = _single_use_case_client(SetComponentRoleUseCase, mock)

    resp = client.patch(f"/v1/components/{_COMPONENT_UUID}/role", json={"role": "field"})
    assert resp.status_code == 404


def test_set_role_malformed_uuid_returns_422() -> None:
    mock = AsyncMock(spec=SetComponentRoleUseCase)
    client = _single_use_case_client(SetComponentRoleUseCase, mock)

    resp = client.patch(f"/v1/components/{_MALFORMED_UUID}/role", json={"role": "field"})
    assert resp.status_code == 422
    mock.execute.assert_not_called()


def test_set_role_invalid_role_value_returns_422() -> None:
    # The Pydantic Literal allow-list rejects an out-of-set role at the boundary.
    mock = AsyncMock(spec=SetComponentRoleUseCase)
    client = _single_use_case_client(SetComponentRoleUseCase, mock)

    resp = client.patch(f"/v1/components/{_COMPONENT_UUID}/role", json={"role": "bogus"})
    assert resp.status_code == 422
    mock.execute.assert_not_called()


# ── PATCH /{id}/entity-type ──────────────────────────────────────────────────


def test_set_entity_type_returns_200() -> None:
    mock = AsyncMock(spec=SetComponentEntityTypeUseCase)
    mock.execute.return_value = _region_component()
    client = _single_use_case_client(SetComponentEntityTypeUseCase, mock)

    resp = client.patch(
        f"/v1/components/{_COMPONENT_UUID}/entity-type",
        json={"entity_type_id": "00000000-0000-0000-0000-0000000000e7"},
    )

    assert resp.status_code == 200
    _, kwargs = mock.execute.call_args
    assert kwargs["entity_type_id"] == "00000000-0000-0000-0000-0000000000e7"


def test_set_entity_type_404_on_unknown_component() -> None:
    mock = AsyncMock(spec=SetComponentEntityTypeUseCase)
    mock.execute.side_effect = ValueError("Component not found: x")
    client = _single_use_case_client(SetComponentEntityTypeUseCase, mock)

    resp = client.patch(f"/v1/components/{_COMPONENT_UUID}/entity-type", json={"entity_type_id": None})
    assert resp.status_code == 404


def test_set_entity_type_malformed_uuid_returns_422() -> None:
    mock = AsyncMock(spec=SetComponentEntityTypeUseCase)
    client = _single_use_case_client(SetComponentEntityTypeUseCase, mock)

    resp = client.patch(f"/v1/components/{_MALFORMED_UUID}/entity-type", json={"entity_type_id": None})
    assert resp.status_code == 422
    mock.execute.assert_not_called()


# ── POST /{id}/deny ──────────────────────────────────────────────────────────


def test_deny_returns_200() -> None:
    mock = AsyncMock(spec=DenyFieldUseCase)
    mock.execute.return_value = _region_component(role="field")
    client = _single_use_case_client(DenyFieldUseCase, mock)

    resp = client.post(f"/v1/components/{_COMPONENT_UUID}/deny")

    assert resp.status_code == 200
    assert resp.json()["data"]["component_id"] == _COMPONENT_UUID
    _, kwargs = mock.execute.call_args
    assert kwargs["component_id"] == _COMPONENT_UUID


def test_deny_404_on_unknown_component() -> None:
    mock = AsyncMock(spec=DenyFieldUseCase)
    mock.execute.side_effect = ValueError("Component not found: x")
    client = _single_use_case_client(DenyFieldUseCase, mock)

    resp = client.post(f"/v1/components/{_COMPONENT_UUID}/deny")
    assert resp.status_code == 404


def test_deny_malformed_uuid_returns_422() -> None:
    mock = AsyncMock(spec=DenyFieldUseCase)
    client = _single_use_case_client(DenyFieldUseCase, mock)

    resp = client.post(f"/v1/components/{_MALFORMED_UUID}/deny")
    assert resp.status_code == 422
    mock.execute.assert_not_called()


# ── POST /{id}/autofill-fields ───────────────────────────────────────────────


def test_autofill_fields_returns_200_with_field_list() -> None:
    mock = AsyncMock(spec=AutofillFieldsUseCase)
    mock.execute.return_value = [
        AutofilledField(
            field_component_id=_COMPONENT_UUID,
            entity_type_field_id="00000000-0000-0000-0000-0000000000f5",
            candidate_value="ACME",
            confidence=0.9,
        )
    ]
    client = _single_use_case_client(AutofillFieldsUseCase, mock)

    resp = client.post(f"/v1/components/{_COMPONENT_UUID}/autofill-fields")

    assert resp.status_code == 200
    body = resp.json()["data"]
    assert len(body["fields"]) == 1
    assert body["fields"][0]["entity_type_field_id"] == "00000000-0000-0000-0000-0000000000f5"
    assert body["fields"][0]["candidate_value"] == "ACME"
    _, kwargs = mock.execute.call_args
    assert kwargs["entity_component_id"] == _COMPONENT_UUID


def test_autofill_fields_404_on_non_entity_component() -> None:
    mock = AsyncMock(spec=AutofillFieldsUseCase)
    mock.execute.side_effect = ValueError("Component not found: x")
    client = _single_use_case_client(AutofillFieldsUseCase, mock)

    resp = client.post(f"/v1/components/{_COMPONENT_UUID}/autofill-fields")
    assert resp.status_code == 404


def test_autofill_fields_malformed_uuid_returns_422() -> None:
    mock = AsyncMock(spec=AutofillFieldsUseCase)
    client = _single_use_case_client(AutofillFieldsUseCase, mock)

    resp = client.post(f"/v1/components/{_MALFORMED_UUID}/autofill-fields")
    assert resp.status_code == 422
    mock.execute.assert_not_called()
