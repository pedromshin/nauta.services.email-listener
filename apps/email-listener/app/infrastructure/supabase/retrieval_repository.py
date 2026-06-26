"""SupabaseRetrievalRepository — hybrid vector + trigram retrieval over confirmed regions.

Implements RetrievalPort. Strategy:
  1. Vector cosine query: email_components ORDER BY embedding <=> $emb WHERE
     importer_id=? AND extraction_status IN ('confirmed','auto_confirmed') LIMIT 20.
  2. Trigram query: email_components WHERE importer_id=? AND
     similarity(content_text, key_terms_joined) > 0 ORDER BY similarity.
  3. Merge with RRF(k=60), dedup by component_id, return top_n RetrievedExample.

T-04-28: both sub-queries filter importer_id — cross-tenant isolation.
D-13: empty confirmed set returns [] without error (cold-start safe).
"""

from __future__ import annotations

import logging
from typing import Any

from app.domain.ports.retrieval_port import RetrievedExample

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# RRF helpers (pure functions — testable in isolation)
# ---------------------------------------------------------------------------

_K_DEFAULT = 60


def _rrf_score(rank: int, k: int = _K_DEFAULT) -> float:
    """Reciprocal rank fusion score: 1 / (k + rank).

    k=60 is the production-validated default per RESEARCH §4.1.
    rank is 0-based (rank=0 is the top result).
    """
    return 1.0 / (k + rank)


def _merge_rrf(ranked_lists: list[list[str]]) -> list[str]:
    """Merge multiple ranked lists of component IDs using RRF.

    Returns a deduplicated list of component IDs sorted by descending
    summed RRF scores.  Handles empty lists safely.
    """
    scores: dict[str, float] = {}
    for ranked in ranked_lists:
        for rank, component_id in enumerate(ranked):
            scores[component_id] = scores.get(component_id, 0.0) + _rrf_score(rank)

    return sorted(scores, key=lambda cid: scores[cid], reverse=True)


# ---------------------------------------------------------------------------
# Repository
# ---------------------------------------------------------------------------

_VECTOR_RPC = "match_components_by_embedding"
_TRGM_RPC = "match_components_by_trgm"
_CONFIRMED_STATUSES = ["confirmed", "auto_confirmed"]
_CANDIDATE_LIMIT = 20


class SupabaseRetrievalRepository:
    """Supabase implementation of RetrievalPort.

    The Supabase client is injected so the repository can be unit-tested
    with a mock (no real DB).

    Both _vector_query and _trgm_query filter importer_id on every call
    (T-04-28 cross-tenant isolation).

    This class calls two Postgres RPC functions defined via the custom
    migration (match_components_by_embedding, match_components_by_trgm).
    If those functions don't yet exist, the queries fall back to no results
    rather than raising — cold-start safe (D-13).
    """

    def __init__(self, client: Any) -> None:
        self._client = client

    async def find_similar_confirmed(
        self,
        *,
        component_embedding: tuple[float, ...],
        entity_type_id: str,
        importer_id: str,
        key_terms: tuple[str, ...],
        top_n: int = 3,
    ) -> list[RetrievedExample]:
        """Return top-N confirmed components similar to the given embedding.

        Runs vector + trigram queries (both importer_id-filtered), merges with
        RRF k=60, and returns at most top_n RetrievedExample objects sorted by
        descending RRF score.
        """
        # Run both sub-queries
        vector_rows = self._vector_query(
            embedding=component_embedding,
            entity_type_id=entity_type_id,
            importer_id=importer_id,
        )
        trgm_rows = self._trgm_query(
            key_terms=key_terms,
            entity_type_id=entity_type_id,
            importer_id=importer_id,
        )

        if not vector_rows and not trgm_rows:
            return []

        # Build ranked lists by component_id for RRF
        vector_ids = [r["id"] for r in vector_rows]
        trgm_ids = [r["id"] for r in trgm_rows]
        merged_ids = _merge_rrf([vector_ids, trgm_ids])[:top_n]

        # Build lookup maps from both result sets
        row_map: dict[str, dict[str, Any]] = {}
        for row in vector_rows:
            row_map[row["id"]] = row
        for row in trgm_rows:
            if row["id"] not in row_map:
                row_map[row["id"]] = row

        # Compute per-component RRF scores for the final result
        vector_rank_map = {cid: rank for rank, cid in enumerate(vector_ids)}
        trgm_rank_map = {cid: rank for rank, cid in enumerate(trgm_ids)}

        results: list[RetrievedExample] = []
        for cid in merged_ids:
            maybe_row: dict[str, Any] | None = row_map.get(cid)
            if maybe_row is None:
                continue

            score = 0.0
            if cid in vector_rank_map:
                score += _rrf_score(vector_rank_map[cid])
            if cid in trgm_rank_map:
                score += _rrf_score(trgm_rank_map[cid])

            results.append(
                RetrievedExample(
                    component_id=cid,
                    content_text=str(maybe_row.get("content_text", "")),
                    extracted_fields=dict(maybe_row.get("extracted_fields") or {}),
                    score=score,
                )
            )

        return results

    # ------------------------------------------------------------------
    # Private query helpers
    # ------------------------------------------------------------------

    def _vector_query(
        self,
        *,
        embedding: tuple[float, ...],
        entity_type_id: str,
        importer_id: str,
    ) -> list[dict[str, Any]]:
        """Vector cosine similarity query over confirmed components."""
        try:
            result = self._client.rpc(
                _VECTOR_RPC,
                {
                    "query_embedding": list(embedding),
                    "match_importer_id": importer_id,
                    "match_entity_type_id": entity_type_id,
                    "match_statuses": _CONFIRMED_STATUSES,
                    "match_count": _CANDIDATE_LIMIT,
                },
            ).execute()
            rows: list[dict[str, Any]] = result.data or []
            return rows
        except Exception:
            logger.exception(
                "SupabaseRetrievalRepository: vector query failed — returning empty",
                extra={"importer_id": importer_id},
            )
            return []

    def _trgm_query(
        self,
        *,
        key_terms: tuple[str, ...],
        entity_type_id: str,
        importer_id: str,
    ) -> list[dict[str, Any]]:
        """pg_trgm similarity query over confirmed component content/identifiers."""
        try:
            query_text = " ".join(key_terms) if key_terms else ""
            result = self._client.rpc(
                _TRGM_RPC,
                {
                    "query_text": query_text,
                    "match_importer_id": importer_id,
                    "match_entity_type_id": entity_type_id,
                    "match_statuses": _CONFIRMED_STATUSES,
                    "match_count": _CANDIDATE_LIMIT,
                },
            ).execute()
            rows: list[dict[str, Any]] = result.data or []
            return rows
        except Exception:
            logger.exception(
                "SupabaseRetrievalRepository: trigram query failed — returning empty",
                extra={"importer_id": importer_id},
            )
            return []
