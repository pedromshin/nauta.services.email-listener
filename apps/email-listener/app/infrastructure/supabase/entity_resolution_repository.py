"""SupabaseEntityResolutionRepository — BlendedRAG resolution over entity_instances.

Strategy (D-07):
  1. Dense vector arm: match_entities_by_embedding (HNSW cosine). Skipped when
     embedding is None (D-12 graceful degradation).
  2. Lexical arm: match_entities_by_trgm (pg_trgm over display_name + identifiers
     + aliases). Always runs.
  3. Fuse with RRF(k=60); return top-N EntityCandidate objects.

Each candidate carries a DETERMINISTICALLY-attributed match_type (D-09):
  - Dense arm -> 'semantic' (always).
  - Lexical arm -> winner of {name_sim, identifier_sim, alias_sim} per the pure
    helper _attribute_match_type with tie-break: identifier_exact > alias > identifier_fuzzy.

Both arms pass match_importer_id (T-10-10 cross-tenant isolation).
"""

from __future__ import annotations

import logging
from typing import Any

from app.domain.ports.entity_resolution_repository import EntityCandidate

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# RRF helpers (pure functions — testable in isolation)
# ---------------------------------------------------------------------------

_K_DEFAULT = 60

_VECTOR_RPC = "match_entities_by_embedding"
_TRGM_RPC = "match_entities_by_trgm"
_CANDIDATE_LIMIT = 20

# D-09 four-type vocabulary
_MATCH_SEMANTIC = "semantic"
_MATCH_IDENTIFIER_EXACT = "identifier_exact"
_MATCH_IDENTIFIER_FUZZY = "identifier_fuzzy"
_MATCH_ALIAS = "alias"


def _rrf_score(rank: int, k: int = _K_DEFAULT) -> float:
    """Reciprocal rank fusion score: 1 / (k + rank).

    k=60 is the production-validated default per RESEARCH §4.1.
    rank is 0-based (rank=0 is the top result).
    """
    return 1.0 / (k + rank)


def _merge_rrf(ranked_lists: list[list[str]]) -> list[str]:
    """Merge multiple ranked lists of entity_instance IDs using RRF.

    Returns a deduplicated list of IDs sorted by descending summed RRF scores.
    Handles empty lists safely.
    """
    scores: dict[str, float] = {}
    for ranked in ranked_lists:
        for rank, entity_id in enumerate(ranked):
            scores[entity_id] = scores.get(entity_id, 0.0) + _rrf_score(rank)
    return sorted(scores, key=lambda eid: scores[eid], reverse=True)


def _attribute_match_type(
    name_sim: float,
    identifier_sim: float,
    alias_sim: float,
) -> tuple[str, float]:
    """Deterministically assign lexical arm match_type from winning sub-score.

    Rules (tie-break: identifier_exact > alias > identifier_fuzzy):
    1. identifier_sim == 1.0 AND is the max -> 'identifier_exact'
    2. alias_sim is the (non-zero) max -> 'alias'
    3. identifier_sim is the (non-zero) max -> 'identifier_fuzzy'
    4. name-only hit (fallback) -> 'identifier_fuzzy'

    Returns (match_type, winning_sub_score).
    """
    max_sim = max(name_sim, identifier_sim, alias_sim)

    # Rule 1: exact identifier match wins over all.
    if identifier_sim == 1.0 and identifier_sim >= max_sim:
        return _MATCH_IDENTIFIER_EXACT, identifier_sim

    # Rule 2: alias sub-score is the clear max (non-zero).
    if alias_sim > 0.0 and alias_sim >= identifier_sim and alias_sim >= name_sim:
        return _MATCH_ALIAS, alias_sim

    # Rule 3: identifier sub-score is the clear max (non-zero).
    if identifier_sim > 0.0 and identifier_sim >= name_sim:
        return _MATCH_IDENTIFIER_FUZZY, identifier_sim

    # Rule 4: name-only hit fallback.
    return _MATCH_IDENTIFIER_FUZZY, name_sim


# EntityCandidate is re-exported from the domain layer for backward compatibility.
# Import it from app.domain.ports.entity_resolution_repository directly.
__all__ = ["EntityCandidate", "SupabaseEntityResolutionRepository"]

# ---------------------------------------------------------------------------
# Repository
# ---------------------------------------------------------------------------


