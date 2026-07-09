"""SearchKnowledgeExecutor -- mode-dispatching wrapper over 37-01's read side (Phase 37, TOOL-03/TOOL-04).

The THIRD real, production `ToolExecutor` (36-01/36-02 shipped the first
two). Zero new backend: this executor calls ONLY the two repository methods
Plan 37-01 added -- `KnowledgeGraphRepository.search_nodes` (RRF-fused
BlendedRAG over the extracted_only view) and
`KnowledgeGraphRepository.expand_neighbours` (bounded, tenant-scoped BFS) --
and never raises past the `ToolExecutor.execute()` boundary (port contract).

TOOL-04 belt 2 (T-37-06): `_belt_two_label` is the SOLE place in this module
that ever reads a row's free-text columns, gated on `tier == "EXTRACTED"`.
It re-derives field omission from `tier` itself, never trusting whatever
text the repository returned -- independent of 37-01's SQL view (belt 1) and
RPC-level tier filters (belt 3), so a hypothetical regression in either
layer alone still cannot leak non-EXTRACTED text into a prompt.

Expand-mode bounds (T-37-10): `max_depth`/`node_budget` are hardcoded
constants passed by this executor, never read from the model-authored
`arguments` -- the tool schema does not even declare a depth/budget property.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

import structlog

from app.application.use_cases.run_chat_turn_tool_loop import cap_tool_output
from app.domain.ports.knowledge_graph_repository import (
    DEFAULT_EXPAND_NODE_BUDGET,
    DEFAULT_SEARCH_LIMIT,
    MAX_EXPAND_DEPTH,
)
from app.domain.ports.tool_executor import ToolExecutionResult
from app.infrastructure.tools.envelope import build_citation, citation_to_dict, truncate_field

if TYPE_CHECKING:
    from app.domain.ports.embedding_protocol import EmbeddingProtocol
    from app.domain.ports.knowledge_graph_repository import KnowledgeGraphRepository

logger = structlog.get_logger(__name__)

SEARCH_KNOWLEDGE_TOOL_NAME = "search_knowledge"

_UNKNOWN_MODE_TEXT = 'I need a valid mode to search the knowledge graph -- use "search" or "expand".'
_EMPTY_QUERY_TEXT = "I need a search query to look through confirmed knowledge -- please provide one."
_EMPTY_NODE_ID_TEXT = "I need a node_id from a prior search result to expand from -- please provide one."
_EXECUTION_ERROR_TEXT = "I couldn't search the knowledge graph right now. Please try again."

_DESCRIPTION = (
    "Search or expand this importer's own knowledge graph of confirmed facts and suggested "
    "relationships, returning grounded, cited results. Two modes: 'search' runs a free-text query "
    "over confirmed knowledge and returns the top matches; 'expand' does a bounded neighbour walk "
    "from a node id returned by a prior search, surfacing directly related nodes and edges. Only "
    "human-confirmed knowledge ever appears as free text -- suggested or unconfirmed relationships "
    "may appear as structural entries (id, tier, confidence) with no label."
)

_INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["mode"],
    "additionalProperties": False,
    "properties": {
        "mode": {
            "type": "string",
            "enum": ["search", "expand"],
            "description": "'search' for a free-text query over confirmed knowledge; 'expand' for a bounded neighbour walk from a known node id.",
        },
        "query": {
            "type": "string",
            "maxLength": 200,
            "description": "Required when mode='search'; ignored otherwise.",
        },
        "node_id": {
            "type": "string",
            "maxLength": 100,
            "description": "Required when mode='expand' -- the seed node id, typically taken from a prior search result's node_id; ignored otherwise.",
        },
    },
}


def build_search_knowledge_tool() -> dict[str, Any]:
    """Build the search_knowledge tool dict (Bedrock-valid: root type:object, additionalProperties:false).

    Mirrors `build_lookup_entity_tool()`/`build_search_emails_tool()`'s shape
    and chat_tools.py's defense-in-depth schema conventions (maxLength bounds
    on model-authored free-text input).
    """
    return {
        "name": SEARCH_KNOWLEDGE_TOOL_NAME,
        "description": _DESCRIPTION,
        "input_schema": _INPUT_SCHEMA,
    }


def _belt_two_label(row: dict[str, object]) -> str | None:
    """The SOLE gate on a row's free-text columns -- TOOL-04 belt 2 (T-37-06).

    Returns None unless the row's OWN `tier` is EXTRACTED -- never trusts
    that the repository/view already nulled the text (a regression in belt 1
    or belt 3 alone must not leak). The single shared implementation for both
    search-mode results and expand-mode nodes, so the guarantee cannot drift
    between two copies.
    """
    if row.get("tier") != "EXTRACTED":
        return None
    return truncate_field(str(row.get("title") or row.get("content") or ""))


def _map_node_row(row: dict[str, object]) -> dict[str, object]:
    """Map one repository node row into an envelope entry, omitting `label` when belt 2 says no.

    Only the `label` key is omission-filtered -- `tier`/`confidence`/
    `source_region_id` stay present even with falsy-but-valid values
    (confidence=0.0, source_region_id=None).
    """
    label = _belt_two_label(row)
    entry: dict[str, object] = {
        "node_id": row["id"],
        "label": label,
        "tier": row["tier"],
        "confidence": row["confidence"],
        "source_region_id": row.get("scope_ref_id"),
    }
    return {key: value for key, value in entry.items() if not (key == "label" and value is None)}


def _map_edge_row(row: dict[str, object]) -> dict[str, object]:
    """Map one repository edge row into an envelope entry.

    Edges carry no free text beyond `relation_type` (a short controlled
    vocabulary) -- no truncation or belt-2 gating needed.
    """
    return {
        "edge_id": row["id"],
        "source_node_id": row["source_node_id"],
        "target_node_id": row["target_ref_id"],
        "relation_type": row["relation_type"],
        "tier": row["tier"],
        "confidence": row["confidence"],
    }


def _build_citations(node_ids: list[object]) -> list[dict[str, str]]:
    """One server-built `knowledge` citation per DISTINCT node id, first-seen order preserved."""
    distinct = list(dict.fromkeys(str(node_id) for node_id in node_ids))
    return [citation_to_dict(build_citation("knowledge", node_id)) for node_id in distinct]


class SearchKnowledgeExecutor:
    """ToolExecutor implementation for `search_knowledge` -- thin wrapper over 37-01's read side.

    Collaborators (both existing ports, zero new repository methods):
        knowledge: KnowledgeGraphRepository -- `search_nodes` (BlendedRAG,
            always-EXTRACTED belt 3) and `expand_neighbours` (bounded BFS
            through the extracted_only view, belt 1).
        embedder: EmbeddingProtocol -- embeds the raw search query for the
            vector arm; a failure here degrades to trgm-only, never fails
            the tool (T-37-08).
    """

    def __init__(self, *, knowledge: KnowledgeGraphRepository, embedder: EmbeddingProtocol) -> None:
        self._knowledge = knowledge
        self._embedder = embedder

    async def execute(self, *, name: str, arguments: dict[str, Any], importer_id: str) -> ToolExecutionResult:
        """Execute `search_knowledge` -- never raises past this boundary (port contract)."""
        del name  # unused -- this class serves exactly one tool

        mode = arguments.get("mode")
        if mode not in ("search", "expand"):
            return ToolExecutionResult(tool_use_id="", content=_UNKNOWN_MODE_TEXT, is_error=True)

        try:
            if mode == "search":
                outcome = await self._execute_search(arguments=arguments, importer_id=importer_id)
            else:
                outcome = await self._execute_expand(arguments=arguments, importer_id=importer_id)
        except Exception as exc:  # an executor MUST NEVER raise out of the loop (port contract)
            logger.warning("search_knowledge_execution_failed", mode=mode, error=str(exc))
            return ToolExecutionResult(tool_use_id="", content=_EXECUTION_ERROR_TEXT, is_error=True)

        if isinstance(outcome, ToolExecutionResult):
            return outcome
        content = cap_tool_output(json.dumps(outcome, separators=(",", ":")))
        return ToolExecutionResult(tool_use_id="", content=content, is_error=False)

    async def _execute_search(
        self, *, arguments: dict[str, Any], importer_id: str
    ) -> dict[str, Any] | ToolExecutionResult:
        """Search mode: embed (degrade-to-trgm on failure), search_nodes, map + cite."""
        query = arguments.get("query")
        if not isinstance(query, str) or not query.strip():
            return ToolExecutionResult(tool_use_id="", content=_EMPTY_QUERY_TEXT, is_error=True)

        query_embedding: list[float] | None = None
        degraded = False
        try:
            embedding = await self._embedder.embed(text=query)
            query_embedding = list(embedding)
        except Exception as exc:  # T-37-08: degrade to trgm-only, never fail, never silent
            logger.warning("search_knowledge_embedding_failed_degrading_to_trgm_only", error=str(exc))
            degraded = True

        rows = await self._knowledge.search_nodes(
            query_text=query,
            query_embedding=query_embedding,
            importer_id=importer_id,
            limit=DEFAULT_SEARCH_LIMIT,
        )

        results = [_map_node_row(row) for row in rows]
        envelope: dict[str, Any] = {
            "mode": "search",
            "results": results,
            "citations": _build_citations([result["node_id"] for result in results]),
            # Omit the key entirely when not degraded (field-omission terseness,
            # never `"embedding_degraded": false`).
            **({"embedding_degraded": True} if degraded else {}),
        }
        return envelope

    async def _execute_expand(
        self, *, arguments: dict[str, Any], importer_id: str
    ) -> dict[str, Any] | ToolExecutionResult:
        """Expand mode: bounded neighbour walk from a seed node id, map + cite.

        Depth/budget are hardcoded constants (T-37-10) -- never read from
        the model-authored `arguments`.
        """
        node_id = arguments.get("node_id")
        if not isinstance(node_id, str) or not node_id.strip():
            return ToolExecutionResult(tool_use_id="", content=_EMPTY_NODE_ID_TEXT, is_error=True)

        expansion = await self._knowledge.expand_neighbours(
            node_id=node_id,
            importer_id=importer_id,
            max_depth=MAX_EXPAND_DEPTH,
            node_budget=DEFAULT_EXPAND_NODE_BUDGET,
        )

        raw_nodes = expansion.get("nodes")
        raw_edges = expansion.get("edges")
        nodes = [_map_node_row(row) for row in raw_nodes] if isinstance(raw_nodes, list) else []
        edges = [_map_edge_row(row) for row in raw_edges] if isinstance(raw_edges, list) else []
        return {
            "mode": "expand",
            "nodes": nodes,
            "edges": edges,
            "truncated": expansion.get("truncated", False),
            "citations": _build_citations([node["node_id"] for node in nodes]),
        }


__all__ = [
    "SEARCH_KNOWLEDGE_TOOL_NAME",
    "SearchKnowledgeExecutor",
    "build_search_knowledge_tool",
]
