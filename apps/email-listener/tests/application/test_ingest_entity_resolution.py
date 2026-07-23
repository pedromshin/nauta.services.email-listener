"""Behavioural tests for ResolveIngestEntitiesUseCase (AI-03).

Ingest-time entity resolution: resolve the email's classified entity regions
against the identity corpus and propose, at the SUGGESTION tier only:
  1. pending component_entity_candidate_links (was_selected=False) — the EN-02
     human review queue's provenance rows;
  2. suggested-tier (AMBIGUOUS) knowledge edges from a deterministic per-sender
     node to each resolved candidate.

Everything here is suggest-only + idempotent under reprocess. These tests use
in-memory fakes for the four domain ports (no infrastructure).
"""

from __future__ import annotations

import asyncio
import uuid

from app.application.use_cases.resolve_ingest_entities import (
    ResolveIngestEntitiesUseCase,
    _component_instance_id,
    _sender_scope_ref_id,
)
from app.domain.entities.component import Component
from app.domain.ports.entity_resolution_repository import EntityCandidate

IMPORTER_ID = "imp-1"
EMAIL_ID = "email-1"
SENDER_ADDRESS = "maria@exporter.com"
SENDER_NAME = "Maria Exporter"
SUPPLIER_TYPE_ID = "type-supplier"


# ---------------------------------------------------------------------------
# In-memory fakes
# ---------------------------------------------------------------------------


class FakeComponents:
    def __init__(self, components: list[Component]) -> None:
        self._components = components

    async def find_by_email_id(self, email_id: str) -> list[Component]:
        return list(self._components)


class FakeEntityInstances:
    """Records candidate links, upserting on (component_id, entity_instance_id)."""

    def __init__(self, *, fail_on: tuple[str, str] | None = None) -> None:
        # (component_id, entity_instance_id) -> row dict (upsert = last write wins)
        self.links: dict[tuple[str, str], dict[str, object]] = {}
        self.call_count = 0
        self._fail_on = fail_on

    async def record_candidate_link(
        self,
        component_id: str,
        entity_instance_id: str,
        entity_type_id: str,
        match_type: str,
        similarity_score: float,
        was_selected: bool = False,
    ) -> None:
        self.call_count += 1
        if self._fail_on == (component_id, entity_instance_id):
            raise RuntimeError("candidate link write boom")
        self.links[(component_id, entity_instance_id)] = {
            "entity_type_id": entity_type_id,
            "match_type": match_type,
            "similarity_score": similarity_score,
            "was_selected": was_selected,
        }


class FakeResolution:
    def __init__(self, candidates: list[EntityCandidate]) -> None:
        self._candidates = candidates
        self.calls: list[dict[str, object]] = []

    def find_candidates(
        self,
        *,
        display_name: str,
        identifiers: dict[str, object],
        entity_type_id: str,
        importer_id: str,
        embedding: list[float] | None,
        top_n: int = 5,
        subject_entity_instance_id: str | None = None,
    ) -> list[EntityCandidate]:
        self.calls.append(
            {
                "display_name": display_name,
                "entity_type_id": entity_type_id,
                "importer_id": importer_id,
                "embedding": embedding,
            }
        )
        return list(self._candidates)


