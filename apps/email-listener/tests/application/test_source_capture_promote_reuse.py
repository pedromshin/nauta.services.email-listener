"""Promotion-reuse proof for a captured source edge (Phase 54-03, CLUS-05).

Proves CLUS-05 is satisfied by REUSE, not new machinery: a captured
INFERRED `knowledge_node_edges` row (the EXACT shape `SourceCaptureHandler.
insert_edge` produces, per test_source_capture_dispatch.py's Task 2
coverage) flows through the UNMODIFIED `PromoteEdgeUseCase` and the
UNMODIFIED `KnowledgeEdgeTierPromotionHandler` (confirm_action_dispatch.py)
to EXTRACTED, with provenance retained. This file adds ZERO new production
promotion code -- see the plan's own acceptance criterion
(`git diff --stat .../promote_edge.py` shows no changes).
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.confirm_action_dispatch import KnowledgeEdgeTierPromotionHandler
from app.application.use_cases.promote_edge import EdgeNotFound, EdgeNotPromotable, PromoteEdgeUseCase

_IMPORTER_ID = "importer-1"
_OTHER_IMPORTER_ID = "importer-2"
_CONVERSATION_ID = "conv-1"
_EDGE_ID = "edge-source-capture-1"
_WIDGET_INTERACTION_ID = "wi-1"


def _captured_edge(**overrides: Any) -> dict[str, Any]:
    """The EXACT shape SourceCaptureHandler.insert_edge produces (Task 2), plus find_edge_by_id's
    port-documented importer_id flattening (source_node_id -> knowledge_nodes join)."""
    base: dict[str, Any] = {
        "id": _EDGE_ID,
        "importer_id": _IMPORTER_ID,
        "tier": "INFERRED",
        "is_active": True,
        "source": "web_search_capture",
        "relation_type": "captured_from_web",
        "provenance": {
            "url": "https://example.com/article",
            "title": "An Article",
            "retrieved_at": "2026-07-12T00:00:00+00:00",
            "conversation_id": _CONVERSATION_ID,
            "thread_id": None,
        },
        "promotion": None,
    }
    base.update(overrides)
    return base


class FakeKnowledgeGraphRepository:
    """Holds ONE captured edge row; `promote_edge` is a real CAS simulation (tier-gated write)."""

    def __init__(self, edge: dict[str, Any] | None, *, promote_returns_false: bool = False) -> None:
        self._edges: dict[str, dict[str, Any]] = {edge["id"]: dict(edge)} if edge is not None else {}
        self._promote_returns_false = promote_returns_false
        self.promote_edge_calls: list[dict[str, Any]] = []

    async def find_edge_by_id(self, edge_id: str) -> dict[str, Any] | None:
        edge = self._edges.get(edge_id)
        return dict(edge) if edge is not None else None

    async def promote_edge(self, *, edge_id: str, promotion: dict[str, object]) -> bool:
        self.promote_edge_calls.append({"edge_id": edge_id, "promotion": promotion})
        if self._promote_returns_false:
            return False
        edge = self._edges.get(edge_id)
        if edge is None or not edge.get("is_active") or edge.get("tier") not in ("INFERRED", "AMBIGUOUS"):
            return False
        edge["tier"] = "EXTRACTED"
        edge["promotion"] = promotion
        return True


# ---------------------------------------------------------------------------
# The captured edge promotes through the UNMODIFIED PromoteEdgeUseCase
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_captured_source_edge_promotes_to_extracted_via_promote_edge_use_case() -> None:
    knowledge = FakeKnowledgeGraphRepository(_captured_edge())
    use_case = PromoteEdgeUseCase(knowledge=knowledge)

    result = asyncio.run(use_case.execute(edge_id=_EDGE_ID, importer_id=_IMPORTER_ID))

    assert result == {"edge_id": _EDGE_ID, "tier": "EXTRACTED"}
    promoted = asyncio.run(knowledge.find_edge_by_id(_EDGE_ID))
    assert promoted is not None
    assert promoted["tier"] == "EXTRACTED"
    # Provenance (the original capture record) is untouched by promotion --
    # a DISTINCT `promotion` column records the promote event (T-30-08).
    assert promoted["provenance"] == _captured_edge()["provenance"]
    assert promoted["promotion"]["from_tier"] == "INFERRED"
    assert promoted["promotion"]["mechanism"] == "human_promote"


@pytest.mark.unit
def test_captured_source_edge_promotes_via_knowledge_edge_tier_promotion_handler() -> None:
    """The SAME chat confirm_action dispatch path CLUS-04 reuses for source_capture also
    carries the promotion round-trip -- KnowledgeEdgeTierPromotionHandler is UNCHANGED."""
    knowledge = FakeKnowledgeGraphRepository(_captured_edge())
    promote_edge_use_case = PromoteEdgeUseCase(knowledge=knowledge)
    handler = KnowledgeEdgeTierPromotionHandler(promote_edge=promote_edge_use_case)

    result = asyncio.run(
        handler.execute(
            action="confirm",
            suggestion_id=_EDGE_ID,
            importer_id=_IMPORTER_ID,
            widget_interaction_id=_WIDGET_INTERACTION_ID,
        )
    )

    assert result["status"] == "promoted"
    assert result["edge_id"] == _EDGE_ID
    assert result["tier"] == "EXTRACTED"
    promoted = asyncio.run(knowledge.find_edge_by_id(_EDGE_ID))
    assert promoted is not None
    assert promoted["tier"] == "EXTRACTED"
    assert promoted["promotion"]["mechanism"] == "chat_confirm_action"
    assert promoted["promotion"]["widget_interaction_id"] == _WIDGET_INTERACTION_ID


# ---------------------------------------------------------------------------
# Cross-tenant: neither an unknown edge id nor a mismatched importer promotes
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_foreign_edge_id_raises_edge_not_found_never_writes() -> None:
    knowledge = FakeKnowledgeGraphRepository(_captured_edge())
    use_case = PromoteEdgeUseCase(knowledge=knowledge)

    with pytest.raises(EdgeNotFound):
        asyncio.run(use_case.execute(edge_id="edge-does-not-exist", importer_id=_IMPORTER_ID))

    assert knowledge.promote_edge_calls == []


@pytest.mark.unit
def test_valid_edge_id_with_wrong_importer_id_rejected_as_tenant_mismatch_never_writes() -> None:
    """A captured edge belonging to tenant A cannot be promoted by supplying tenant B's importer_id."""
    knowledge = FakeKnowledgeGraphRepository(_captured_edge(importer_id=_IMPORTER_ID))
    use_case = PromoteEdgeUseCase(knowledge=knowledge)

    with pytest.raises(EdgeNotPromotable) as exc_info:
        asyncio.run(use_case.execute(edge_id=_EDGE_ID, importer_id=_OTHER_IMPORTER_ID))

    assert exc_info.value.reason == "tenant_mismatch"
    assert knowledge.promote_edge_calls == []


