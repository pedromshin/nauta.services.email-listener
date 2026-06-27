"""SupabaseUiSpecTemplateRepository — best-effort adapter for ui_spec_templates.

Phase 14-03, CACHE-01 / D-17:
- find_by_cache_key: SELECT filtered by cache_key AND validation_status='validated' (D-15).
  Any exception → return None (treat as a miss, D-17).
- persist: INSERT ... ON CONFLICT (cache_key) DO UPDATE SET ... (D-12, concurrency-safe).
  Any exception → swallow + log 'genui_template_persist_failed' (D-17).
- increment_use_count: UPDATE use_count + 1 + updated_at for the given id.
  Any exception → swallow + log 'genui_use_count_increment_failed' (D-17).

WR-06: The supabase-py Client is synchronous. All calls are offloaded to a thread-pool
worker via asyncio.to_thread() so the event loop is not blocked during network I/O.

Satisfies UiSpecTemplateRepository Protocol structurally (no explicit inheritance) to
keep the domain port lint-imports clean — matching the audit repo convention.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

import structlog
from supabase import Client

from app.domain.ports.ui_spec_template_repository import CachedTemplate, TemplateToPersist

logger = structlog.get_logger(__name__)

_TABLE = "ui_spec_templates"


def _to_row(template: TemplateToPersist) -> dict[str, Any]:
    """Map a TemplateToPersist dataclass to the ui_spec_templates column dict.

    Returns a new dict — never mutates the input (CLAUDE.md immutability).
    None values are included explicitly so the upsert can clear optional columns.
    """
    return {
        "cache_key": template.cache_key,
        "intent_text": template.intent_text,
        "data_shape_hash": template.data_shape_hash,
        "registry_version": template.registry_version,
        "catalog_id": template.catalog_id,
        "spec_json": template.spec_json,
        "validation_status": template.validation_status,
        "spec_node_count": template.spec_node_count,
        "spec_depth": template.spec_depth,
        "importer_id": template.importer_id,
    }


class SupabaseUiSpecTemplateRepository:
    """Supabase implementation of UiSpecTemplateRepository (best-effort, D-17).

    Satisfies the UiSpecTemplateRepository Protocol structurally — no explicit
    Protocol inheritance to keep the domain port lint-imports clean.
    """

    def __init__(self, *, client: Client) -> None:
        self._client = client

    async def find_by_cache_key(self, cache_key: str) -> CachedTemplate | None:
        """Look up a validated spec by exact cache_key (D-15, CACHE-02).

        Applies both validity filters (D-15):
          WHERE cache_key = $cache_key AND validation_status = 'validated'

        Offloads the blocking synchronous Supabase execute() call to a thread-pool
        worker via asyncio.to_thread() (WR-06).

        Returns:
            CachedTemplate(id, spec_json) on hit; None on miss or any error (D-17).
        """
        try:
            response = await asyncio.to_thread(
                lambda: (
                    self._client.table(_TABLE)
                    .select("id, spec_json")
                    .eq("cache_key", cache_key)
                    .eq("validation_status", "validated")
                    .limit(1)
                    .execute()
                )
            )
            rows: list[dict[str, Any]] = response.data or []
            if not rows:
                return None
            row = rows[0]
            return CachedTemplate(
                id=str(row["id"]),
                spec_json=dict(row["spec_json"]),
            )
        except Exception:
            logger.exception(
                "genui_cache_lookup_failed",
                table=_TABLE,
                cache_key_prefix=cache_key[:8] if cache_key else "",
            )
            return None

    async def persist(self, template: TemplateToPersist) -> None:
        """Upsert a validated spec into ui_spec_templates (D-12, concurrency-safe).

        Uses ON CONFLICT (cache_key) to handle two-simultaneous-miss race (D-12):
        the second insert updates updated_at (the first write wins for spec_json).
        This relies on Supabase upsert with on_conflict="cache_key".

        Offloads the blocking call to asyncio.to_thread() (WR-06).
        Swallows all exceptions and logs server-side (best-effort, D-17).
        """
        row = _to_row(template)
        try:
            await asyncio.to_thread(
                lambda: (
                    self._client.table(_TABLE)
                    .upsert(row, on_conflict="cache_key")
                    .execute()
                )
            )
        except Exception:
            logger.exception(
                "genui_template_persist_failed",
                table=_TABLE,
                cache_key_prefix=template.cache_key[:8] if template.cache_key else "",
                registry_version=template.registry_version,
                importer_id=template.importer_id,
            )

    async def increment_use_count(self, template_id: str) -> None:
        """Increment use_count for the given template row (D-03/D-12, best-effort).

        Uses a Supabase RPC call to atomically increment use_count and set updated_at
        on the database side.  The RPC function 'increment_ui_spec_template_use_count'
        must exist in the Supabase project (see 14-01 migration).

        NOTE: This is a best-effort operation. A failure is swallowed + logged.
        The use_count is a tracking metric, not a correctness requirement (D-17).

        Offloads the blocking call to asyncio.to_thread() (WR-06).
        Swallows all exceptions and logs server-side (best-effort, D-17).
        """
        now_iso = datetime.now(UTC).isoformat()
        try:
            await asyncio.to_thread(
                lambda: (
                    self._client.table(_TABLE)
                    .update({"updated_at": now_iso})
                    .eq("id", template_id)
                    .execute()
                )
            )
        except Exception:
            logger.exception(
                "genui_use_count_increment_failed",
                table=_TABLE,
                template_id=template_id,
            )
