"""UiSpecTemplateRepository port — domain abstraction for the exact-match UI spec cache.

Phase 14-03, CACHE-01 / D-17:
- find_by_cache_key: exact + validity-filtered lookup (D-15); any error → None (miss).
- persist: upsert validated spec into ui_spec_templates (D-12, ON CONFLICT cache_key).
- increment_use_count: increment use_count on a hit row (D-03/D-12).

D-17 contract enforced at the adapter level:
- persist and increment_use_count are best-effort (swallow+log, never raise).
- find_by_cache_key treats any lookup error as a miss (returns None, never raises).

CachedTemplate and TemplateToPersist are frozen dataclasses (immutable, CLAUDE.md).
No infrastructure imports are permitted in this module — this is a pure domain port.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class CachedTemplate:
    """Immutable result of a cache hit — the fields needed to serve the response (D-15).

    id: Primary key of the matched ui_spec_templates row (used for use_count increment).
    spec_json: The full validated SpecRoot JSON, ready to be returned to the caller.
    """

    id: str
    spec_json: dict[str, Any]


@dataclass(frozen=True)
class TemplateToPersist:
    """Immutable write payload for persisting a validated spec to ui_spec_templates (D-10/D-11).

    All fields map directly to the ui_spec_templates columns (14-01 schema).

    cache_key: SHA-256 hex from compute_cache_key (D-04) — the ON CONFLICT target.
    intent_text: Canonical (D-05 normalised) intent — stored plaintext for v1.2 retrieval (D-10).
    data_shape_hash: SHA-256 of the value-free shape descriptor (D-06).
    registry_version: Catalog content hash (D-07) — the invalidation lever (D-13).
    catalog_id: Per-catalog seam, defaults to 'global' in v1.1 (D-08 / SEAM-03).
    spec_json: The full validated SpecRoot JSON (D-11 — only validated specs are ever persisted).
    validation_status: Always 'validated' in v1.1 (D-11, DB CHECK enforces this).
    spec_node_count: Optional node count from _count_nodes walker (D-10 metadata).
    spec_depth: Optional depth from _count_nodes walker (D-10 metadata).
    importer_id: Tenant scope UUID; None for system-level generations (D-08 / D-10).
    """

    cache_key: str
    intent_text: str
    data_shape_hash: str
    registry_version: str
    catalog_id: str
    spec_json: dict[str, Any]
    validation_status: str = "validated"
    spec_node_count: int | None = None
    spec_depth: int | None = None
    importer_id: str | None = None


class UiSpecTemplateRepository(Protocol):
    """Port for the exact-match UI spec cache (CACHE-01, D-17).

    Implementations must honour the best-effort contract (D-17):
    - find_by_cache_key: any lookup error → return None (treat as a miss).
    - persist: failures are logged server-side and swallowed — never raises.
    - increment_use_count: failures are logged server-side and swallowed — never raises.
    """

    async def find_by_cache_key(self, cache_key: str) -> CachedTemplate | None:
        """Look up a validated spec by its exact cache_key (D-15).

        Applies both filters:
          WHERE cache_key = $cache_key AND validation_status = 'validated'

        Returns:
            CachedTemplate with id + spec_json on a hit; None on a miss or any error.

        Must not raise under any circumstance — errors are treated as misses (D-17).
        """
        ...

    async def persist(self, template: TemplateToPersist) -> None:
        """Upsert a validated spec into ui_spec_templates (D-12, ON CONFLICT cache_key).

        Uses ON CONFLICT (cache_key) to handle concurrent misses safely (D-12):
        two simultaneous cold generations will not error or duplicate.

        Must not raise under any circumstance — failures are swallowed+logged (D-17).
        """
        ...

    async def increment_use_count(self, template_id: str) -> None:
        """Increment use_count for the given template row (D-03/D-12, best-effort).

        Called on every cache hit to track reuse frequency for v1.2 promotion (D-03).

        Must not raise under any circumstance — failures are swallowed+logged (D-17).
        """
        ...