class FakeKnowledge:
    """Deterministic-node knowledge fake: upsert reuses a node per scope_ref_id."""

    def __init__(self) -> None:
        self.nodes: dict[tuple[str, str, str | None], str] = {}
        self.upsert_calls: list[dict[str, object]] = []
        self.edges: list[dict[str, object]] = []
        self.deactivations: list[str] = []

    async def find_active_node(
        self, importer_id: str, scope: str, scope_ref_id: str | None
    ) -> dict[str, object] | None:
        node_id = self.nodes.get((importer_id, scope, scope_ref_id))
        return {"id": node_id} if node_id is not None else None

    async def upsert_node(
        self,
        *,
        importer_id: str,
        title: str,
        content: str | None,
        scope: str,
        scope_ref_id: str | None,
        scope_ref_type: str | None,
        source: str,
        tier: str,
        embedding: list[float] | None = None,
    ) -> str:
        self.upsert_calls.append(
            {
                "importer_id": importer_id,
                "title": title,
                "scope": scope,
                "scope_ref_id": scope_ref_id,
                "scope_ref_type": scope_ref_type,
                "source": source,
                "tier": tier,
            }
        )
        key = (importer_id, scope, scope_ref_id)
        node_id = self.nodes.get(key)
        if node_id is None:
            node_id = str(uuid.uuid4())
            self.nodes[key] = node_id
        return node_id

    async def deactivate_edges_for_node(self, source_node_id: str) -> None:
        self.deactivations.append(source_node_id)
        # Supersede-never-delete: mark prior edges inactive so a re-derive nets
        # exactly one fresh suggestion set.
        for edge in self.edges:
            if edge["source_node_id"] == source_node_id:
                edge["is_active"] = False

    async def insert_edge(
        self,
        *,
        source_node_id: str,
        target_ref_id: str | None,
        target_ref_type: str | None,
        relation_type: str,
        tier: str,
        source: str,
        provenance: dict[str, object] | None,
    ) -> None:
        self.edges.append(
            {
                "source_node_id": source_node_id,
                "target_ref_id": target_ref_id,
                "target_ref_type": target_ref_type,
                "relation_type": relation_type,
                "tier": tier,
                "source": source,
                "is_active": True,
            }
        )

    async def find_active_edges_for_node(self, source_node_id: str) -> list[dict[str, object]]:
        return [e for e in self.edges if e["source_node_id"] == source_node_id and e["is_active"]]

    def active_edges(self) -> list[dict[str, object]]:
        return [e for e in self.edges if e["is_active"]]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _entity_component(
    component_id: str = "comp-1",
    *,
    entity_type_id: str | None = SUPPLIER_TYPE_ID,
    role: str | None = "entity",
    content_text: str = "Exporter S.A.",
    embedding: tuple[float, ...] | None = None,
) -> Component:
    return Component(
        id=component_id,
        email_id=EMAIL_ID,
        importer_id=IMPORTER_ID,
        attachment_id="att-1",
        parent_component_id="page-1",
        source_type="region",
        location={"page_index": 0, "polygon": []},
        content_text=content_text,
        content_markdown=None,
        content_raw=None,
        embedding=embedding,
        sequence_index=0,
        extraction_status="candidate",
        role=role,
        entity_type_id=entity_type_id,
    )


def _candidate(entity_instance_id: str = "inst-existing", score: float = 0.75) -> EntityCandidate:
    return EntityCandidate(
        entity_instance_id=entity_instance_id,
        display_name="Exporter SA",
        rrf_score=score,
        match_type="semantic",
        similarity_score=score,
    )


def _make(
    components: list[Component],
    candidates: list[EntityCandidate],
    *,
    entity_instances: FakeEntityInstances | None = None,
    knowledge: FakeKnowledge | None = None,
    resolution: FakeResolution | None = None,
) -> tuple[ResolveIngestEntitiesUseCase, dict[str, object]]:
    ei = entity_instances or FakeEntityInstances()
    kg = knowledge or FakeKnowledge()
    res = resolution or FakeResolution(candidates)
    uc = ResolveIngestEntitiesUseCase(
        components=FakeComponents(components),
        entity_instances=ei,  # type: ignore[arg-type]
        resolution_repo=res,  # type: ignore[arg-type]
        knowledge=kg,  # type: ignore[arg-type]
    )
    return uc, {"entity_instances": ei, "knowledge": kg, "resolution": res}


def _run(uc: ResolveIngestEntitiesUseCase) -> dict[str, int]:
    return asyncio.run(
        uc.execute(
            email_id=EMAIL_ID,
            importer_id=IMPORTER_ID,
            sender_address=SENDER_ADDRESS,
            sender_name=SENDER_NAME,
        )
    )


# ---------------------------------------------------------------------------
# (1)/(5) A resolvable entity produces a PENDING (suggested) candidate link
# ---------------------------------------------------------------------------


def test_resolvable_entity_produces_pending_candidate_link() -> None:
    uc, mocks = _make([_entity_component()], [_candidate("inst-existing")])
    summary = _run(uc)

    ei: FakeEntityInstances = mocks["entity_instances"]  # type: ignore[assignment]
    assert summary["candidate_links"] == 1
    row = ei.links[("comp-1", "inst-existing")]
    # PENDING: was_selected=False is the human-gate signal (EN-02 queue reads it).
    assert row["was_selected"] is False
    assert row["entity_type_id"] == SUPPLIER_TYPE_ID
    assert row["match_type"] == "semantic"
    assert row["similarity_score"] == 0.75


