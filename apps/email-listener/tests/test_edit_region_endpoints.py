"""Tests for Task 3: seven region-edit endpoints under /v1/components.

Behavior contract (from PLAN 06-01 Task 3):
  - POST /v1/components/{id}/accept  -> 200 / 404 / 401
  - POST /v1/components/{id}/reject  -> 200 / 404 / 401
  - POST /v1/components/{id}/redraw  -> 200; bad polygon -> 422
  - POST /v1/components/{id}/split   -> 200; <2 regions -> 422
  - POST /v1/components/merge        -> 200; <2 ids -> 422; cross-email -> 404
  - POST /v1/components/{id}/nest    -> 200 (parent set or cleared)
  - POST /v1/components/{page_id}/regions -> 200 creating a candidate

Geometry validation (T-06-01): polygon must be exactly 4 [x,y] pairs with every
coord in [0,1]; page_index must be >= 0 (T-06-02). Violations -> 422 (Pydantic).
Auth (T-06-05): all routes behind X-API-Key via the router dependency.
"""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock

import pytest
from dishka import Provider, Scope, make_async_container
from fastapi.testclient import TestClient

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
from app.main import create_app
from app.settings import get_settings

_COMP_ID = "00000000-0000-0000-0000-000000000001"
_COMP_ID_2 = "00000000-0000-0000-0000-000000000002"
_PAGE_ID = "00000000-0000-0000-0000-000000000003"
_IMPORTER_ID = "00000000-0000-0000-0000-000000000004"
# A valid UUID that the mocked use-cases are configured to treat as "not found"
_UNKNOWN_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff"

_VALID_POLYGON = [[0.1, 0.1], [0.5, 0.1], [0.5, 0.4], [0.1, 0.4]]


def _make_component(
    component_id: str = _COMP_ID,
    status: str = "candidate",
    parent_component_id: str | None = _PAGE_ID,
) -> Component:
    return Component(
        id=component_id,
        email_id="email-0001",
        importer_id=_IMPORTER_ID,
        attachment_id="att-0001",
        parent_component_id=parent_component_id,
        source_type="region",
        location={"page_index": 0, "polygon": _VALID_POLYGON},
        content_text="region text",
        content_markdown=None,
        content_raw=None,
        embedding=None,
        sequence_index=0,
        extraction_status=status,
    )


@pytest.fixture
def mocks() -> dict[str, MagicMock]:
    accept = MagicMock()
    accept.execute = AsyncMock(return_value=_make_component(status="candidate"))

    reject = MagicMock()
    reject.execute = AsyncMock(return_value=_make_component(status="rejected"))

    redraw = MagicMock()
    redraw.execute = AsyncMock(return_value=_make_component(component_id="comp-new-redraw"))

    split = MagicMock()
    split.execute = AsyncMock(
        return_value=[
            _make_component(component_id="comp-new-a"),
            _make_component(component_id="comp-new-b"),
        ]
    )

    merge = MagicMock()
    merge.execute = AsyncMock(return_value=_make_component(component_id="comp-new-merged"))

    nest = MagicMock()
    nest.execute = AsyncMock(return_value=_make_component())

    create = MagicMock()
    create.execute = AsyncMock(return_value=_make_component(component_id="comp-new-created"))

    return {
        "accept": accept,
        "reject": reject,
        "redraw": redraw,
        "split": split,
        "merge": merge,
        "nest": nest,
        "create": create,
    }


def _build_app(mocks: dict[str, MagicMock]) -> TestClient:
    provider = Provider(scope=Scope.APP)

    def provide_accept() -> AcceptRegionUseCase:
        return mocks["accept"]

    def provide_reject() -> RejectRegionUseCase:
        return mocks["reject"]

    def provide_redraw() -> RedrawRegionUseCase:
        return mocks["redraw"]

    def provide_split() -> SplitRegionUseCase:
        return mocks["split"]

    def provide_merge() -> MergeRegionsUseCase:
        return mocks["merge"]

    def provide_nest() -> NestRegionUseCase:
        return mocks["nest"]

    def provide_create() -> CreateRegionUseCase:
        return mocks["create"]

    provider.provide(provide_accept, provides=AcceptRegionUseCase)
    provider.provide(provide_reject, provides=RejectRegionUseCase)
    provider.provide(provide_redraw, provides=RedrawRegionUseCase)
    provider.provide(provide_split, provides=SplitRegionUseCase)
    provider.provide(provide_merge, provides=MergeRegionsUseCase)
    provider.provide(provide_nest, provides=NestRegionUseCase)
    provider.provide(provide_create, provides=CreateRegionUseCase)

    app = create_app()
    app.state.dishka_container = make_async_container(provider)
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def client(mocks: dict[str, MagicMock]) -> TestClient:
    get_settings.cache_clear()
    return _build_app(mocks)


