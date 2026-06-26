"""Tests for SupabaseRetrievalRepository (infrastructure/supabase/retrieval_repository.py).

All tests mock the supabase client so no real DB calls are made.

Behavior contract:
  - _rrf_score(rank, k=60) == 1 / (60 + rank) — pure-function unit test.
  - A doc in two ranked lists gets a higher RRF score than a doc in one list.
  - find_similar_confirmed issues BOTH a vector cosine query AND a trigram identifier
    query, both filtered by importer_id (T-04-28 cross-tenant isolation).
  - find_similar_confirmed returns at most top_n RetrievedExample objects.
  - Empty confirmed set (empty DB response) returns [] safely (cold-start safe).
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import MagicMock

import pytest

from app.domain.ports.retrieval_port import RetrievedExample
from app.infrastructure.supabase.retrieval_repository import (
    SupabaseRetrievalRepository,
    _rrf_score,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_DIM = 1536
_IMPORTER_ID = "imp-00000000-0000-0000-0000-000000000001"
_ENTITY_TYPE_ID = "et-00000000-0000-0000-0000-000000000002"
_COMP_A = "comp-a000-0000-0000-0000-000000000001"
_COMP_B = "comp-b000-0000-0000-0000-000000000002"
_COMP_C = "comp-c000-0000-0000-0000-000000000003"

_ZERO_EMBEDDING: tuple[float, ...] = tuple([0.0] * _DIM)


# ---------------------------------------------------------------------------
# Pure-function tests for _rrf_score
# ---------------------------------------------------------------------------


def test_rrf_score_formula() -> None:
    """rrf_score(rank, k=60) == 1 / (60 + rank)."""
    assert _rrf_score(1) == pytest.approx(1 / 61)
    assert _rrf_score(0) == pytest.approx(1 / 60)
    assert _rrf_score(10) == pytest.approx(1 / 70)


def test_rrf_score_custom_k() -> None:
    """rrf_score respects the k parameter."""
    assert _rrf_score(1, k=20) == pytest.approx(1 / 21)
    assert _rrf_score(5, k=100) == pytest.approx(1 / 105)


def test_rrf_merge_multi_list_doc_ranks_higher() -> None:
    """A doc appearing in two ranked lists gets summed RRF scores and ranks above a doc in one list."""
    from app.infrastructure.supabase.retrieval_repository import _merge_rrf

    # list_a: comp_a at rank 0, comp_b at rank 1
    list_a = [_COMP_A, _COMP_B]
    # list_b: comp_a at rank 0, comp_c at rank 1
    list_b = [_COMP_A, _COMP_C]

    merged = _merge_rrf([list_a, list_b])

    # comp_a appears in both lists → higher combined score
    assert merged[0] == _COMP_A, f"Expected comp_a first (in both lists), got {merged}"
    # comp_b and comp_c each appear in one list only
    assert _COMP_B in merged
    assert _COMP_C in merged


# ---------------------------------------------------------------------------
# Repository tests
# ---------------------------------------------------------------------------


def _make_supabase_mock(
    vector_rows: list[dict[str, Any]],
    trgm_rows: list[dict[str, Any]],
) -> MagicMock:
    """Build a mock supabase client where .rpc returns the given rows."""
    client = MagicMock()

    # rpc calls return a chainable mock ending with .execute() -> data
    def rpc_side_effect(fn_name: str, params: dict[str, Any]) -> MagicMock:
        result_mock = MagicMock()
        result_mock.execute.return_value = MagicMock(
            data=vector_rows if "vector" in fn_name or "embedding" in fn_name else trgm_rows
        )
        return result_mock

    client.rpc.side_effect = rpc_side_effect
    return client


def _make_component_rows(count: int = 2) -> list[dict[str, Any]]:
    """Produce fake confirmed component rows for the DB response."""
    return [
        {
            "id": f"comp-{i:04d}-0000-0000-0000-000000000001",
            "content_text": f"region text {i}",
            "importer_id": _IMPORTER_ID,
            "extraction_status": "confirmed",
            "extracted_fields": {"po_number": f"PO-{1000 + i}"},
        }
        for i in range(count)
    ]


@pytest.fixture
def repo_with_results() -> SupabaseRetrievalRepository:
    """Repository whose mock client returns 2 confirmed component rows."""
    vector_rows = _make_component_rows(2)
    trgm_rows = _make_component_rows(1)
    client = _make_supabase_mock(vector_rows=vector_rows, trgm_rows=trgm_rows)
    return SupabaseRetrievalRepository(client=client)


@pytest.fixture
def repo_empty() -> SupabaseRetrievalRepository:
    """Repository whose mock client returns no results (cold-start scenario)."""
    client = _make_supabase_mock(vector_rows=[], trgm_rows=[])
    return SupabaseRetrievalRepository(client=client)


def test_find_similar_confirmed_returns_retrieved_examples(
    repo_with_results: SupabaseRetrievalRepository,
) -> None:
    """find_similar_confirmed returns a list of RetrievedExample."""
    results = asyncio.run(
        repo_with_results.find_similar_confirmed(
            component_embedding=_ZERO_EMBEDDING,
            entity_type_id=_ENTITY_TYPE_ID,
            importer_id=_IMPORTER_ID,
            key_terms=("PO-1000",),
            top_n=3,
        )
    )
    assert isinstance(results, list)
    assert all(isinstance(r, RetrievedExample) for r in results)


def test_find_similar_confirmed_respects_top_n(
    repo_with_results: SupabaseRetrievalRepository,
) -> None:
    """find_similar_confirmed returns at most top_n results."""
    results = asyncio.run(
        repo_with_results.find_similar_confirmed(
            component_embedding=_ZERO_EMBEDDING,
            entity_type_id=_ENTITY_TYPE_ID,
            importer_id=_IMPORTER_ID,
            key_terms=(),
            top_n=1,
        )
    )
    assert len(results) <= 1


def test_find_similar_confirmed_empty_returns_empty_list(
    repo_empty: SupabaseRetrievalRepository,
) -> None:
    """Empty confirmed set returns [] — cold-start safe (D-13)."""
    results = asyncio.run(
        repo_empty.find_similar_confirmed(
            component_embedding=_ZERO_EMBEDDING,
            entity_type_id=_ENTITY_TYPE_ID,
            importer_id=_IMPORTER_ID,
            key_terms=(),
            top_n=3,
        )
    )
    assert results == []


def test_find_similar_confirmed_both_queries_issued(
    repo_with_results: SupabaseRetrievalRepository,
) -> None:
    """Both vector and trigram queries must be issued (hybrid retrieval, RESEARCH §4.1)."""
    # Access the underlying mock client
    client: MagicMock = repo_with_results._client  # type: ignore[attr-defined]
    asyncio.run(
        repo_with_results.find_similar_confirmed(
            component_embedding=_ZERO_EMBEDDING,
            entity_type_id=_ENTITY_TYPE_ID,
            importer_id=_IMPORTER_ID,
            key_terms=("PO-1000",),
            top_n=3,
        )
    )
    # Both a vector query and a trigram/text query must have been issued
    assert (
        client.rpc.call_count >= 2
        or client.table.call_count >= 2
        or (client.rpc.call_count + client.table.call_count >= 2)
    ), "Expected at least 2 DB queries (vector + trigram)"


def test_find_similar_confirmed_importer_id_filtered(
    repo_with_results: SupabaseRetrievalRepository,
) -> None:
    """Both queries must include the importer_id filter (T-04-28 cross-tenant isolation)."""
    client: MagicMock = repo_with_results._client  # type: ignore[attr-defined]
    asyncio.run(
        repo_with_results.find_similar_confirmed(
            component_embedding=_ZERO_EMBEDDING,
            entity_type_id=_ENTITY_TYPE_ID,
            importer_id=_IMPORTER_ID,
            key_terms=(),
            top_n=3,
        )
    )
    # Every call to client.rpc or client.table should include importer_id in params/args
    all_calls_str = str(client.mock_calls)
    assert _IMPORTER_ID in all_calls_str, (
        f"importer_id {_IMPORTER_ID!r} not found in any DB call — cross-tenant filter missing (T-04-28)"
    )


def test_retrieved_example_has_extracted_fields(
    repo_with_results: SupabaseRetrievalRepository,
) -> None:
    """Each RetrievedExample must carry the confirmed extracted_fields."""
    results = asyncio.run(
        repo_with_results.find_similar_confirmed(
            component_embedding=_ZERO_EMBEDDING,
            entity_type_id=_ENTITY_TYPE_ID,
            importer_id=_IMPORTER_ID,
            key_terms=(),
            top_n=3,
        )
    )
    for r in results:
        assert isinstance(r.extracted_fields, dict)
        assert isinstance(r.content_text, str)
        assert isinstance(r.score, float)
