"""Tests for Phase 10-02: BlendedRAG entity resolution backend.

Tests cover:
  1. _attribute_match_type pure helper — deterministic four-type vocabulary (D-09)
  2. _merge_rrf pure helper — RRF(k=60) fusion correctness
  3. D-12 lexical-only degradation when embedding=None
  4. D-09 provenance write-back on PromoteEntityOnConfirmUseCase
  5. D-11 alias flywheel write-back on promotion
  6. D-10 idempotent BackfillEntityIdentitiesUseCase
  7. ResolveEntityCandidatesUseCase (suggest-only D-05, D-21 tenant isolation)
  8. GET /v1/entity-instances/{id}/candidates and POST /v1/entity-instances/backfill
"""

from __future__ import annotations

import asyncio
import os
from typing import Any
from unittest.mock import AsyncMock

import pytest
from dishka import Provider, Scope, make_async_container
from fastapi.testclient import TestClient

from app.application.use_cases.backfill_entity_identities import BackfillEntityIdentitiesUseCase
from app.application.use_cases.promote_entity_on_confirm import PromoteEntityOnConfirmUseCase
from app.application.use_cases.resolve_entity_candidates import ResolveEntityCandidatesUseCase
from app.domain.entities.component import Component
from app.domain.entities.entity_instance import EntityInstance
from app.domain.entities.entity_type import EntityType, EntityTypeField
from app.domain.entities.extraction_record import ExtractionRecord
from app.infrastructure.supabase.entity_resolution_repository import (
    EntityCandidate,
    SupabaseEntityResolutionRepository,
    _attribute_match_type,
    _merge_rrf,
    _rrf_score,
)
from app.main import create_app
from app.settings import get_settings

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_COMP_ID = "00000000-0000-0000-0001-000000000001"
_FIELD_CHILD_ID_1 = "00000000-0000-0000-0001-000000000011"
_FIELD_CHILD_ID_2 = "00000000-0000-0000-0001-000000000012"
_ENTITY_ID_A = "00000000-0000-0000-0002-000000000001"
_ENTITY_ID_B = "00000000-0000-0000-0002-000000000002"
_ENTITY_ID_C = "00000000-0000-0000-0002-000000000003"
_IMPORTER_ID = "00000000-0000-0000-0003-000000000001"
_ENTITY_TYPE_ID = "00000000-0000-0000-0004-000000000001"
_FIELD_ID_BL = "00000000-0000-0000-0005-000000000001"
_FIELD_ID_POD = "00000000-0000-0000-0005-000000000002"
_DIM = 1536
_ZERO_EMBEDDING: list[float] = [0.0] * _DIM
_NONZERO_EMBEDDING: list[float] = [0.1] * _DIM


def _make_instance(
    entity_instance_id: str = _ENTITY_ID_A,
    importer_id: str = _IMPORTER_ID,
    display_name: str = "MSCU Industries Ltd",
    embedding: list[float] | None = None,
) -> EntityInstance:
    return EntityInstance(
        id=entity_instance_id,
        importer_id=importer_id,
        entity_type_id=_ENTITY_TYPE_ID,
        nauta_id=None,
        source="email_extracted",
        display_name=display_name,
        identifiers={},
        aliases=[],
        summary_text=None,
        embedding=embedding,
        is_active=True,
    )


def _make_component(
    component_id: str = _COMP_ID,
    content_text: str = "MSCU Industries Ltd",
    entity_type_id: str = _ENTITY_TYPE_ID,
    importer_id: str = _IMPORTER_ID,
    embedding: tuple[float, ...] | None = None,
) -> Component:
    return Component(
        id=component_id,
        email_id="email-0001",
        importer_id=importer_id,
        attachment_id=None,
        parent_component_id=None,
        source_type="pdf_region",
        location={},
        content_text=content_text,
        content_markdown=None,
        content_raw=None,
        embedding=embedding,
        sequence_index=0,
        extraction_status="confirmed",
        role="entity",
        entity_type_id=entity_type_id,
    )


def _make_field_child(
    component_id: str = _FIELD_CHILD_ID_1,
    parent_component_id: str = _COMP_ID,
    entity_type_field_id: str = _FIELD_ID_BL,
    content_text: str = "MSCUXX123456",
) -> Component:
    return Component(
        id=component_id,
        email_id="email-0001",
        importer_id=_IMPORTER_ID,
        attachment_id=None,
        parent_component_id=parent_component_id,
        source_type="pdf_region",
        location={},
        content_text=content_text,
        content_markdown=None,
        content_raw=None,
        embedding=None,
        sequence_index=1,
        extraction_status="confirmed",
        role="field",
        entity_type_id=_ENTITY_TYPE_ID,
        entity_type_field_id=entity_type_field_id,
    )


def _make_entity_type(
    with_identifier: bool = True,
) -> EntityType:
    """Return a fake EntityType with two fields: bl_number (identifier) + port_of_discharge."""
    fields: list[EntityTypeField] = [
        EntityTypeField(
            id=_FIELD_ID_BL,
            slug="bl_number",
            label="B/L Number",
            data_type="text",
            is_identifier=True,
            is_required=True,
            description=None,
            sort_order=0,
        ),
        EntityTypeField(
            id=_FIELD_ID_POD,
            slug="port_of_discharge",
            label="Port of Discharge",
            data_type="text",
            is_identifier=False,
            is_required=False,
            description=None,
            sort_order=1,
        ),
    ]
    return EntityType(
        id=_ENTITY_TYPE_ID,
        importer_id=None,
        slug="bill_of_lading",
        label="Bill of Lading",
        description=None,
        is_active=True,
        embedding=None,
        fields=tuple(fields),
    )


