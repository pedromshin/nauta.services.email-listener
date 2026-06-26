---
phase: 10-extracted-entity-identity-gallery-detail-4c-entity-resolutio
plan: "02"
subsystem: entity-resolution
tags: [blended-rag, rrf-fusion, entity-instances, promote, backfill, dishka]
dependency_graph:
  requires: ["10-01"]
  provides: ["10-03", "10-04"]
  affects:
    - apps/email-listener/app/container.py
    - apps/email-listener/app/main.py
    - apps/email-listener/app/presentation/api/v1/components.py
tech_stack:
  added: []
  patterns:
    - BlendedRAG with RRF(k=60) fusing dense (HNSW/Bedrock) + lexical (pg_trgm) arms
    - Dishka async DI provider with stub-container override pattern in tests
    - Best-effort post-confirm hook (D-12 graceful degradation)
    - Deterministic UUID5 idempotency for entity_instances rows
key_files:
  created:
    - apps/email-listener/app/application/use_cases/promote_entity_on_confirm.py
    - apps/email-listener/app/application/use_cases/backfill_entity_identities.py
    - apps/email-listener/app/presentation/api/v1/entity_instances.py
    - apps/email-listener/tests/test_entity_resolution.py
  modified:
    - apps/email-listener/app/presentation/api/v1/components.py
    - apps/email-listener/app/container.py
    - apps/email-listener/app/main.py
decisions:
  - "D-05 suggest-only: PromoteEntityOnConfirmUseCase surfaces candidates but never auto-merges"
  - "D-07 parallel arms: dense + lexical always run concurrently; no sequential fallback"
  - "D-09 provenance: each candidate link records match_type via _attribute_match_type tie-break (identifier_exact > alias > identifier_fuzzy)"
  - "D-10 idempotent backfill: UUID5 deterministic ID + upsert ensures safe re-runs"
  - "D-11 alias flywheel: confirmed entity aliases written back to entity_instances on each promotion"
  - "D-12 graceful degradation: best-effort try/except on confirm hook; Bedrock unavailable falls to lexical-only"
  - "from __future__ import annotations removed from entity_instances.py: Pydantic ForwardRef breaks FastAPI response serialization for generic ApiResponse[T]"
  - "structlog import moved to module level in components.py (PLC0415 compliance)"
metrics:
  duration: "~3h (multi-session)"
  completed: "2026-06-14"
  tasks_completed: 3
  files_changed: 7
---

# Phase 10 Plan 02: BlendedRAG Entity Resolution Backend Summary

BlendedRAG promotion pipeline: parallel dense+lexical arms fused by RRF(k=60), on-confirm entity promotion to `entity_instances`, idempotent D-10 backfill, and `/v1/entity-instances` REST surface — all gated behind 36 passing tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | EntityInstance entity + SupabaseEntityInstanceRepository | d661234 | domain/entities/entity_instance.py, ports/entity_instance_repository.py, infrastructure/supabase/entity_instance_repository.py |
| 2 | BlendedRAG resolution repository + ResolveEntityCandidatesUseCase | aa25781 | infrastructure/supabase/entity_resolution_repository.py, application/use_cases/resolve_entity_candidates.py |
| 3 | Promote/backfill use cases, entity-instances router, DI wiring | 023e1d9 | promote_entity_on_confirm.py, backfill_entity_identities.py, entity_instances.py, components.py, container.py, main.py, test_entity_resolution.py |

## What Was Built

**PromoteEntityOnConfirmUseCase** (`promote_entity_on_confirm.py`): On confirm, upserts the component into `entity_instances` (source=`email_extracted`) using a deterministic UUID5 ID for idempotency. Then runs `ResolveEntityCandidatesUseCase` to find top-N candidates and writes each to `component_entity_candidate_links` with per-arm provenance (D-09). Alias hits write back to `entity_instances.aliases` (D-11 flywheel).

**BackfillEntityIdentitiesUseCase** (`backfill_entity_identities.py`): Iterates all confirmed entity components for a given importer and re-runs `PromoteEntityOnConfirmUseCase.execute()` for each. Per-item errors are caught and counted — the loop always completes. Returns `{total, succeeded, failed}`.

**`/v1/entity-instances` router** (`entity_instances.py`): Two endpoints: `GET /{entity_instance_id}/candidates` (suggest-only resolution, ValueError → 404) and `POST /backfill` (idempotent corpus rebuild). Both protected by `require_api_key` at router level. Response envelope uses `ApiResponse[T]`.

**`components.py` confirm hook**: After `ConfirmRegionUseCase.execute()` succeeds, `PromoteEntityOnConfirmUseCase.execute()` is called in a `try/except Exception` block. Errors are logged as warnings via structlog but do NOT propagate — confirm always returns 200 regardless of promotion outcome (D-12).