class SupabaseEntityResolutionRepository:
    """Supabase implementation of the BlendedRAG entity resolution arm.

    Both _vector_query and _trgm_query filter match_importer_id on every call
    (T-10-10 cross-tenant isolation).

    This class calls two Postgres RPC functions defined via migration 0017:
    match_entities_by_embedding and match_entities_by_trgm.
    Both degrade gracefully if the RPC fails (try/except -> [] -> D-12).
    """

    def __init__(self, client: Any) -> None:
        self._client = client

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
        """Return top-N entity candidates fused by RRF(k=60).

        Dense arm skipped when embedding is None (D-12 graceful degradation).
        Lexical arm always runs (D-12 lexical-always).
        Both arms pass match_importer_id (T-10-10 cross-tenant isolation).

        subject_entity_instance_id (optional, LEARN-02): threaded into both RPC
        arms as match_subject_entity_instance_id so a dismissed pair
        (component_entity_candidate_links.was_dismissed) is excluded in-SQL,
        symmetrically across both link orderings. None preserves legacy behavior.
        """
        # Build identifier query text from all identifier values
        id_values = " ".join(str(v) for v in identifiers.values() if v)
        query_text = id_values.strip() or display_name

        # Run vector arm (only when embedding is available — D-12)
        vector_rows: list[dict[str, Any]] = []
        if embedding is not None:
            vector_rows = self._vector_query(
                embedding=embedding,
                entity_type_id=entity_type_id,
                importer_id=importer_id,
                subject_entity_instance_id=subject_entity_instance_id,
            )

        # Run lexical arm unconditionally (D-12 lexical-always)
        trgm_rows = self._trgm_query(
            query_text=query_text,
            entity_type_id=entity_type_id,
            importer_id=importer_id,
            subject_entity_instance_id=subject_entity_instance_id,
        )

        if not vector_rows and not trgm_rows:
            return []

        # Build ranked id lists for RRF
        vector_ids = [str(r["id"]) for r in vector_rows]
        trgm_ids = [str(r["id"]) for r in trgm_rows]
        merged_ids = _merge_rrf([vector_ids, trgm_ids])[:top_n]

        # Build lookup maps from both result sets
        vector_row_map: dict[str, dict[str, Any]] = {str(r["id"]): r for r in vector_rows}
        trgm_row_map: dict[str, dict[str, Any]] = {str(r["id"]): r for r in trgm_rows}

        # Build rank maps for RRF score computation
        vector_rank_map: dict[str, int] = {eid: rank for rank, eid in enumerate(vector_ids)}
        trgm_rank_map: dict[str, int] = {eid: rank for rank, eid in enumerate(trgm_ids)}

        results: list[EntityCandidate] = []
        for eid in merged_ids:
            rrf = 0.0
            if eid in vector_rank_map:
                rrf += _rrf_score(vector_rank_map[eid])
            if eid in trgm_rank_map:
                rrf += _rrf_score(trgm_rank_map[eid])

            # Determine match_type and similarity_score from the winning arm
            if eid in trgm_row_map:
                trgm_row = trgm_row_map[eid]
                name_sim = float(trgm_row.get("name_sim") or 0.0)
                identifier_sim = float(trgm_row.get("identifier_sim") or 0.0)
                alias_sim = float(trgm_row.get("alias_sim") or 0.0)
                match_type, sim_score = _attribute_match_type(name_sim, identifier_sim, alias_sim)
                display = str(trgm_row.get("display_name") or "")
            else:
                # Vector-only hit
                v_row = vector_row_map[eid]
                match_type = _MATCH_SEMANTIC
                # Distance -> similarity: closer distance = higher sim
                distance = float(v_row.get("distance") or 1.0)
                sim_score = max(0.0, 1.0 - distance)
                display = str(v_row.get("display_name") or "")

            # Vector-arm hits that ALSO appear in trgm: override to semantic if
            # the vector rank is better (contributes more RRF) than trgm.
            if eid in vector_row_map and eid in trgm_row_map:
                v_rank = vector_rank_map[eid]
                t_rank = trgm_rank_map[eid]
                if v_rank < t_rank:
                    # Vector arm dominated — label semantic, keep trgm sim_score
                    # as secondary signal; prefer semantic for clean D-09 audit trail
                    match_type = _MATCH_SEMANTIC
                    v_row = vector_row_map[eid]
                    distance = float(v_row.get("distance") or 1.0)
                    sim_score = max(0.0, 1.0 - distance)

            results.append(
                EntityCandidate(
                    entity_instance_id=eid,
                    display_name=display,
                    rrf_score=rrf,
                    match_type=match_type,
                    similarity_score=sim_score,
                )
            )

        return results

    # ------------------------------------------------------------------
    # Private query helpers
    # ------------------------------------------------------------------

    def _vector_query(
        self,
        *,
        embedding: list[float],
        entity_type_id: str,
        importer_id: str,
        subject_entity_instance_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Dense cosine similarity query over entity_instances.embedding (HNSW)."""
        try:
            result = self._client.rpc(
                _VECTOR_RPC,
                {
                    "query_embedding": embedding,
                    "match_importer_id": importer_id,
                    "match_entity_type_id": entity_type_id,
                    "match_count": _CANDIDATE_LIMIT,
                    "match_subject_entity_instance_id": subject_entity_instance_id,
                },
            ).execute()
            rows: list[dict[str, Any]] = result.data or []
            return rows
        except Exception:
            logger.exception(
                "SupabaseEntityResolutionRepository: vector query failed — returning empty",
                extra={"importer_id": importer_id, "entity_type_id": entity_type_id},
            )
            return []

    def _trgm_query(
        self,
        *,
        query_text: str,
        entity_type_id: str,
        importer_id: str,
        subject_entity_instance_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """pg_trgm similarity query over entity display_name + identifiers + aliases."""
        try:
            result = self._client.rpc(
                _TRGM_RPC,
                {
                    "query_text": query_text,
                    "match_importer_id": importer_id,
                    "match_entity_type_id": entity_type_id,
                    "match_count": _CANDIDATE_LIMIT,
                    "match_subject_entity_instance_id": subject_entity_instance_id,
                },
            ).execute()
            rows: list[dict[str, Any]] = result.data or []
            return rows
        except Exception:
            logger.exception(
                "SupabaseEntityResolutionRepository: trigram query failed — returning empty",
                extra={"importer_id": importer_id, "entity_type_id": entity_type_id},
            )
            return []
