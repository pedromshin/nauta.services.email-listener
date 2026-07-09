"""Call-shape tests for SupabaseKnowledgeGraphRepository.

Uses unittest.mock to assert table/op/filter call shapes -- no live DB.
Async methods are tested via asyncio.run() since pytest-asyncio is not available.
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import MagicMock

from app.infrastructure.supabase.knowledge_graph_repository import SupabaseKnowledgeGraphRepository


def _make_chain_mock(return_data: list[dict] | None = None) -> MagicMock:
    """Build a chainable mock for PostgREST-style supabase calls."""
    execute_result = MagicMock()
    execute_result.data = return_data or []
    chain = MagicMock()
    chain.execute.return_value = execute_result
    chain.eq.return_value = chain
    chain.is_.return_value = chain
    chain.upsert.return_value = chain
    chain.insert.return_value = chain
    chain.update.return_value = chain
    chain.select.return_value = chain
    chain.delete.return_value = chain
    chain.in_.return_value = chain
    return chain


def _make_client_mock(return_data: list[dict] | None = None) -> MagicMock:
    """Build a mock supabase Client that chains table().op().execute()."""
    client = MagicMock()
    chain = _make_chain_mock(return_data)
    client.table.return_value = chain
    return client


def _make_rpc_client_mock(rpc_side_effect: Any) -> MagicMock:
    """Build a mock supabase Client where .rpc(name, params).execute() returns per-call data.

    `rpc_side_effect(name, params)` returns a list of row dicts, or raises to
    simulate an RPC failure (search_nodes must catch this and degrade, never
    propagate).
    """
    client = MagicMock()

    def _rpc(name: str, params: dict[str, Any]) -> MagicMock:
        rows = rpc_side_effect(name, params)  # may raise -- intentional, tests degradation
        chain = MagicMock()
        result = MagicMock()
        result.data = rows
        chain.execute.return_value = result
        return chain

    client.rpc.side_effect = _rpc
    return client


PROVENANCE = {
    "component_id": "comp-001",
    "page_index": 0,
    "polygon": [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]],
    "tokens": [{"text": "hello", "bbox": [0.0, 0.0, 0.1, 0.1]}],
}


def test_insert_edge_writes_is_active_true_tier_and_provenance() -> None:
    client = _make_client_mock()
    repo = SupabaseKnowledgeGraphRepository(client)

    asyncio.run(
        repo.insert_edge(
            source_node_id="node-001",
            target_ref_id="entity-001",
            target_ref_type="entity_instance",
            relation_type="describes",
            tier="EXTRACTED",
            source="learned_from_correction",
            provenance=PROVENANCE,
        )
    )

    client.table.assert_called_with("knowledge_node_edges")
    chain = client.table.return_value
    assert chain.insert.called, "insert_edge must call insert"
    payload = chain.insert.call_args.args[0]
    assert payload["is_active"] is True
    assert payload["tier"] == "EXTRACTED"
    assert payload["source_node_id"] == "node-001"
    provenance = payload["provenance"]
    assert set(provenance.keys()) >= {"component_id", "page_index", "polygon", "tokens"}
    assert provenance["component_id"] == "comp-001"


def test_deactivate_edges_for_node_updates_never_deletes() -> None:
    client = _make_client_mock()
    repo = SupabaseKnowledgeGraphRepository(client)

    asyncio.run(repo.deactivate_edges_for_node("node-001"))

    client.table.assert_called_with("knowledge_node_edges")
    chain = client.table.return_value
    assert chain.update.called, "deactivate_edges_for_node must call update"
    payload = chain.update.call_args.args[0]
    assert payload == {"is_active": False}
    eq_calls = [str(c) for c in chain.eq.call_args_list]
    combined = " ".join(eq_calls)
    assert "source_node_id" in combined, f"source_node_id filter missing: {eq_calls}"
    assert "is_active" in combined, f"is_active filter missing: {eq_calls}"
    assert not chain.delete.called, "deactivate must never call delete (audit trail)"


def test_find_active_edges_for_node_filters_source_and_active() -> None:
    client = _make_client_mock(
        return_data=[
            {
                "id": "edge-001",
                "source_node_id": "node-001",
                "target_ref_id": "entity-001",
                "target_ref_type": "entity_instance",
                "relation_type": "describes",
                "tier": "EXTRACTED",
                "source": "learned_from_correction",
                "provenance": PROVENANCE,
                "is_active": True,
            }
        ]
    )
    repo = SupabaseKnowledgeGraphRepository(client)

    result = asyncio.run(repo.find_active_edges_for_node("node-001"))

    client.table.assert_called_with("knowledge_node_edges")
    chain = client.table.return_value
    eq_calls = [str(c) for c in chain.eq.call_args_list]
    combined = " ".join(eq_calls)
    assert "source_node_id" in combined
    assert "is_active" in combined
    assert len(result) == 1
    assert result[0]["id"] == "edge-001"


def test_upsert_node_inserts_when_no_active_node_found() -> None:
    """find_active_node returns [] first (select) then insert returns a row."""
    client = MagicMock()
    select_chain = _make_chain_mock(return_data=[])
    insert_chain = _make_chain_mock(return_data=[{"id": "node-new"}])

    def _table_side_effect(name: str) -> MagicMock:
        return select_chain

    client.table.side_effect = None
    client.table.return_value = select_chain
    # select() path returns select_chain; insert() path also comes off the same
    # table() call in this repo's implementation, so make insert() on the
    # select_chain itself return a chain with the insert-result execute().
    select_chain.insert.return_value = insert_chain

    repo = SupabaseKnowledgeGraphRepository(client)
    node_id = asyncio.run(
        repo.upsert_node(
            importer_id="imp-abc",
            title="Acme Corp",
            content="Acme Corp is a shipper.",
            scope="entity_instance",
            scope_ref_id="entity-001",
            scope_ref_type="entity_instance",
            source="learned_from_correction",
            tier="EXTRACTED",
        )
    )

    assert node_id == "node-new"
    assert select_chain.insert.called, "upsert_node must insert when no active node exists"


class _FilterableTableDouble:
    """A supabase table() double that honors .eq()/.in_() filters over an in-memory row list.

    Mirrors real PostgREST filter semantics closely enough to prove the
    three-tier exclusion invariant without a live DB.
    """

    def __init__(self, rows: list[dict[str, object]]) -> None:
        self._rows = rows
        self._filters: list[tuple[str, object]] = []
        self._in_filters: list[tuple[str, list[object]]] = []

    def select(self, _columns: str) -> _FilterableTableDouble:
        return self

    def eq(self, column: str, value: object) -> _FilterableTableDouble:
        self._filters.append((column, value))
        return self

    def in_(self, column: str, values: list[object]) -> _FilterableTableDouble:
        self._in_filters.append((column, values))
        return self

    def execute(self) -> MagicMock:
        matched = [
            row
            for row in self._rows
            if all(row.get(col) == val for col, val in self._filters)
            and all(row.get(col) in vals for col, vals in self._in_filters)
        ]
        result = MagicMock()
        result.data = matched
        return result


def test_list_injectable_edges_excludes_suggestion_tiers() -> None:
    """SC2 (ROADMAP): seeded three-tier exclusion -- only active EXTRACTED comes back."""
    nodes = [{"id": "node-001", "importer_id": "imp-abc"}]
    edges = [
        {
            "id": "edge-extracted-active",
            "source_node_id": "node-001",
            "tier": "EXTRACTED",
            "is_active": True,
        },
        {
            "id": "edge-inferred-active",
            "source_node_id": "node-001",
            "tier": "INFERRED",
            "is_active": True,
        },
        {
            "id": "edge-ambiguous-active",
            "source_node_id": "node-001",
            "tier": "AMBIGUOUS",
            "is_active": True,
        },
        {
            "id": "edge-extracted-inactive",
            "source_node_id": "node-001",
            "tier": "EXTRACTED",
            "is_active": False,
        },
    ]

    tables = {
        "knowledge_nodes": _FilterableTableDouble(nodes),
        "knowledge_node_edges": _FilterableTableDouble(edges),
    }
    client = MagicMock()
    client.table.side_effect = lambda name: tables[name]

    repo = SupabaseKnowledgeGraphRepository(client)
    result = asyncio.run(repo.list_injectable_edges("imp-abc"))

    assert [row["id"] for row in result] == ["edge-extracted-active"]


def test_upsert_node_updates_existing_active_node() -> None:
    """find_active_node returns an existing row -> upsert_node updates it in place."""
    client = MagicMock()
    select_chain = _make_chain_mock(return_data=[{"id": "node-existing"}])
    client.table.return_value = select_chain

    repo = SupabaseKnowledgeGraphRepository(client)
    node_id = asyncio.run(
        repo.upsert_node(
            importer_id="imp-abc",
            title="Acme Corp",
            content="Acme Corp is a shipper.",
            scope="entity_instance",
            scope_ref_id="entity-001",
            scope_ref_type="entity_instance",
            source="learned_from_correction",
            tier="EXTRACTED",
        )
    )

    assert node_id == "node-existing"
    assert select_chain.update.called, "upsert_node must update the existing active node"
    update_payload = select_chain.update.call_args.args[0]
    assert update_payload["title"] == "Acme Corp"
    assert not select_chain.insert.called, "must not insert a duplicate when a node was reused"


def test_find_edge_by_id_flattens_owning_importer_id() -> None:
    client = _make_client_mock(
        return_data=[
            {
                "id": "edge-001",
                "source_node_id": "node-001",
                "tier": "INFERRED",
                "is_active": True,
                "knowledge_nodes": {"importer_id": "imp-abc"},
            }
        ]
    )
    repo = SupabaseKnowledgeGraphRepository(client)

    result = asyncio.run(repo.find_edge_by_id("edge-001"))

    client.table.assert_called_with("knowledge_node_edges")
    chain = client.table.return_value
    select_args = chain.select.call_args.args[0]
    assert "knowledge_nodes" in select_args
    assert result is not None
    assert result["importer_id"] == "imp-abc"
    assert result["tier"] == "INFERRED"
    assert "knowledge_nodes" not in result


def test_find_edge_by_id_returns_none_when_missing() -> None:
    client = _make_client_mock(return_data=[])
    repo = SupabaseKnowledgeGraphRepository(client)

    result = asyncio.run(repo.find_edge_by_id("missing-edge"))

    assert result is None


def test_promote_edge_writes_tier_and_promotion_filtered_by_cas() -> None:
    client = _make_client_mock(return_data=[{"id": "edge-001", "tier": "EXTRACTED"}])
    repo = SupabaseKnowledgeGraphRepository(client)

    promotion = {"promoted_at": "2026-07-07T00:00:00+00:00", "from_tier": "INFERRED", "mechanism": "human_promote"}
    updated = asyncio.run(repo.promote_edge(edge_id="edge-001", promotion=promotion))

    assert updated is True
    client.table.assert_called_with("knowledge_node_edges")
    chain = client.table.return_value
    assert chain.update.called, "promote_edge must call update"
    assert not chain.delete.called, "promote_edge must never call delete"
    payload = chain.update.call_args.args[0]
    assert payload["tier"] == "EXTRACTED"
    assert payload["promotion"] == promotion

    eq_calls = [str(c) for c in chain.eq.call_args_list]
    combined = " ".join(eq_calls)
    assert "id" in combined
    assert "is_active" in combined
    in_calls = [str(c) for c in chain.in_.call_args_list]
    assert any("tier" in c and "INFERRED" in c and "AMBIGUOUS" in c for c in in_calls), (
        f"tier CAS filter missing: {in_calls}"
    )


def test_promote_edge_returns_false_when_cas_matches_no_row() -> None:
    """Concurrent promote/dismiss already changed the row -- no update applied (T-30-06)."""
    client = _make_client_mock(return_data=[])
    repo = SupabaseKnowledgeGraphRepository(client)

    updated = asyncio.run(
        repo.promote_edge(
            edge_id="edge-001",
            promotion={"promoted_at": "2026-07-07T00:00:00+00:00", "from_tier": "INFERRED", "mechanism": "human_promote"},
        )
    )

    assert updated is False


# ---------------------------------------------------------------------------
# search_nodes (Phase 37-01, Task 2) -- BlendedRAG over the extracted_only view
# ---------------------------------------------------------------------------

_VECTOR_RPC = "match_knowledge_nodes_by_embedding"
_TRGM_RPC = "match_knowledge_nodes_by_trgm"


def _node_row(node_id: str, *, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "id": node_id,
        "title": f"Title {node_id}",
        "content": f"Content {node_id}",
        "scope": "importer_global",
        "scope_ref_id": None,
        "tier": "EXTRACTED",
        "confidence": 1.0,
        **(extra or {}),
    }


def test_search_nodes_merges_vector_and_trgm_via_rrf_deduped_and_capped() -> None:
    vector_rows = [_node_row("node-1", extra={"distance": 0.1}), _node_row("node-2", extra={"distance": 0.2})]
    trgm_rows = [_node_row("node-2", extra={"sim": 0.9}), _node_row("node-3", extra={"sim": 0.5})]

    def _rpc_side_effect(name: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        if name == _VECTOR_RPC:
            assert params["query_embedding"] == [0.1, 0.2]
            assert params["match_importer_id"] == "imp-abc"
            return vector_rows
        if name == _TRGM_RPC:
            assert params["query_text"] == "acme"
            assert params["match_importer_id"] == "imp-abc"
            return trgm_rows
        raise AssertionError(f"unexpected rpc name: {name}")

    client = _make_rpc_client_mock(_rpc_side_effect)
    repo = SupabaseKnowledgeGraphRepository(client)

    result = asyncio.run(
        repo.search_nodes(query_text="acme", query_embedding=[0.1, 0.2], importer_id="imp-abc", limit=8)
    )

    ids = [row["id"] for row in result]
    assert set(ids) == {"node-1", "node-2", "node-3"}
    assert len(ids) == len(set(ids)), "results must be deduped by id"

    rpc_names = [call.args[0] for call in client.rpc.call_args_list]
    assert _VECTOR_RPC in rpc_names
    assert _TRGM_RPC in rpc_names


def test_search_nodes_skips_vector_arm_when_embedding_none() -> None:
    trgm_rows = [_node_row("node-1", extra={"sim": 0.9})]

    def _rpc_side_effect(name: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        if name == _TRGM_RPC:
            return trgm_rows
        raise AssertionError(f"vector RPC must never be called when embedding is None, got: {name}")

    client = _make_rpc_client_mock(_rpc_side_effect)
    repo = SupabaseKnowledgeGraphRepository(client)

    result = asyncio.run(repo.search_nodes(query_text="acme", query_embedding=None, importer_id="imp-abc"))

    rpc_names = [call.args[0] for call in client.rpc.call_args_list]
    assert _VECTOR_RPC not in rpc_names
    assert [row["id"] for row in result] == ["node-1"]


def test_search_nodes_vector_failure_degrades_to_trgm_only() -> None:
    trgm_rows = [_node_row("node-1", extra={"sim": 0.9})]

    def _rpc_side_effect(name: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        if name == _VECTOR_RPC:
            raise RuntimeError("vector RPC boom")
        if name == _TRGM_RPC:
            return trgm_rows
        raise AssertionError(f"unexpected rpc name: {name}")

    client = _make_rpc_client_mock(_rpc_side_effect)
    repo = SupabaseKnowledgeGraphRepository(client)

    result = asyncio.run(
        repo.search_nodes(query_text="acme", query_embedding=[0.1], importer_id="imp-abc")
    )

    assert [row["id"] for row in result] == ["node-1"]


def test_search_nodes_trgm_failure_degrades_to_vector_only() -> None:
    vector_rows = [_node_row("node-1", extra={"distance": 0.1})]

    def _rpc_side_effect(name: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        if name == _VECTOR_RPC:
            return vector_rows
        if name == _TRGM_RPC:
            raise RuntimeError("trgm RPC boom")
        raise AssertionError(f"unexpected rpc name: {name}")

    client = _make_rpc_client_mock(_rpc_side_effect)
    repo = SupabaseKnowledgeGraphRepository(client)

    result = asyncio.run(
        repo.search_nodes(query_text="acme", query_embedding=[0.1], importer_id="imp-abc")
    )

    assert [row["id"] for row in result] == ["node-1"]


def test_search_nodes_both_arms_empty_returns_empty_list() -> None:
    def _rpc_side_effect(name: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        return []

    client = _make_rpc_client_mock(_rpc_side_effect)
    repo = SupabaseKnowledgeGraphRepository(client)

    result = asyncio.run(
        repo.search_nodes(query_text="acme", query_embedding=[0.1], importer_id="imp-abc")
    )

    assert result == []


def test_search_nodes_scopes_every_rpc_call_to_importer_id() -> None:
    def _rpc_side_effect(name: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        return []

    client = _make_rpc_client_mock(_rpc_side_effect)
    repo = SupabaseKnowledgeGraphRepository(client)

    asyncio.run(repo.search_nodes(query_text="acme", query_embedding=[0.1], importer_id="imp-xyz"))

    assert client.rpc.call_args_list, "expected at least one .rpc() call"
    for call in client.rpc.call_args_list:
        params = call.args[1]
        assert params["match_importer_id"] == "imp-xyz"


def test_search_nodes_respects_limit_keeping_highest_rrf_scored_rows() -> None:
    vector_rows = [_node_row(f"v-{i}", extra={"distance": float(i)}) for i in range(10)]
    trgm_rows = [_node_row(f"t-{i}", extra={"sim": 1.0 - float(i) / 10}) for i in range(10)]

    def _rpc_side_effect(name: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        if name == _VECTOR_RPC:
            return vector_rows
        if name == _TRGM_RPC:
            return trgm_rows
        raise AssertionError(f"unexpected rpc name: {name}")

    client = _make_rpc_client_mock(_rpc_side_effect)
    repo = SupabaseKnowledgeGraphRepository(client)

    result = asyncio.run(
        repo.search_nodes(query_text="acme", query_embedding=[0.1], importer_id="imp-abc", limit=5)
    )

    assert len(result) == 5
    ids = {row["id"] for row in result}
    # The lowest-ranked (highest-index, lowest-RRF-score) candidates from each
    # arm must be excluded -- only the top-ranked rows survive the cap.
    assert "v-9" not in ids
    assert "t-9" not in ids
    assert "v-0" in ids
    assert "t-0" in ids