**Container + main**: `SupabaseEntityInstanceRepository` registered as `EntityInstanceRepository`; three new use cases registered. `entity_instances_router` mounted in `main.py`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed `from __future__ import annotations` from `entity_instances.py`**
- **Found during:** Task 3 test execution
- **Issue:** `from __future__ import annotations` makes all annotations lazy `ForwardRef` strings. FastAPI's response serializer uses Pydantic's `TypeAdapter` to validate `ApiResponse[list[EntityCandidateView]]`, which fails with `PydanticUserError: not fully defined` when the ref string can't be resolved at validation time. All success-path routes returned 500.
- **Fix:** Removed `from __future__ import annotations`; used string literal `"EntityCandidate"` for the `TYPE_CHECKING`-only import in `_to_candidate_view`.
- **Files modified:** `apps/email-listener/app/presentation/api/v1/entity_instances.py`
- **Commit:** 023e1d9

**2. [Rule 2 - Missing functionality] Moved `structlog` import to module level in `components.py`**
- **Found during:** Task 3 ruff gate (`PLC0415`)
- **Issue:** `import structlog as _structlog` was inside the `except Exception:` block — ruff PLC0415 requires top-level imports.
- **Fix:** Added `import structlog` to the top-level import block; updated the inline usage to `structlog.get_logger(...)`.
- **Files modified:** `apps/email-listener/app/presentation/api/v1/components.py`
- **Commit:** 023e1d9

**3. [Rule 2 - Missing functionality] Auth tests now set `API_KEY` env var**
- **Found during:** Task 3 test execution
- **Issue:** In `ENVIRONMENT=development` with empty `API_KEY`, `require_api_key` bypasses auth. Tests expecting 401 on missing key were returning 404 (dev bypass + route mismatch) or 500.
- **Fix:** Auth test methods (`test_get_candidates_missing_api_key`, `test_backfill_missing_api_key`) now set `os.environ["API_KEY"] = "test-secret-key"` and call `get_settings.cache_clear()` before/after — following the exact pattern from `test_components_api.py`.
- **Files modified:** `apps/email-listener/tests/test_entity_resolution.py`
- **Commit:** 023e1d9

**4. [Rule 1 - Bug] Removed unused imports and unused variable in test file**
- **Found during:** Task 3 ruff gate (`F401`, `RUF059`)
- **Issue:** `uuid`, `dataclass`, `field`, `MagicMock` imported but never used; `promoted_ids` unpacked but never read.
- **Fix:** Removed unused imports; prefixed unused variable with `_promoted_ids`.
- **Files modified:** `apps/email-listener/tests/test_entity_resolution.py`
- **Commit:** 023e1d9

**5. [Rule 1 - Bug] Fixed import sort order for `PromoteEntityOnConfirmUseCase` in `components.py`**
- **Found during:** Task 3 ruff gate (`I001`)
- **Issue:** Import was inserted between `deny_field` and `edit_region` — ruff isort requires alphabetical order within the `app.application.use_cases` block (`edit_region` < `promote_entity_on_confirm` alphabetically).
- **Fix:** Moved import to after the `edit_region` block.
- **Files modified:** `apps/email-listener/app/presentation/api/v1/components.py`
- **Commit:** 023e1d9

## Gate Results

| Gate | Result |
|------|--------|
| pytest tests/test_entity_resolution.py | 36 passed, 0 failed |
| ruff check app tests | All checks passed |
| ruff format --check app tests | 142 files already formatted |
| mypy app | Success: no issues found in 96 source files |
| git diff confirm_region.py | Empty (untouched) |

## Known Stubs

None — all endpoints are wired to real use cases backed by real repositories.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new_endpoint | entity_instances.py | GET /v1/entity-instances/{id}/candidates — new read endpoint; protected by require_api_key at router level. D-05 ensures suggest-only (no writes on this path). |
| threat_flag: new_endpoint | entity_instances.py | POST /v1/entity-instances/backfill — new write-heavy endpoint; protected by require_api_key. Writes to entity_instances + component_entity_candidate_links. importer_id taken from request body, tenant isolation enforced inside use case via D-21 (row-derived importer_id). |

## Self-Check: PASSED

- [x] `apps/email-listener/app/application/use_cases/promote_entity_on_confirm.py` — exists
- [x] `apps/email-listener/app/application/use_cases/backfill_entity_identities.py` — exists
- [x] `apps/email-listener/app/presentation/api/v1/entity_instances.py` — exists
- [x] `apps/email-listener/tests/test_entity_resolution.py` — exists
- [x] Commit `d661234` — Task 1
- [x] Commit `aa25781` — Task 2
- [x] Commit `023e1d9` — Task 3