@pytest.mark.unit
def test_cross_tenant_promotion_via_user_ownership_guard_also_rejected() -> None:
    """44-03's user-ownership guard (fed by KnowledgeEdgeTierPromotionHandler when user_id is
    supplied) is ALSO unchanged and ALSO rejects a captured edge the acting user doesn't own."""
    knowledge = FakeKnowledgeGraphRepository(_captured_edge())
    importer_repo = AsyncMock()
    importer_repo.list_importer_ids_for_user.return_value = [_OTHER_IMPORTER_ID]
    use_case = PromoteEdgeUseCase(knowledge=knowledge, importers=importer_repo)

    with pytest.raises(EdgeNotPromotable) as exc_info:
        asyncio.run(use_case.execute(edge_id=_EDGE_ID, importer_id=_IMPORTER_ID, user_id="user-not-the-owner"))

    assert exc_info.value.reason == "tenant_mismatch"
    assert knowledge.promote_edge_calls == []


# ---------------------------------------------------------------------------
# Idempotent promote: re-promoting an already-promoted edge never mutates
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_re_promoting_an_already_extracted_edge_is_rejected_not_mutated() -> None:
    """After a first successful promote, a second attempt on the same edge is rejected by the
    tier guard (EXTRACTED is no longer a suggestion tier) -- the promotion record from the FIRST
    promote is left untouched by the second, no-op attempt."""
    knowledge = FakeKnowledgeGraphRepository(_captured_edge())
    use_case = PromoteEdgeUseCase(knowledge=knowledge)

    first = asyncio.run(use_case.execute(edge_id=_EDGE_ID, importer_id=_IMPORTER_ID))
    assert first == {"edge_id": _EDGE_ID, "tier": "EXTRACTED"}
    first_promotion = asyncio.run(knowledge.find_edge_by_id(_EDGE_ID))["promotion"]  # type: ignore[index]

    with pytest.raises(EdgeNotPromotable) as exc_info:
        asyncio.run(use_case.execute(edge_id=_EDGE_ID, importer_id=_IMPORTER_ID))

    assert exc_info.value.reason == "not_promotable"
    second_state = asyncio.run(knowledge.find_edge_by_id(_EDGE_ID))
    assert second_state is not None
    assert second_state["tier"] == "EXTRACTED"
    assert second_state["promotion"] == first_promotion, "the second, rejected attempt must never overwrite it"


@pytest.mark.unit
def test_concurrent_promote_cas_conflict_is_a_no_op_not_a_mutation() -> None:
    """A genuine CAS race (promote_edge's own conditional UPDATE matches zero rows because a
    concurrent promote/dismiss beat this call) is rejected as 'conflict' -- never a silent
    partial/duplicate promotion, and never mutates the stored edge (T-30-06)."""
    knowledge = FakeKnowledgeGraphRepository(_captured_edge(), promote_returns_false=True)
    use_case = PromoteEdgeUseCase(knowledge=knowledge)

    with pytest.raises(EdgeNotPromotable) as exc_info:
        asyncio.run(use_case.execute(edge_id=_EDGE_ID, importer_id=_IMPORTER_ID))

    assert exc_info.value.reason == "conflict"
    assert len(knowledge.promote_edge_calls) == 1, "the CAS write was attempted exactly once"
    unchanged = asyncio.run(knowledge.find_edge_by_id(_EDGE_ID))
    assert unchanged is not None
    assert unchanged["tier"] == "INFERRED", "the fake never mutates the row when its own CAS returns False"
    assert unchanged["promotion"] is None