# ---------------------------------------------------------------------------
# (2) A resolvable entity produces a SUGGESTED-tier knowledge edge
# ---------------------------------------------------------------------------


def test_resolution_produces_suggested_tier_edge_from_sender_node() -> None:
    uc, mocks = _make([_entity_component()], [_candidate("inst-existing")])
    summary = _run(uc)

    kg: FakeKnowledge = mocks["knowledge"]  # type: ignore[assignment]
    assert summary["suggested_edges"] == 1
    edge = kg.active_edges()[0]
    # SUGGESTED tier only — never EXTRACTED (nothing lands as canon).
    assert edge["tier"] == "AMBIGUOUS"
    assert edge["source"] == "ingest_resolution"
    assert edge["target_ref_id"] == "inst-existing"
    assert edge["target_ref_type"] == "entity_instance"
    assert edge["relation_type"] == "possibly_about"
    # The edge originates from the deterministic sender node.
    sender_ref = _sender_scope_ref_id(IMPORTER_ID, SENDER_ADDRESS)
    sender_node_id = kg.nodes[(IMPORTER_ID, "sender", sender_ref)]
    assert edge["source_node_id"] == sender_node_id


def test_sender_node_is_deterministic_and_suggestion_tier() -> None:
    uc, mocks = _make([_entity_component()], [_candidate()])
    _run(uc)

    kg: FakeKnowledge = mocks["knowledge"]  # type: ignore[assignment]
    upsert = kg.upsert_calls[0]
    assert upsert["scope"] == "sender"
    assert upsert["scope_ref_type"] == "sender_profile"
    assert upsert["scope_ref_id"] == _sender_scope_ref_id(IMPORTER_ID, SENDER_ADDRESS)
    assert upsert["tier"] == "INFERRED"  # a synthesis-derived node, never EXTRACTED
    assert upsert["title"] == SENDER_NAME


def test_sender_scope_ref_id_normalizes_address_case() -> None:
    # Same sender, different casing/whitespace -> same deterministic node key.
    assert _sender_scope_ref_id(IMPORTER_ID, "Maria@Exporter.com") == _sender_scope_ref_id(
        IMPORTER_ID, "  maria@exporter.com "
    )


# ---------------------------------------------------------------------------
# (3) Idempotent under reprocess — no duplicate suggested links
# ---------------------------------------------------------------------------


def test_reprocess_is_idempotent_no_duplicate_links() -> None:
    components = [_entity_component()]
    candidates = [_candidate("inst-existing")]
    ei = FakeEntityInstances()
    kg = FakeKnowledge()

    uc1, _ = _make(components, candidates, entity_instances=ei, knowledge=kg)
    _run(uc1)
    # Second ingest (reprocess) over the SAME components + sender.
    uc2, _ = _make(components, candidates, entity_instances=ei, knowledge=kg)
    _run(uc2)

    # Candidate links: upsert on (component_id, entity_instance_id) — exactly one
    # distinct row despite two runs (no stacking).
    assert len(ei.links) == 1
    assert ei.call_count == 2  # both runs wrote, but to the SAME key

    # Sender edges: the second run is idempotent by insert-if-ABSENT (it pre-seeds
    # its skip set from the node's already-active edges), so exactly ONE active
    # suggested edge remains — never two — WITHOUT any deactivation.
    assert not kg.deactivations, "the corrected stage must never deactivate sender edges"
    assert len(kg.active_edges()) == 1
    # The sender node itself was reused, not duplicated.
    assert len(kg.nodes) == 1


def test_reprocess_never_deactivates_a_promoted_canon_edge() -> None:
    """Regression for the refuting defect: a human-promoted EXTRACTED edge on the
    shared sender node must survive the sender's next inbound email untouched."""
    components = [_entity_component()]
    candidates = [_candidate("inst-existing")]
    ei = FakeEntityInstances()
    kg = FakeKnowledge()

    # First email creates the sender node + a suggested edge.
    uc1, _ = _make(components, candidates, entity_instances=ei, knowledge=kg)
    _run(uc1)
    (sender_node_id,) = list(kg.nodes.values())
    # Human promotes that suggestion to canon (tier flips in place; stays active).
    for edge in kg.edges:
        if edge["source_node_id"] == sender_node_id:
            edge["tier"] = "EXTRACTED"
    canon_target = next(e["target_ref_id"] for e in kg.edges if edge["tier"] == "EXTRACTED")

    # A LATER email from the same sender resolves to a DIFFERENT entity.
    uc2, _ = _make([_entity_component()], [_candidate("inst-other")], entity_instances=ei, knowledge=kg)
    _run(uc2)

    active = kg.active_edges()
    # The canon edge is still active (never deactivated) …
    assert any(e["target_ref_id"] == canon_target and e["tier"] == "EXTRACTED" and e["is_active"] for e in active)
    # … and no deactivation ever happened.
    assert not kg.deactivations