# ---------------------------------------------------------------------------
# Accept / Reject — status-only transitions
# ---------------------------------------------------------------------------


def test_accept_returns_200(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    resp = client.post(f"/v1/components/{_COMP_ID}/accept")

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["component_id"] == _COMP_ID
    assert body["data"]["extraction_status"] == "candidate"
    mocks["accept"].execute.assert_awaited_once_with(component_id=_COMP_ID)


def test_accept_unknown_id_returns_404(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    mocks["accept"].execute.side_effect = ValueError(f"Component not found: {_UNKNOWN_ID}")

    resp = client.post(f"/v1/components/{_UNKNOWN_ID}/accept")
    assert resp.status_code == 404


def test_reject_returns_200(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    resp = client.post(f"/v1/components/{_COMP_ID}/reject")

    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["extraction_status"] == "rejected"
    mocks["reject"].execute.assert_awaited_once_with(component_id=_COMP_ID)


def test_reject_unknown_id_returns_404(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    mocks["reject"].execute.side_effect = ValueError(f"Component not found: {_UNKNOWN_ID}")

    resp = client.post(f"/v1/components/{_UNKNOWN_ID}/reject")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Redraw — supersede + new candidate; geometry validated at the boundary
# ---------------------------------------------------------------------------


def test_redraw_returns_200_with_valid_polygon(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    resp = client.post(
        f"/v1/components/{_COMP_ID}/redraw",
        json={"polygon": _VALID_POLYGON, "page_index": 0},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["component_id"] == "comp-new-redraw"
    call_kwargs = mocks["redraw"].execute.call_args[1]
    assert call_kwargs["component_id"] == _COMP_ID
    assert call_kwargs["polygon"] == _VALID_POLYGON
    assert call_kwargs["page_index"] == 0


def test_redraw_wrong_polygon_length_returns_422(client: TestClient) -> None:
    resp = client.post(
        f"/v1/components/{_COMP_ID}/redraw",
        json={"polygon": [[0.1, 0.1], [0.5, 0.1], [0.5, 0.4]], "page_index": 0},
    )
    assert resp.status_code == 422


def test_redraw_coord_out_of_range_returns_422(client: TestClient) -> None:
    resp = client.post(
        f"/v1/components/{_COMP_ID}/redraw",
        json={"polygon": [[0.1, 0.1], [1.5, 0.1], [0.5, 0.4], [0.1, 0.4]], "page_index": 0},
    )
    assert resp.status_code == 422


def test_redraw_point_not_a_pair_returns_422(client: TestClient) -> None:
    resp = client.post(
        f"/v1/components/{_COMP_ID}/redraw",
        json={"polygon": [[0.1], [0.5, 0.1], [0.5, 0.4], [0.1, 0.4]], "page_index": 0},
    )
    assert resp.status_code == 422


def test_redraw_negative_page_index_returns_422(client: TestClient) -> None:
    resp = client.post(
        f"/v1/components/{_COMP_ID}/redraw",
        json={"polygon": _VALID_POLYGON, "page_index": -1},
    )
    assert resp.status_code == 422


def test_redraw_unknown_id_returns_404(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    mocks["redraw"].execute.side_effect = ValueError(f"Component not found: {_UNKNOWN_ID}")

    resp = client.post(
        f"/v1/components/{_UNKNOWN_ID}/redraw",
        json={"polygon": _VALID_POLYGON, "page_index": 0},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Split — >=2 regions
# ---------------------------------------------------------------------------


def test_split_returns_200(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    resp = client.post(
        f"/v1/components/{_COMP_ID}/split",
        json={
            "regions": [
                {"polygon": _VALID_POLYGON, "page_index": 0},
                {"polygon": _VALID_POLYGON, "page_index": 0},
            ]
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["component_ids"] == ["comp-new-a", "comp-new-b"]
    call_kwargs = mocks["split"].execute.call_args[1]
    assert call_kwargs["component_id"] == _COMP_ID
    assert len(call_kwargs["regions"]) == 2


def test_split_single_region_returns_422(client: TestClient) -> None:
    resp = client.post(
        f"/v1/components/{_COMP_ID}/split",
        json={"regions": [{"polygon": _VALID_POLYGON, "page_index": 0}]},
    )
    assert resp.status_code == 422


def test_split_bad_inner_polygon_returns_422(client: TestClient) -> None:
    resp = client.post(
        f"/v1/components/{_COMP_ID}/split",
        json={
            "regions": [
                {"polygon": _VALID_POLYGON, "page_index": 0},
                {"polygon": [[0.1, 0.1]], "page_index": 0},
            ]
        },
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Merge — >=2 component ids; cross-email rejected by use case -> 404
# ---------------------------------------------------------------------------


def test_merge_returns_200(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    resp = client.post(
        "/v1/components/merge",
        json={"component_ids": [_COMP_ID, _COMP_ID_2]},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["component_id"] == "comp-new-merged"
    call_kwargs = mocks["merge"].execute.call_args[1]
    assert call_kwargs["component_ids"] == [_COMP_ID, _COMP_ID_2]


def test_merge_with_explicit_polygon_returns_200(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    resp = client.post(
        "/v1/components/merge",
        json={
            "component_ids": [_COMP_ID, _COMP_ID_2],
            "polygon": _VALID_POLYGON,
            "page_index": 1,
        },
    )

    assert resp.status_code == 200
    call_kwargs = mocks["merge"].execute.call_args[1]
    assert call_kwargs["polygon"] == _VALID_POLYGON
    assert call_kwargs["page_index"] == 1


def test_merge_single_id_returns_422(client: TestClient) -> None:
    resp = client.post("/v1/components/merge", json={"component_ids": [_COMP_ID]})
    assert resp.status_code == 422


def test_merge_bad_polygon_returns_422(client: TestClient) -> None:
    resp = client.post(
        "/v1/components/merge",
        json={"component_ids": [_COMP_ID, _COMP_ID_2], "polygon": [[2.0, 0.1]]},
    )
    assert resp.status_code == 422


def test_merge_cross_email_returns_404(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    mocks["merge"].execute.side_effect = ValueError(
        "Cannot merge components that do not share the same email and attachment"
    )

    resp = client.post(
        "/v1/components/merge",
        json={"component_ids": [_COMP_ID, _COMP_ID_2]},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Nest — set or clear parent (no supersede)
# ---------------------------------------------------------------------------


def test_nest_returns_200(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    resp = client.post(
        f"/v1/components/{_COMP_ID}/nest",
        json={"parent_component_id": _PAGE_ID},
    )

    assert resp.status_code == 200
    call_kwargs = mocks["nest"].execute.call_args[1]
    assert call_kwargs["component_id"] == _COMP_ID
    assert call_kwargs["parent_component_id"] == _PAGE_ID


def test_nest_null_parent_returns_200(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    resp = client.post(
        f"/v1/components/{_COMP_ID}/nest",
        json={"parent_component_id": None},
    )

    assert resp.status_code == 200
    call_kwargs = mocks["nest"].execute.call_args[1]
    assert call_kwargs["parent_component_id"] is None


def test_nest_unknown_id_returns_404(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    mocks["nest"].execute.side_effect = ValueError(f"Component not found: {_UNKNOWN_ID}")

    resp = client.post(f"/v1/components/{_UNKNOWN_ID}/nest", json={"parent_component_id": None})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Create region — "Add region" with zero prior proposals
# ---------------------------------------------------------------------------


def test_create_region_returns_200(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    resp = client.post(
        f"/v1/components/{_PAGE_ID}/regions",
        json={"polygon": _VALID_POLYGON, "page_index": 0},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["component_id"] == "comp-new-created"
    call_kwargs = mocks["create"].execute.call_args[1]
    assert call_kwargs["page_component_id"] == _PAGE_ID
    assert call_kwargs["polygon"] == _VALID_POLYGON


def test_create_region_bad_polygon_returns_422(client: TestClient) -> None:
    resp = client.post(
        f"/v1/components/{_PAGE_ID}/regions",
        json={"polygon": [[0.1, 0.1], [0.5, 0.1]], "page_index": 0},
    )
    assert resp.status_code == 422


def test_create_region_unknown_page_returns_404(client: TestClient, mocks: dict[str, MagicMock]) -> None:
    mocks["create"].execute.side_effect = ValueError(f"Component not found: {_UNKNOWN_ID}")

    resp = client.post(
        f"/v1/components/{_UNKNOWN_ID}/regions",
        json={"polygon": _VALID_POLYGON, "page_index": 0},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Auth — all routes behind X-API-Key (T-06-05)
# ---------------------------------------------------------------------------


def test_edit_endpoints_require_api_key(mocks: dict[str, MagicMock]) -> None:
    old_key = os.environ.get("API_KEY")
    os.environ["API_KEY"] = "test-secret-key"
    get_settings.cache_clear()
    try:
        auth_client = _build_app(mocks)

        resp = auth_client.post(f"/v1/components/{_COMP_ID}/accept")
        assert resp.status_code == 401

        resp_authed = auth_client.post(
            f"/v1/components/{_COMP_ID}/accept",
            headers={"X-API-Key": "test-secret-key"},
        )
        assert resp_authed.status_code == 200

        resp_merge = auth_client.post(
            "/v1/components/merge",
            json={"component_ids": [_COMP_ID, _COMP_ID_2]},
        )
        assert resp_merge.status_code == 401
    finally:
        if old_key is None:
            os.environ.pop("API_KEY", None)
        else:
            os.environ["API_KEY"] = old_key
        get_settings.cache_clear()
