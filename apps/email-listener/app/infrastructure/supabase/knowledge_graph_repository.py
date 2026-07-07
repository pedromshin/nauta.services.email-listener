"""SupabaseKnowledgeGraphRepository — implements KnowledgeGraphRepository port.

Persists knowledge_nodes / knowledge_node_edges rows: tiered, provenance-
carrying edges with supersede-safe (never-delete) is_active transitions.
Follows the component_repository idiom: module-level _to_row builders
wrapped in strip_nul, table().upsert/insert/update().execute() call shapes.
"""

from __future__ import annotations

from typing import Any, cast

from supabase import Client

from app.infrastructure.supabase.sanitize import strip_nul


def _node_to_row(
    *,
    importer_id: str,
    title: str,
    content: str | None,
    scope: str,
    scope_ref_id: str | None,
    scope_ref_type: str | None,
    source: str,
    tier: str,
    embedding: list[float] | None,
) -> dict[str, Any]:
    return cast(
        "dict[str, Any]",
        strip_nul(
            {
                "importer_id": importer_id,
                "title": title,
                "content": content,
                "scope": scope,
                "scope_ref_id": scope_ref_id,
                "scope_ref_type": scope_ref_type,
                "source": source,
                "tier": tier,
                "embedding": embedding,
            }
        ),
    )


def _edge_to_row(
    *,
    source_node_id: str,
    target_ref_id: str | None,
    target_ref_type: str | None,
    relation_type: str,
    tier: str,
    source: str,
    provenance: dict[str, object] | None,
) -> dict[str, Any]:
    return cast(
        "dict[str, Any]",
        strip_nul(
            {
                "source_node_id": source_node_id,
                "target_ref_id": target_ref_id,
                "target_ref_type": target_ref_type,
                "relation_type": relation_type,
                "tier": tier,
                "source": source,
                "provenance": provenance,
                "is_active": True,
            }
        ),
    )


class SupabaseKnowledgeGraphRepository:
    """Supabase implementation of KnowledgeGraphRepository.

    Tenant isolation: node writes always carry importer_id; edges have no
    importer_id column, so isolation holds transitively via
    source_node_id -> knowledge_nodes.importer_id (T-29-06).
    """

    def __init__(self, client: Client) -> None:
        self._client = client

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
        """Insert or update a knowledge_nodes row; returns the persisted node id.

        Reuses an existing active node when `find_active_node` located one for
        this (importer_id, scope, scope_ref_id) -- updates that row in place.
        Otherwise inserts a fresh row.
        """
        existing = await self.find_active_node(importer_id, scope, scope_ref_id)
        payload = _node_to_row(
            importer_id=importer_id,
            title=title,
            content=content,
            scope=scope,
            scope_ref_id=scope_ref_id,
            scope_ref_type=scope_ref_type,
            source=source,
            tier=tier,
            embedding=embedding,
        )
        if existing is not None:
            node_id = str(cast("dict[str, Any]", existing)["id"])
            self._client.table("knowledge_nodes").update(payload).eq("id", node_id).execute()
            return node_id

        result = self._client.table("knowledge_nodes").insert(payload).execute()
        if not result.data:
            raise ValueError(f"knowledge_nodes insert returned no data: importer_id={importer_id}")
        return str(cast("dict[str, Any]", result.data[0])["id"])

    async def find_active_node(
        self,
        importer_id: str,
        scope: str,
        scope_ref_id: str | None,
    ) -> dict[str, object] | None:
        query = (
            self._client.table("knowledge_nodes")
            .select("*")
            .eq("importer_id", importer_id)
            .eq("scope", scope)
            .eq("is_active", True)
        )
        query = query.eq("scope_ref_id", scope_ref_id) if scope_ref_id is not None else query.is_("scope_ref_id", "null")
        result = query.execute()
        if not result.data:
            return None
        return cast("dict[str, object]", result.data[0])

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
        payload = _edge_to_row(
            source_node_id=source_node_id,
            target_ref_id=target_ref_id,
            target_ref_type=target_ref_type,
            relation_type=relation_type,
            tier=tier,
            source=source,
            provenance=provenance,
        )
        self._client.table("knowledge_node_edges").insert(payload).execute()

    async def deactivate_edges_for_node(self, source_node_id: str) -> None:
        """Set is_active=False on all active edges for source_node_id.

        NEVER deletes rows -- supersede is a status transition, preserving
        the audit trail (T-29-05).
        """
        (
            self._client.table("knowledge_node_edges")
            .update({"is_active": False})
            .eq("source_node_id", source_node_id)
            .eq("is_active", True)
            .execute()
        )

    async def find_active_edges_for_node(self, source_node_id: str) -> list[dict[str, object]]:
        result = (
            self._client.table("knowledge_node_edges")
            .select("*")
            .eq("source_node_id", source_node_id)
            .eq("is_active", True)
            .execute()
        )
        return [cast("dict[str, object]", row) for row in result.data]