# ---------------------------------------------------------------------------
# Filtering + self-skip + degenerate inputs
# ---------------------------------------------------------------------------


def test_unclassified_components_are_skipped() -> None:
    components = [
        _entity_component("comp-typed", entity_type_id=SUPPLIER_TYPE_ID, role="entity"),
        _entity_component("comp-notype", entity_type_id=None, role="entity"),
        _entity_component("comp-notentity", entity_type_id=SUPPLIER_TYPE_ID, role=None),
    ]
    uc, mocks = _make(components, [_candidate("inst-x")])
    summary = _run(uc)

    ei: FakeEntityInstances = mocks["entity_instances"]  # type: ignore[assignment]
    assert summary["components"] == 1  # only the fully-classified one
    assert set(ei.links.keys()) == {("comp-typed", "inst-x")}


def test_candidate_matching_components_own_identity_is_skipped() -> None:
    own_id = _component_instance_id("comp-1")
    uc, mocks = _make([_entity_component("comp-1")], [_candidate(own_id), _candidate("inst-other")])
    summary = _run(uc)

    ei: FakeEntityInstances = mocks["entity_instances"]  # type: ignore[assignment]
    # The self-identity hit is skipped; only the genuine other candidate links.
    assert summary["candidate_links"] == 1
    assert set(ei.links.keys()) == {("comp-1", "inst-other")}


def test_empty_sender_skips_node_but_still_links_candidates() -> None:
    uc, mocks = _make([_entity_component()], [_candidate("inst-x")])
    summary = asyncio.run(
        uc.execute(email_id=EMAIL_ID, importer_id=IMPORTER_ID, sender_address="   ", sender_name=None)
    )

    kg: FakeKnowledge = mocks["knowledge"]  # type: ignore[assignment]
    ei: FakeEntityInstances = mocks["entity_instances"]  # type: ignore[assignment]
    assert kg.upsert_calls == []  # no anchor -> no sender node
    assert summary["suggested_edges"] == 0
    # Candidate links still recorded (the entity-resolution half is independent).
    assert summary["candidate_links"] == 1
    assert ("comp-1", "inst-x") in ei.links


def test_no_candidates_records_nothing_but_still_creates_sender_node() -> None:
    uc, mocks = _make([_entity_component()], [])
    summary = _run(uc)

    kg: FakeKnowledge = mocks["knowledge"]  # type: ignore[assignment]
    assert summary["candidate_links"] == 0
    assert summary["suggested_edges"] == 0
    # The sender node is still asserted (a stable anchor for future edges).
    assert len(kg.upsert_calls) == 1


def test_candidate_link_write_failure_is_isolated_and_does_not_raise() -> None:
    # First candidate's link write raises; the second must still be attempted.
    ei = FakeEntityInstances(fail_on=("comp-1", "inst-bad"))
    uc, _mocks = _make(
        [_entity_component("comp-1")],
        [_candidate("inst-bad"), _candidate("inst-good")],
        entity_instances=ei,
    )
    summary = _run(uc)  # must not raise

    assert ("comp-1", "inst-good") in ei.links
    assert ("comp-1", "inst-bad") not in ei.links
    assert summary["candidate_links"] == 1


def test_embedding_is_forwarded_to_resolver_when_present() -> None:
    comp = _entity_component(embedding=(0.1, 0.2, 0.3))
    uc, mocks = _make([comp], [_candidate()])
    _run(uc)

    res: FakeResolution = mocks["resolution"]  # type: ignore[assignment]
    assert res.calls[0]["embedding"] == [0.1, 0.2, 0.3]
    assert res.calls[0]["entity_type_id"] == SUPPLIER_TYPE_ID
