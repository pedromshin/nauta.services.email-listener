"""Tests for Phase 57-01 (LEARN-01): entity-type correction capture + retrieval.

Tests cover:
  1. EntityTypeCorrectionExample — frozen dataclass shape
  2. SupabaseEntityTypeCorrectionRepository.save — exact insert payload
  3. SupabaseEntityTypeCorrectionRepository.find_similar — importer-scoped RPC
     params, NO match_entity_type_id key (Pitfall 4)
  4. find_similar — row mapping to EntityTypeCorrectionExample
  5. find_similar — degrade-safe: RPC failure returns [] (D-13), never raises
"""

from __future__ import annotations

from dataclasses import FrozenInstanceError
from typing import Any

import pytest

from app.domain.ports.entity_type_correction_repository import (
    EntityTypeCorrectionExample,
)
from app.infrastructure.supabase.entity_type_correction_repository import (
    SupabaseEntityTypeCorrectionRepository,
)

_IMPORTER_ID = "importer-1"
_COMPONENT_ID = "component-1"
_PREVIOUS_TYPE_ID = "et-A"
_CORRECTED_TYPE_ID = "et-B"


class FakeSupabaseClient:
    """Minimal fake Supabase client recording table().insert() and rpc() calls."""

    def __init__(
        self,
        rpc_rows: list[dict[str, Any]] | None = None,
        raise_on_rpc: bool = False,
    ) -> None:
        self.inserted_table: str | None = None
        self.inserted_payload: dict[str, Any] | None = None
        self.rpc_name: str | None = None
        self.rpc_params: dict[str, Any] | None = None
        self._rpc_rows = rpc_rows or []
        self._raise_on_rpc = raise_on_rpc
        self._pending = ""

    def table(self, name: str) -> FakeSupabaseClient:
        self.inserted_table = name
        self._pending = "insert"
        return self

    def insert(self, payload: dict[str, Any]) -> FakeSupabaseClient:
        self.inserted_payload = payload
        return self

    def rpc(self, name: str, params: dict[str, Any]) -> FakeSupabaseClient:
        self.rpc_name = name
        self.rpc_params = params
        self._pending = "rpc"
        return self

    def execute(self) -> _FakeResult:
        if self._pending == "rpc":
            if self._raise_on_rpc:
                raise RuntimeError("simulated RPC failure")
            return _FakeResult(data=self._rpc_rows)
        return _FakeResult(data=[self.inserted_payload])


class _FakeResult:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class TestEntityTypeCorrectionExample:
    def test_is_frozen_dataclass(self) -> None:
        example = EntityTypeCorrectionExample(
            content_text="MSCU1234567 container",
            corrected_entity_type_slug="bill_of_lading",
            score=0.42,
        )
        assert example.content_text == "MSCU1234567 container"
        assert example.corrected_entity_type_slug == "bill_of_lading"
        assert example.score == 0.42
        with pytest.raises(FrozenInstanceError):
            example.score = 0.99  # type: ignore[misc]


class TestSave:
    @pytest.mark.asyncio
    async def test_save_inserts_exact_payload(self) -> None:
        fake_client = FakeSupabaseClient()
        repo = SupabaseEntityTypeCorrectionRepository(client=fake_client)

        await repo.save(
            component_id=_COMPONENT_ID,
            importer_id=_IMPORTER_ID,
            previous_entity_type_id=_PREVIOUS_TYPE_ID,
            corrected_entity_type_id=_CORRECTED_TYPE_ID,
        )

        assert fake_client.inserted_table == "entity_type_corrections"
        assert fake_client.inserted_payload == {
            "importer_id": _IMPORTER_ID,
            "component_id": _COMPONENT_ID,
            "previous_entity_type_id": _PREVIOUS_TYPE_ID,
            "corrected_entity_type_id": _CORRECTED_TYPE_ID,
        }


class TestFindSimilar:
    @pytest.mark.asyncio
    async def test_calls_rpc_with_importer_scope_only(self) -> None:
        fake_client = FakeSupabaseClient(rpc_rows=[])
        repo = SupabaseEntityTypeCorrectionRepository(client=fake_client)

        await repo.find_similar(query_text="MSCU1234567", importer_id=_IMPORTER_ID, top_n=3)

        assert fake_client.rpc_name == "match_entity_type_corrections_by_trgm"
        assert fake_client.rpc_params is not None
        assert fake_client.rpc_params["match_importer_id"] == _IMPORTER_ID
        assert fake_client.rpc_params["query_text"] == "MSCU1234567"
        assert fake_client.rpc_params["match_count"] == 3
        assert "match_entity_type_id" not in fake_client.rpc_params

    @pytest.mark.asyncio
    async def test_maps_rows_to_examples(self) -> None:
        rows = [
            {
                "correction_id": "corr-1",
                "content_text": "MSCU1234567 container",
                "corrected_entity_type_slug": "bill_of_lading",
                "sim": 0.75,
            }
        ]
        fake_client = FakeSupabaseClient(rpc_rows=rows)
        repo = SupabaseEntityTypeCorrectionRepository(client=fake_client)

        results = await repo.find_similar(query_text="MSCU1234567", importer_id=_IMPORTER_ID)

        assert results == [
            EntityTypeCorrectionExample(
                content_text="MSCU1234567 container",
                corrected_entity_type_slug="bill_of_lading",
                score=0.75,
            )
        ]

    @pytest.mark.asyncio
    async def test_returns_empty_on_rpc_failure(self) -> None:
        fake_client = FakeSupabaseClient(raise_on_rpc=True)
        repo = SupabaseEntityTypeCorrectionRepository(client=fake_client)

        results = await repo.find_similar(query_text="anything", importer_id=_IMPORTER_ID)

        assert results == []

    @pytest.mark.asyncio
    async def test_returns_empty_on_no_rows(self) -> None:
        fake_client = FakeSupabaseClient(rpc_rows=[])
        repo = SupabaseEntityTypeCorrectionRepository(client=fake_client)

        results = await repo.find_similar(query_text="anything", importer_id=_IMPORTER_ID)

        assert results == []