def _make_extraction_record(
    component_id: str = _FIELD_CHILD_ID_1,
    extracted_fields: dict[str, object] | None = None,
    corrected_fields: dict[str, object] | None = None,
    status: str = "confirmed",
) -> ExtractionRecord:
    from datetime import UTC, datetime

    return ExtractionRecord(
        id=f"rec-{component_id}",
        importer_id=_IMPORTER_ID,
        component_id=component_id,
        entity_type_id=_ENTITY_TYPE_ID,
        extracted_fields=extracted_fields or {},
        confidence_score=0.9,
        confidence_breakdown=None,
        routing_reason=None,
        status=status,
        corrected_fields=corrected_fields,
        retrieval_context=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


# ---------------------------------------------------------------------------
# 1. _attribute_match_type — pure function, deterministic D-09 vocabulary
# ---------------------------------------------------------------------------


class TestAttributeMatchType:
    """Verify the four-type tie-break: identifier_exact > alias > identifier_fuzzy."""

    def test_identifier_exact_when_sim_1_0(self) -> None:
        match_type, sim = _attribute_match_type(name_sim=0.8, identifier_sim=1.0, alias_sim=0.9)
        assert match_type == "identifier_exact"
        assert sim == 1.0

    def test_alias_wins_over_identifier_fuzzy(self) -> None:
        match_type, sim = _attribute_match_type(name_sim=0.5, identifier_sim=0.6, alias_sim=0.7)
        assert match_type == "alias"
        assert sim == pytest.approx(0.7)

    def test_identifier_fuzzy_when_identifier_beats_name(self) -> None:
        match_type, sim = _attribute_match_type(name_sim=0.4, identifier_sim=0.6, alias_sim=0.0)
        assert match_type == "identifier_fuzzy"
        assert sim == pytest.approx(0.6)

    def test_name_only_fallback_is_identifier_fuzzy(self) -> None:
        """Rule 4: name-only hit falls back to 'identifier_fuzzy' with name_sim score."""
        match_type, sim = _attribute_match_type(name_sim=0.8, identifier_sim=0.0, alias_sim=0.0)
        assert match_type == "identifier_fuzzy"
        assert sim == pytest.approx(0.8)

    def test_alias_never_labelled_identifier_fuzzy(self) -> None:
        """alias_sim > 0 and > identifier_sim must NEVER produce identifier_fuzzy."""
        match_type, _ = _attribute_match_type(name_sim=0.3, identifier_sim=0.4, alias_sim=0.5)
        assert match_type != "identifier_fuzzy"
        assert match_type == "alias"

    def test_identifier_exact_tie_with_alias(self) -> None:
        """identifier_sim=1.0 wins even if alias_sim=1.0 (tie-break: identifier_exact first)."""
        match_type, sim = _attribute_match_type(name_sim=1.0, identifier_sim=1.0, alias_sim=1.0)
        assert match_type == "identifier_exact"
        assert sim == 1.0

    def test_all_zero_returns_identifier_fuzzy_zero(self) -> None:
        """All zeros: no match signal → identifier_fuzzy with 0.0 score."""
        match_type, sim = _attribute_match_type(name_sim=0.0, identifier_sim=0.0, alias_sim=0.0)
        assert match_type == "identifier_fuzzy"
        assert sim == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# 2. _merge_rrf — RRF(k=60) fusion
# ---------------------------------------------------------------------------


class TestMergeRrf:
    def test_rrf_score_formula(self) -> None:
        """1/(60+0)=1/60 for rank=0, 1/(60+1)=1/61 for rank=1."""
        assert _rrf_score(0) == pytest.approx(1.0 / 60)
        assert _rrf_score(1) == pytest.approx(1.0 / 61)

    def test_both_arms_candidate_ranked_highest(self) -> None:
        """A candidate present in BOTH arms gets a higher fused score."""
        # A is rank-0 in both arms; B is rank-1 in only the first arm.
        merged = _merge_rrf([[_ENTITY_ID_A, _ENTITY_ID_B], [_ENTITY_ID_A]])
        assert merged[0] == _ENTITY_ID_A

    def test_order_by_descending_rrf_score(self) -> None:
        """Rank 0 in vector list should outscore rank 2 in trgm list only."""
        merged = _merge_rrf([[_ENTITY_ID_A, _ENTITY_ID_C], [_ENTITY_ID_B, _ENTITY_ID_C]])
        # C appears in both (rank 1 + rank 1); A and B appear in one each (rank 0)
        # A: 1/60, B: 1/60, C: 1/61+1/61 — C should win
        assert merged[0] == _ENTITY_ID_C

    def test_empty_lists_returns_empty(self) -> None:
        assert _merge_rrf([[], []]) == []

    def test_single_list_passthrough(self) -> None:
        ids = [_ENTITY_ID_A, _ENTITY_ID_B]
        merged = _merge_rrf([ids])
        assert merged == ids

    def test_deduplication(self) -> None:
        """Same ID appearing in multiple lists is counted once."""
        merged = _merge_rrf([[_ENTITY_ID_A], [_ENTITY_ID_A]])
        assert merged.count(_ENTITY_ID_A) == 1


# ---------------------------------------------------------------------------
# 3. D-12 lexical-only degradation via fake SupabaseEntityResolutionRepository
# ---------------------------------------------------------------------------


class FakeSupabaseClient:
    """Minimal fake Supabase client that records RPC calls."""

    def __init__(self, vector_rows: list[dict[str, Any]], trgm_rows: list[dict[str, Any]]) -> None:
        self._vector_rows = vector_rows
        self._trgm_rows = trgm_rows
        self.vector_called = False
        self.trgm_called = False
        # Records every (name, params) pair passed to .rpc(...) — LEARN-02 assertions
        # inspect this to prove match_subject_entity_instance_id is threaded into
        # BOTH arms without relying on internal RPC dispatch order.
        self.rpc_calls: list[tuple[str, dict[str, Any]]] = []

    def rpc(self, name: str, params: dict[str, Any]) -> FakeSupabaseClient:
        self.rpc_calls.append((name, params))
        if name == "match_entities_by_embedding":
            self.vector_called = True
            self._pending_rows = self._vector_rows
        else:
            self.trgm_called = True
            self._pending_rows = self._trgm_rows
        return self

    def execute(self) -> FakeSupabaseClient:
        self.data = self._pending_rows
        return self


class TestLexicalOnlyDegradation:
    def _make_trgm_row(
        self,
        entity_id: str,
        display_name: str = "MSCU Industries",
        name_sim: float = 0.8,
        identifier_sim: float = 0.0,
        alias_sim: float = 0.0,
    ) -> dict[str, Any]:
        return {
            "id": entity_id,
            "display_name": display_name,
            "sim": name_sim,
            "name_sim": name_sim,
            "identifier_sim": identifier_sim,
            "alias_sim": alias_sim,
        }

    def test_vector_arm_skipped_when_no_embedding(self) -> None:
        """When embedding=None, vector RPC must NOT be called."""
        trgm_row = self._make_trgm_row(_ENTITY_ID_A)
        fake_client = FakeSupabaseClient(vector_rows=[], trgm_rows=[trgm_row])
        repo = SupabaseEntityResolutionRepository(client=fake_client)

        candidates = repo.find_candidates(
            display_name="MSCU Industries",
            identifiers={},
            entity_type_id=_ENTITY_TYPE_ID,
            importer_id=_IMPORTER_ID,
            embedding=None,
        )

        assert fake_client.vector_called is False
        assert fake_client.trgm_called is True
        assert len(candidates) == 1
        assert candidates[0].entity_instance_id == _ENTITY_ID_A

    def test_vector_arm_called_when_embedding_present(self) -> None:
        """When embedding provided, both arms are called."""
        vector_row = {
            "id": _ENTITY_ID_B,
            "display_name": "MSCU Corp",
            "distance": 0.2,
        }
        fake_client = FakeSupabaseClient(vector_rows=[vector_row], trgm_rows=[])
        repo = SupabaseEntityResolutionRepository(client=fake_client)

        repo.find_candidates(
            display_name="MSCU",
            identifiers={},
            entity_type_id=_ENTITY_TYPE_ID,
            importer_id=_IMPORTER_ID,
            embedding=_NONZERO_EMBEDDING,
        )

        assert fake_client.vector_called is True
        assert fake_client.trgm_called is True

    def test_candidate_in_both_arms_gets_semantic_when_vector_rank_better(self) -> None:
        """Candidate in both arms with better vector rank → match_type='semantic'."""
        vector_rows = [{"id": _ENTITY_ID_A, "display_name": "MSCU", "distance": 0.1}]
        trgm_rows = [
            {
                "id": _ENTITY_ID_B,
                "display_name": "M Corp",
                "sim": 0.9,
                "name_sim": 0.9,
                "identifier_sim": 0.0,
                "alias_sim": 0.0,
            },
            {
                "id": _ENTITY_ID_A,
                "display_name": "MSCU",
                "sim": 0.8,
                "name_sim": 0.8,
                "identifier_sim": 0.0,
                "alias_sim": 0.0,
            },
        ]
        fake_client = FakeSupabaseClient(vector_rows=vector_rows, trgm_rows=trgm_rows)
        repo = SupabaseEntityResolutionRepository(client=fake_client)

        candidates = repo.find_candidates(
            display_name="MSCU",
            identifiers={},
            entity_type_id=_ENTITY_TYPE_ID,
            importer_id=_IMPORTER_ID,
            embedding=_NONZERO_EMBEDDING,
        )

        # _ENTITY_ID_A: vector rank 0, trgm rank 1 — vector is better → semantic
        candidate_a = next(c for c in candidates if c.entity_instance_id == _ENTITY_ID_A)
        assert candidate_a.match_type == "semantic"

    def test_top_n_limits_results(self) -> None:
        trgm_rows = [
            {
                "id": f"entity-{i}",
                "display_name": f"Name {i}",
                "sim": 0.9 - i * 0.01,
                "name_sim": 0.9 - i * 0.01,
                "identifier_sim": 0.0,
                "alias_sim": 0.0,
            }
            for i in range(10)
        ]
        fake_client = FakeSupabaseClient(vector_rows=[], trgm_rows=trgm_rows)
        repo = SupabaseEntityResolutionRepository(client=fake_client)

        candidates = repo.find_candidates(
            display_name="Name",
            identifiers={},
            entity_type_id=_ENTITY_TYPE_ID,
            importer_id=_IMPORTER_ID,
            embedding=None,
            top_n=3,
        )
        assert len(candidates) == 3


# ---------------------------------------------------------------------------
# 3b. LEARN-02: subject_entity_instance_id threaded into BOTH RPC arms
# ---------------------------------------------------------------------------


class TestSubjectEntityInstanceIdThreading:
    """Proves the dead was_dismissed signal is actually consumed at the RPC boundary.

    match_subject_entity_instance_id must reach BOTH match_entities_by_embedding
    and match_entities_by_trgm's param dicts when provided, and must be explicitly
    None (not absent) when the caller omits it — preserving legacy no-arg behavior
    for the SQL-side `match_subject_entity_instance_id IS NULL OR ...` guard.
    """

    def test_subject_id_passed_to_both_rpc_arms_when_provided(self) -> None:
        vector_row = {"id": _ENTITY_ID_B, "display_name": "MSCU Corp", "distance": 0.2}
        trgm_row = {
            "id": _ENTITY_ID_C,
            "display_name": "MSCU Industries",
            "sim": 0.8,
            "name_sim": 0.8,
            "identifier_sim": 0.0,
            "alias_sim": 0.0,
        }
        fake_client = FakeSupabaseClient(vector_rows=[vector_row], trgm_rows=[trgm_row])
        repo = SupabaseEntityResolutionRepository(client=fake_client)

        repo.find_candidates(
            display_name="MSCU",
            identifiers={},
            entity_type_id=_ENTITY_TYPE_ID,
            importer_id=_IMPORTER_ID,
            embedding=_NONZERO_EMBEDDING,
            subject_entity_instance_id=_ENTITY_ID_A,
        )

        assert len(fake_client.rpc_calls) == 2
        for name, params in fake_client.rpc_calls:
            assert params["match_subject_entity_instance_id"] == _ENTITY_ID_A, (
                f"{name} did not receive match_subject_entity_instance_id"
            )

    def test_subject_id_omitted_passes_none_to_both_arms(self) -> None:
        """Legacy callers (no subject id) must still send an explicit None — the
        SQL guard `match_subject_entity_instance_id IS NULL OR ...` depends on it."""
        vector_row = {"id": _ENTITY_ID_B, "display_name": "MSCU Corp", "distance": 0.2}
        trgm_row = {
            "id": _ENTITY_ID_C,
            "display_name": "MSCU Industries",
            "sim": 0.8,
            "name_sim": 0.8,
            "identifier_sim": 0.0,
            "alias_sim": 0.0,
        }
        fake_client = FakeSupabaseClient(vector_rows=[vector_row], trgm_rows=[trgm_row])
        repo = SupabaseEntityResolutionRepository(client=fake_client)

        repo.find_candidates(
            display_name="MSCU",
            identifiers={},
            entity_type_id=_ENTITY_TYPE_ID,
            importer_id=_IMPORTER_ID,
            embedding=_NONZERO_EMBEDDING,
        )

        assert len(fake_client.rpc_calls) == 2
        for _name, params in fake_client.rpc_calls:
            assert params["match_subject_entity_instance_id"] is None


# ---------------------------------------------------------------------------
# 4. D-09 provenance write on PromoteEntityOnConfirmUseCase
# ---------------------------------------------------------------------------


class FakeEntityInstanceRepository:
    """In-memory fake implementing EntityInstanceRepository port."""

    def __init__(
        self,
        field_children: list[Component] | None = None,
    ) -> None:
        self._instances: dict[str, EntityInstance] = {}
        self.candidate_links: list[dict[str, Any]] = []
        self.alias_writes: list[dict[str, Any]] = []
        self._field_children: list[Component] = field_children or []

    async def find_by_id(self, entity_instance_id: str) -> EntityInstance | None:
        return self._instances.get(entity_instance_id)

    async def find_by_importer_and_type(self, importer_id: str, entity_type_id: str) -> list[EntityInstance]:
        return [
            i for i in self._instances.values() if i.importer_id == importer_id and i.entity_type_id == entity_type_id
        ]

    async def upsert(self, entity_instance: EntityInstance) -> EntityInstance:
        self._instances[entity_instance.id] = entity_instance
        return entity_instance

    async def record_candidate_link(
        self,
        component_id: str,
        entity_instance_id: str,
        entity_type_id: str,
        match_type: str,
        similarity_score: float,
        was_selected: bool = False,
    ) -> None:
        self.candidate_links.append(
            {
                "component_id": component_id,
                "entity_instance_id": entity_instance_id,
                "entity_type_id": entity_type_id,
                "match_type": match_type,
                "similarity_score": similarity_score,
                "was_selected": was_selected,
            }
        )

    async def mark_candidate_selected(self, component_id: str, entity_instance_id: str) -> None:
        pass

    async def append_alias(self, entity_instance_id: str, alias: str) -> None:
        self.alias_writes.append(
            {
                "entity_instance_id": entity_instance_id,
                "alias": alias,
            }
        )

    async def list_confirmed_entity_components(self, importer_id: str) -> list[Component]:
        return []

    async def find_confirmed_field_children(self, parent_component_id: str) -> list[Component]:
        return [c for c in self._field_children if c.parent_component_id == parent_component_id]


class FakeComponentRepository:
    """Minimal in-memory fake for ComponentRepository port."""

    def __init__(self, components: dict[str, Component] | None = None) -> None:
        self._components: dict[str, Component] = components or {}

    async def find_by_id(self, component_id: str) -> Component | None:
        return self._components.get(component_id)


class FakeResolutionRepo:
    """In-memory fake for SupabaseEntityResolutionRepository."""

    def __init__(self, candidates: list[EntityCandidate] | None = None) -> None:
        self._candidates = candidates or []
        # Records every find_candidates(...) call's kwargs — LEARN-02 use-case-level
        # threading assertions (subject_entity_instance_id consumption proof) inspect
        # the last call without needing a full mock framework.
        self.calls: list[dict[str, Any]] = []

    def find_candidates(self, **kwargs: Any) -> list[EntityCandidate]:
        self.calls.append(kwargs)
        return self._candidates


class FakeEntityTypeRepository:
    """Minimal fake for EntityTypeRepository port."""

    def __init__(self, entity_type: EntityType | None = None) -> None:
        self._entity_type = entity_type

    async def find_by_id(self, entity_type_id: str) -> EntityType | None:
        return self._entity_type

    async def find_entity_type_by_id(self, entity_type_id: str) -> EntityType | None:
        return self._entity_type


class FakeExtractionRepository:
    """Minimal fake for ExtractionRepository port."""

    def __init__(self, records: list[ExtractionRecord] | None = None) -> None:
        self._records: list[ExtractionRecord] = records or []

    async def find_by_component_id(self, component_id: str) -> list[ExtractionRecord]:
        return [r for r in self._records if r.component_id == component_id]


class TestPromoteEntityOnConfirm:
    def _make_promote(
        self,
        component: Component | None = None,
        candidates: list[EntityCandidate] | None = None,
        field_children: list[Component] | None = None,
        entity_type: EntityType | None = None,
        extraction_records: list[ExtractionRecord] | None = None,
    ) -> tuple[PromoteEntityOnConfirmUseCase, FakeEntityInstanceRepository]:
        comp = component or _make_component()
        entity_instances = FakeEntityInstanceRepository(field_children=field_children)
        resolution_repo = FakeResolutionRepo(candidates or [])
        components_repo = FakeComponentRepository({comp.id: comp})
        entity_types_repo = FakeEntityTypeRepository(entity_type)
        extractions_repo = FakeExtractionRepository(extraction_records)
        promote = PromoteEntityOnConfirmUseCase(
            components=components_repo,
            entity_instances=entity_instances,
            entity_types=entity_types_repo,
            extractions=extractions_repo,
            resolution_repo=resolution_repo,
        )
        return promote, entity_instances

    def test_raises_when_component_not_found(self) -> None:
        entity_instances = FakeEntityInstanceRepository()
        resolution_repo = FakeResolutionRepo()
        components_repo = FakeComponentRepository()
        promote = PromoteEntityOnConfirmUseCase(
            components=components_repo,
            entity_instances=entity_instances,
            entity_types=FakeEntityTypeRepository(),
            extractions=FakeExtractionRepository(),
            resolution_repo=resolution_repo,
        )
        with pytest.raises(ValueError, match="not found"):
            asyncio.run(promote.execute(component_id="nonexistent"))

    def test_upserts_entity_instance_with_correct_source(self) -> None:
        promote, entity_instances = self._make_promote()
        asyncio.run(promote.execute(component_id=_COMP_ID))
        # Should have exactly one instance upserted
        assert len(entity_instances._instances) == 1
        instance = next(iter(entity_instances._instances.values()))
        assert instance.source == "email_extracted"
        assert instance.importer_id == _IMPORTER_ID

    def test_upsert_is_idempotent_same_component_id(self) -> None:
        """D-10: running promote twice for the same component_id upserts the same entity."""
        promote, entity_instances = self._make_promote()
        asyncio.run(promote.execute(component_id=_COMP_ID))
        asyncio.run(promote.execute(component_id=_COMP_ID))
        # Still one instance (upsert on deterministic UUID5)
        assert len(entity_instances._instances) == 1

    def test_writes_candidate_link_for_each_candidate(self) -> None:
        """D-09: record_candidate_link is called once per duplicate candidate."""
        candidates = [
            EntityCandidate(
                entity_instance_id=_ENTITY_ID_A,
                display_name="MSCU Corp",
                rrf_score=0.016,
                match_type="semantic",
                similarity_score=0.9,
            ),
            EntityCandidate(
                entity_instance_id=_ENTITY_ID_B,
                display_name="MSC United",
                rrf_score=0.015,
                match_type="alias",
                similarity_score=0.8,
            ),
        ]
        promote, entity_instances = self._make_promote(candidates=candidates)
        asyncio.run(promote.execute(component_id=_COMP_ID))

        # Duplicate-candidate links (was_selected=False)
        dup_links = [lnk for lnk in entity_instances.candidate_links if not lnk["was_selected"]]
        assert len(dup_links) == 2
        link_types = {lnk["match_type"] for lnk in dup_links}
        assert "semantic" in link_types
        assert "alias" in link_types
        # Regression: entity_type_id is NOT NULL in component_entity_candidate_links;
        # every provenance write must carry it (a missing value 500s the real DB).
        assert all(lnk["entity_type_id"] for lnk in dup_links)

    def test_alias_written_for_external_candidate(self) -> None:
        """D-11: display_name variant appended as alias on a different entity instance."""
        # The candidate is a DIFFERENT entity — must receive alias
        candidate_other = EntityCandidate(
            entity_instance_id=_ENTITY_ID_B,  # not the promoted instance
            display_name="MSCU Corp",
            rrf_score=0.016,
            match_type="semantic",
            similarity_score=0.9,
        )
        promote, entity_instances = self._make_promote(candidates=[candidate_other])
        asyncio.run(promote.execute(component_id=_COMP_ID))

        # Alias should have been written to the OTHER entity (_ENTITY_ID_B)
        assert len(entity_instances.alias_writes) == 1
        assert entity_instances.alias_writes[0]["entity_instance_id"] == _ENTITY_ID_B

    def test_no_alias_written_for_self_candidate(self) -> None:
        """Alias flywheel must NOT write-back on the same entity as itself."""
        promote, entity_instances = self._make_promote(candidates=[])
        asyncio.run(promote.execute(component_id=_COMP_ID))
        # No alias writes with zero candidates
        assert entity_instances.alias_writes == []

    def test_component_missing_entity_type_raises(self) -> None:
        comp_no_type = _make_component(entity_type_id=None)
        entity_instances = FakeEntityInstanceRepository()
        resolution_repo = FakeResolutionRepo()
        components_repo = FakeComponentRepository({comp_no_type.id: comp_no_type})
        promote = PromoteEntityOnConfirmUseCase(
            components=components_repo,
            entity_instances=entity_instances,
            entity_types=FakeEntityTypeRepository(),
            extractions=FakeExtractionRepository(),
            resolution_repo=resolution_repo,
        )
        with pytest.raises(ValueError, match="entity_type_id"):
            asyncio.run(promote.execute(component_id=comp_no_type.id))

    # ── New enrichment tests ───────────────────────────────────────────────────

    def test_occurrence_links_written_with_was_selected_true(self) -> None:
        """Field children get was_selected=True occurrence links to the entity instance."""
        field_child = _make_field_child()
        entity_type = _make_entity_type()
        rec = _make_extraction_record(
            component_id=_FIELD_CHILD_ID_1,
            extracted_fields={"bl_number": "MSCUXX123456"},
        )
        promote, entity_instances = self._make_promote(
            field_children=[field_child],
            entity_type=entity_type,
            extraction_records=[rec],
        )
        asyncio.run(promote.execute(component_id=_COMP_ID))

        occurrence_links = [lnk for lnk in entity_instances.candidate_links if lnk["was_selected"]]
        assert len(occurrence_links) == 1
        assert occurrence_links[0]["component_id"] == _FIELD_CHILD_ID_1
        assert occurrence_links[0]["match_type"] == "identifier_exact"
        assert occurrence_links[0]["similarity_score"] == 1.0

    def test_identifiers_built_from_confirmed_field_values(self) -> None:
        """entity_instance.identifiers populated from confirmed field extraction records."""
        field_child = _make_field_child(entity_type_field_id=_FIELD_ID_BL)
        entity_type = _make_entity_type()
        rec = _make_extraction_record(
            component_id=_FIELD_CHILD_ID_1,
            extracted_fields={"bl_number": "MSCUXX123456", "port_of_discharge": None},
        )
        promote, entity_instances = self._make_promote(
            field_children=[field_child],
            entity_type=entity_type,
            extraction_records=[rec],
        )
        asyncio.run(promote.execute(component_id=_COMP_ID))

        instance = next(iter(entity_instances._instances.values()))
        # Only non-null values included
        assert instance.identifiers == {"bl_number": "MSCUXX123456"}

    def test_corrected_fields_win_over_extracted_fields(self) -> None:
        """corrected_fields overrides extracted_fields when building identifiers."""
        field_child = _make_field_child(entity_type_field_id=_FIELD_ID_BL)
        entity_type = _make_entity_type()
        rec = _make_extraction_record(
            component_id=_FIELD_CHILD_ID_1,
            extracted_fields={"bl_number": "WRONG"},
            corrected_fields={"bl_number": "MSCUXX123456-CORRECTED"},
        )
        promote, entity_instances = self._make_promote(
            field_children=[field_child],
            entity_type=entity_type,
            extraction_records=[rec],
        )
        asyncio.run(promote.execute(component_id=_COMP_ID))

        instance = next(iter(entity_instances._instances.values()))
        assert instance.identifiers["bl_number"] == "MSCUXX123456-CORRECTED"

    def test_display_name_uses_type_and_primary_identifier(self) -> None:
        """display_name = 'Type · primary_identifier_value' when is_identifier field present."""
        field_child = _make_field_child(
            entity_type_field_id=_FIELD_ID_BL,
            content_text="MSCUXX123456",
        )
        entity_type = _make_entity_type()
        rec = _make_extraction_record(
            component_id=_FIELD_CHILD_ID_1,
            extracted_fields={"bl_number": "MSCUXX123456"},
        )
        promote, entity_instances = self._make_promote(
            field_children=[field_child],
            entity_type=entity_type,
            extraction_records=[rec],
        )
        asyncio.run(promote.execute(component_id=_COMP_ID))

        instance = next(iter(entity_instances._instances.values()))
        assert instance.display_name == "Bill of Lading · MSCUXX123456"

    def test_display_name_fallback_to_first_field_when_no_identifier(self) -> None:
        """display_name falls back to first confirmed field value when no is_identifier field."""
        # Use port_of_discharge (not an identifier) as the only field child
        field_child = _make_field_child(
            component_id=_FIELD_CHILD_ID_2,
            entity_type_field_id=_FIELD_ID_POD,
            content_text="PORT SAID / EGYPT",
        )
        entity_type = _make_entity_type()
        rec = _make_extraction_record(
            component_id=_FIELD_CHILD_ID_2,
            extracted_fields={"port_of_discharge": "PORT SAID / EGYPT"},
        )
        promote, entity_instances = self._make_promote(
            field_children=[field_child],
            entity_type=entity_type,
            extraction_records=[rec],
        )
        asyncio.run(promote.execute(component_id=_COMP_ID))

        instance = next(iter(entity_instances._instances.values()))
        # No is_identifier field, so falls back to port_of_discharge value
        assert instance.display_name == "Bill of Lading · PORT SAID / EGYPT"

    def test_display_name_fallback_to_content_text_when_no_field_values(self) -> None:
        """display_name falls back to content_text when no field children or values."""
        promote, entity_instances = self._make_promote(entity_type=_make_entity_type())
        asyncio.run(promote.execute(component_id=_COMP_ID))

        instance = next(iter(entity_instances._instances.values()))
        # No field children → fallback: "Type · content_text"
        assert "MSCU Industries Ltd" in instance.display_name

    def test_idempotent_on_rerun_with_field_children(self) -> None:
        """Re-running promote with same field children stays at one instance."""
        field_child = _make_field_child()
        entity_type = _make_entity_type()
        rec = _make_extraction_record(
            component_id=_FIELD_CHILD_ID_1,
            extracted_fields={"bl_number": "MSCUXX123456"},
        )
        promote, entity_instances = self._make_promote(
            field_children=[field_child],
            entity_type=entity_type,
            extraction_records=[rec],
        )
        asyncio.run(promote.execute(component_id=_COMP_ID))
        asyncio.run(promote.execute(component_id=_COMP_ID))

        assert len(entity_instances._instances) == 1
        instance = next(iter(entity_instances._instances.values()))
        # identifiers and display_name are refreshed on re-run
        assert instance.identifiers == {"bl_number": "MSCUXX123456"}

    def test_occurrence_links_not_written_when_no_field_children(self) -> None:
        """No occurrence links when entity component has no confirmed field children."""
        promote, entity_instances = self._make_promote()
        asyncio.run(promote.execute(component_id=_COMP_ID))

        occurrence_links = [lnk for lnk in entity_instances.candidate_links if lnk["was_selected"]]
        assert occurrence_links == []

    def test_null_field_values_excluded_from_identifiers(self) -> None:
        """Null values in extracted_fields are not included in identifiers dict."""
        field_child = _make_field_child(entity_type_field_id=_FIELD_ID_BL)
        entity_type = _make_entity_type()
        rec = _make_extraction_record(
            component_id=_FIELD_CHILD_ID_1,
            extracted_fields={"bl_number": None},
        )
        promote, entity_instances = self._make_promote(
            field_children=[field_child],
            entity_type=entity_type,
            extraction_records=[rec],
        )
        asyncio.run(promote.execute(component_id=_COMP_ID))

        instance = next(iter(entity_instances._instances.values()))
        assert "bl_number" not in instance.identifiers

    # ── LEARN-02: subject_entity_instance_id consumption proof ─────────────────

    def test_threads_subject_entity_instance_id_to_resolution_repo(self) -> None:
        """find_candidates is called with subject_entity_instance_id=persisted.id.

        This is the wiring that lets a later RejectMergeUseCase call on THIS
        instance suppress its own resurfacing candidates (LEARN-02 gap 2). Before
        this plan, the kwarg was absent entirely.
        """
        comp = _make_component()
        entity_instances = FakeEntityInstanceRepository()
        resolution_repo = FakeResolutionRepo([])
        components_repo = FakeComponentRepository({comp.id: comp})
        promote = PromoteEntityOnConfirmUseCase(
            components=components_repo,
            entity_instances=entity_instances,
            entity_types=FakeEntityTypeRepository(),
            extractions=FakeExtractionRepository(),
            resolution_repo=resolution_repo,
        )
        asyncio.run(promote.execute(component_id=_COMP_ID))

        assert len(resolution_repo.calls) == 1
        persisted_id = next(iter(entity_instances._instances.values())).id
        assert resolution_repo.calls[0]["subject_entity_instance_id"] == persisted_id


# ---------------------------------------------------------------------------
# 5. D-10 BackfillEntityIdentitiesUseCase — idempotent + partial success
# ---------------------------------------------------------------------------


class FakeEntityInstanceRepositoryWithComponents(FakeEntityInstanceRepository):
    """Extends fake with a configurable list of confirmed components for backfill."""

    def __init__(self, confirmed_components: list[Component]) -> None:
        super().__init__()
        self._confirmed_components = confirmed_components

    async def list_confirmed_entity_components(self, importer_id: str) -> list[Component]:
        return [c for c in self._confirmed_components if c.importer_id == importer_id]


class TestBackfillEntityIdentities:
    def _make_backfill(
        self,
        confirmed_components: list[Component],
        promote_side_effect: list[Exception | None] | None = None,
    ) -> tuple[BackfillEntityIdentitiesUseCase, list[str]]:
        """Return (use_case, promoted_ids_list)."""
        entity_instances = FakeEntityInstanceRepositoryWithComponents(confirmed_components)
        promoted_ids: list[str] = []

        class TrackingPromote:
            """Captures promoted component ids; optionally raises on some."""

            def __init__(self) -> None:
                self._side_effects = list(promote_side_effect or [])

            async def execute(self, *, component_id: str) -> None:
                promoted_ids.append(component_id)
                if self._side_effects:
                    effect = self._side_effects.pop(0)
                    if effect is not None:
                        raise effect

        use_case = BackfillEntityIdentitiesUseCase(
            entity_instances=entity_instances,
            promote=TrackingPromote(),
        )
        return use_case, promoted_ids

    def test_promotes_all_confirmed_components(self) -> None:
        components = [_make_component(component_id=f"comp-{i}") for i in range(3)]
        use_case, promoted_ids = self._make_backfill(confirmed_components=components)
        result = asyncio.run(use_case.execute(importer_id=_IMPORTER_ID))
        assert result["total"] == 3
        assert result["succeeded"] == 3
        assert result["failed"] == 0
        assert set(promoted_ids) == {"comp-0", "comp-1", "comp-2"}

    def test_partial_failure_continues_remaining(self) -> None:
        """D-10: individual errors are logged and skipped — loop continues."""
        components = [_make_component(component_id=f"comp-{i}") for i in range(3)]
        # Second component raises
        side_effects: list[Exception | None] = [None, RuntimeError("db error"), None]
        use_case, _promoted_ids = self._make_backfill(confirmed_components=components, promote_side_effect=side_effects)
        result = asyncio.run(use_case.execute(importer_id=_IMPORTER_ID))
        assert result["total"] == 3
        assert result["succeeded"] == 2
        assert result["failed"] == 1

    def test_empty_components_returns_zeros(self) -> None:
        use_case, _ = self._make_backfill(confirmed_components=[])
        result = asyncio.run(use_case.execute(importer_id=_IMPORTER_ID))
        assert result == {"total": 0, "succeeded": 0, "failed": 0}

    def test_idempotent_second_run(self) -> None:
        """D-10: running backfill twice produces the same totals."""
        components = [_make_component()]
        use_case, _ = self._make_backfill(confirmed_components=components)
        result1 = asyncio.run(use_case.execute(importer_id=_IMPORTER_ID))
        result2 = asyncio.run(use_case.execute(importer_id=_IMPORTER_ID))
        assert result1 == result2


# ---------------------------------------------------------------------------
# 6. ResolveEntityCandidatesUseCase — suggest-only D-05, D-21 tenant isolation
# ---------------------------------------------------------------------------


class TestResolveEntityCandidatesUseCase:
    def _make_use_case(
        self,
        instance: EntityInstance | None = None,
        candidates: list[EntityCandidate] | None = None,
    ) -> tuple[ResolveEntityCandidatesUseCase, FakeEntityInstanceRepository]:
        entity_instances = FakeEntityInstanceRepository()
        if instance is not None:
            entity_instances._instances[instance.id] = instance
        resolution_repo = FakeResolutionRepo(candidates or [])
        use_case = ResolveEntityCandidatesUseCase(
            entity_instances=entity_instances,
            resolution_repo=resolution_repo,
        )
        return use_case, entity_instances

    def test_raises_when_instance_not_found(self) -> None:
        use_case, _ = self._make_use_case()
        with pytest.raises(ValueError, match="not found"):
            asyncio.run(use_case.execute(entity_instance_id="nonexistent"))

    def test_returns_candidates_from_repo(self) -> None:
        instance = _make_instance()
        expected = [
            EntityCandidate(
                entity_instance_id=_ENTITY_ID_B,
                display_name="MSCU Corp",
                rrf_score=0.016,
                match_type="semantic",
                similarity_score=0.9,
            )
        ]
        use_case, _ = self._make_use_case(instance=instance, candidates=expected)
        result = asyncio.run(use_case.execute(entity_instance_id=instance.id))
        assert len(result) == 1
        assert result[0].entity_instance_id == _ENTITY_ID_B

    def test_suggest_only_no_writes(self) -> None:
        """D-05: use case must not write candidate links or aliases."""
        instance = _make_instance()
        candidates = [
            EntityCandidate(
                entity_instance_id=_ENTITY_ID_B,
                display_name="MSCU Corp",
                rrf_score=0.016,
                match_type="semantic",
                similarity_score=0.9,
            )
        ]
        use_case, entity_instances = self._make_use_case(instance=instance, candidates=candidates)
        asyncio.run(use_case.execute(entity_instance_id=instance.id))
        # No provenance writes from resolve-only path
        assert entity_instances.candidate_links == []
        assert entity_instances.alias_writes == []

    def test_threads_subject_entity_instance_id_to_resolution_repo(self) -> None:
        """LEARN-02 consumption proof: find_candidates(entity_instance_id="S") calls
        resolution_repo.find_candidates(..., subject_entity_instance_id="S"). Before
        this plan the kwarg was absent entirely — a dismissed pair resurfaced forever."""
        instance = _make_instance()
        entity_instances = FakeEntityInstanceRepository()
        entity_instances._instances[instance.id] = instance
        resolution_repo = FakeResolutionRepo([])
        use_case = ResolveEntityCandidatesUseCase(
            entity_instances=entity_instances,
            resolution_repo=resolution_repo,
        )
        asyncio.run(use_case.execute(entity_instance_id=instance.id))

        assert len(resolution_repo.calls) == 1
        assert resolution_repo.calls[0]["subject_entity_instance_id"] == instance.id


# ---------------------------------------------------------------------------
# 7. API endpoints — fake DI container
# ---------------------------------------------------------------------------


def _make_api_key() -> str:
    return get_settings().API_KEY


class TestEntityInstancesApi:
    """Integration tests for /v1/entity-instances routes via TestClient + fake DI."""

    def _build_client(
        self,
        resolve_use_case: ResolveEntityCandidatesUseCase | None = None,
        backfill_use_case: BackfillEntityIdentitiesUseCase | None = None,
    ) -> TestClient:
        # Build stub use cases if not provided
        if resolve_use_case is None:
            entity_instances = FakeEntityInstanceRepository()
            resolution_repo = FakeResolutionRepo([])
            resolve_use_case = ResolveEntityCandidatesUseCase(
                entity_instances=entity_instances,
                resolution_repo=resolution_repo,
            )

        if backfill_use_case is None:
            entity_instances2 = FakeEntityInstanceRepositoryWithComponents([])

            class _DummyPromote:
                async def execute(self, *, component_id: str) -> None:
                    pass

            backfill_use_case = BackfillEntityIdentitiesUseCase(
                entity_instances=entity_instances2,
                promote=_DummyPromote(),
            )

        # Capture for closure
        _resolve = resolve_use_case
        _backfill = backfill_use_case

        # Build a minimal provider that only registers the tested use cases.
        # Also stub PromoteEntityOnConfirmUseCase since components.py injects it
        # in the confirm endpoint (the router is mounted by create_app).
        _promote_stub = AsyncMock(spec=PromoteEntityOnConfirmUseCase)
        provider = Provider(scope=Scope.APP)
        provider.provide(lambda: _resolve, provides=ResolveEntityCandidatesUseCase)
        provider.provide(lambda: _backfill, provides=BackfillEntityIdentitiesUseCase)
        provider.provide(lambda: _promote_stub, provides=PromoteEntityOnConfirmUseCase)

        app = create_app()
        # Replace the app's dishka container with our stub — mirrors the pattern
        # used in test_entity_types_api.py (avoids double setup_dishka call).
        app.state.dishka_container = make_async_container(provider)

        return TestClient(app, raise_server_exceptions=False)

    def test_get_candidates_missing_api_key(self) -> None:
        """GET /{id}/candidates returns 401 without X-API-Key when auth is configured."""
        old_key = os.environ.get("API_KEY")
        os.environ["API_KEY"] = "test-secret-key"
        get_settings.cache_clear()
        try:
            client = self._build_client()
            resp = client.get(f"/v1/entity-instances/{_ENTITY_ID_A}/candidates")
            assert resp.status_code == 401
        finally:
            if old_key is None:
                os.environ.pop("API_KEY", None)
            else:
                os.environ["API_KEY"] = old_key
            get_settings.cache_clear()

    def test_get_candidates_not_found(self) -> None:
        """GET /{id}/candidates → 404 when entity instance missing."""
        entity_instances = FakeEntityInstanceRepository()
        resolution_repo = FakeResolutionRepo([])
        use_case = ResolveEntityCandidatesUseCase(
            entity_instances=entity_instances,
            resolution_repo=resolution_repo,
        )
        client = self._build_client(resolve_use_case=use_case)
        resp = client.get(
            f"/v1/entity-instances/{_ENTITY_ID_A}/candidates",
            headers={"X-API-Key": _make_api_key()},
        )
        assert resp.status_code == 404

    def test_get_candidates_returns_candidate_list(self) -> None:
        entity_instances = FakeEntityInstanceRepository()
        instance = _make_instance(entity_instance_id=_ENTITY_ID_A)
        entity_instances._instances[_ENTITY_ID_A] = instance
        candidates = [
            EntityCandidate(
                entity_instance_id=_ENTITY_ID_B,
                display_name="MSCU Corp",
                rrf_score=0.016,
                match_type="semantic",
                similarity_score=0.9,
            )
        ]
        resolution_repo = FakeResolutionRepo(candidates)
        use_case = ResolveEntityCandidatesUseCase(
            entity_instances=entity_instances,
            resolution_repo=resolution_repo,
        )
        client = self._build_client(resolve_use_case=use_case)
        resp = client.get(
            f"/v1/entity-instances/{_ENTITY_ID_A}/candidates",
            headers={"X-API-Key": _make_api_key()},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        data = body["data"]
        assert len(data) == 1
        assert data[0]["entity_instance_id"] == _ENTITY_ID_B
        assert data[0]["match_type"] == "semantic"

    def test_backfill_missing_api_key(self) -> None:
        """POST /v1/entity-instances/backfill returns 401 without X-API-Key when auth is configured."""
        old_key = os.environ.get("API_KEY")
        os.environ["API_KEY"] = "test-secret-key"
        get_settings.cache_clear()
        try:
            client = self._build_client()
            resp = client.post("/v1/entity-instances/backfill", json={"importer_id": _IMPORTER_ID})
            assert resp.status_code == 401
        finally:
            if old_key is None:
                os.environ.pop("API_KEY", None)
            else:
                os.environ["API_KEY"] = old_key
            get_settings.cache_clear()

    def test_backfill_returns_result_counts(self) -> None:
        components = [_make_component(component_id=f"comp-{i}") for i in range(2)]
        entity_instances = FakeEntityInstanceRepositoryWithComponents(components)

        class _NoOpPromote:
            async def execute(self, *, component_id: str) -> None:
                pass

        backfill = BackfillEntityIdentitiesUseCase(
            entity_instances=entity_instances,
            promote=_NoOpPromote(),
        )
        client = self._build_client(backfill_use_case=backfill)
        resp = client.post(
            "/v1/entity-instances/backfill",
            json={"importer_id": _IMPORTER_ID},
            headers={"X-API-Key": _make_api_key()},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        data = body["data"]
        assert data["total"] == 2
        assert data["succeeded"] == 2
        assert data["failed"] == 0
