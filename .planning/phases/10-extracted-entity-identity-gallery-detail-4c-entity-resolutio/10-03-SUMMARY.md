---
phase: 10
plan: "03"
subsystem: entity-resolution
tags: [curation, merge, reject, unmerge, human-loop, d-20, d-21, tdd]
dependency_graph:
  requires: [10-02]
  provides: [confirm-merge-use-case, reject-merge-use-case, unmerge-use-case, curation-endpoints]
  affects: [entity_instances-router, container, entity_instance_repository-port, supabase-entity-instance-impl]
tech_stack:
  added: []
  patterns: [suggest-only-d20, importer-from-row-d21, cross-importer-guard-t10-20, supersede-never-mutate, dishka-factory-pattern, tdd-red-green]
key_files:
  created:
    - apps/email-listener/app/application/use_cases/curate_entity_merge.py
    - apps/email-listener/tests/test_entity_curation.py
  modified:
    - apps/email-listener/app/domain/ports/entity_instance_repository.py
    - apps/email-listener/app/infrastructure/supabase/entity_instance_repository.py
    - apps/email-listener/app/presentation/api/v1/entity_instances.py
    - apps/email-listener/app/container.py
decisions:
  - "Direct import (not TYPE_CHECKING) for EntityInstanceRepository in curate_entity_merge.py so dishka can resolve the annotation at runtime without factory shims"
  - "provider.provide(ConfirmMergeUseCase) works directly after TYPE_CHECKING guard removed — no factory wrapper needed"
  - "No from __future__ import annotations in entity_instances.py (10-02 deviation preserved) — prevents FastAPI generic response serialization failure"
  - "Both link directions updated in select_candidate_link and dismiss_candidate_link for symmetry, regardless of which direction the row was originally written"
metrics:
  duration: "~45 min (multi-session)"
  completed: "2026-06-14"
  tasks_completed: 2
  files_modified: 6
---

# Phase 10 Plan 03: Human Curation Loop — Confirm-Merge, Reject-Merge, Unmerge (D-20) Summary

**One-liner:** Three FastAPI curation endpoints (confirm/reject/unmerge) backed by isolated use cases and extended EntityInstanceRepository port, enforcing D-21 tenant isolation and T-10-20 cross-importer guard.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | TDD RED: entity curation test suite | cff77df | tests/test_entity_curation.py |
| 1 | TDD GREEN: use cases + port + impl | cd3b311 | curate_entity_merge.py, entity_instance_repository.py (port+impl) |
| 2 | Endpoints + DI wiring | 1dcbd7f | entity_instances.py, container.py |

## What Was Built

### Use Cases (`curate_entity_merge.py`)

**ConfirmMergeUseCase.execute(entity_instance_id, target_id)**
1. Load subject → ValueError if not found (→ 404)
2. Derive `importer_id` from row (D-21 — never from caller)
3. Load target → ValueError if not found
4. Guard cross-importer merge → ValueError (T-10-20 HIGH severity)
5. `select_candidate_link` → sets `was_selected=True` on candidate link (D-09 audit trail)
6. `append_alias` → adds target's `display_name` as alias on survivor (D-11 flywheel)
7. `set_merge_state(target_id, merged_into=entity_instance_id, is_active=False)`

**RejectMergeUseCase.execute(entity_instance_id, target_id)**
1-4. Same load + guard pattern as confirm
5. `dismiss_candidate_link` → sets `was_dismissed=True` (D-20 durable dismissal)
No identity linkage written — no alias, no merge state change.

**UnmergeEntityUseCase.execute(entity_instance_id)**
1. Load instance → ValueError if not found
2. `set_merge_state(entity_instance_id, merged_into=None, is_active=True)` — reactivates, clears linkage

### Repository Port Extensions

Three new methods on `EntityInstanceRepository` Protocol:
- `select_candidate_link(*, entity_instance_id, target_id) -> None`
- `dismiss_candidate_link(*, entity_instance_id, target_id) -> None`
- `set_merge_state(entity_instance_id, *, merged_into, is_active) -> None`

### Supabase Implementation

All three methods implemented in `SupabaseEntityInstanceRepository`:
- `select_candidate_link` / `dismiss_candidate_link`: update both link directions (entity_instance_id→target_id and target_id→entity_instance_id) in `component_entity_candidate_links`
- `set_merge_state`: updates `is_active` + `merged_into` in `entity_instances`, scoped to `.eq("source", _SOURCE)` (D-21)

### Endpoints

Three new POST endpoints added to `/v1/entity-instances` router:
- `POST /{entity_instance_id}/merge/{target_id}/confirm` → `ApiResponse[MergeResultView]`
- `POST /{entity_instance_id}/merge/{target_id}/reject` → `ApiResponse[MergeResultView]`
- `POST /{entity_instance_id}/unmerge` → `ApiResponse[UnmergeResultView]`

All protected by `require_api_key`. UUID path params validated by FastAPI (T-10-23: malformed UUID → 422). ValueError → HTTPException(404).

### DI Wiring

`container.py`: Three `provider.provide()` calls auto-injecting `EntityInstanceRepository` (already bound to `SupabaseEntityInstanceRepository`).

## Test Suite (`test_entity_curation.py`)

26 tests, 100% pass rate:

| Class | Tests | Coverage |
|-------|-------|----------|
| TestConfirmMergeUseCase | 6 | subject-not-found, target-not-found, cross-importer, was_selected set, alias appended, merge-state deactivated |
| TestRejectMergeUseCase | 4 | subject-not-found, target-not-found, cross-importer, dismissed-link set |
| TestUnmergeEntityUseCase | 5 | not-found, importer from row, set_merge_state called with None/True, return dict |
| TestMergeEndpoints | 11 | 401 without API key (×3), 404 not-found (×3), 200 success (×3), cross-importer 404, malformed UUID 422 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] dishka UndefinedTypeAnalysisError from TYPE_CHECKING guard**
- **Found during:** Task 1 implementation (container.py wiring)
- **Issue:** `curate_entity_merge.py` initially used `TYPE_CHECKING` to import `EntityInstanceRepository`, making it a forward-ref string at runtime. When `provider.provide(ConfirmMergeUseCase)` tried to resolve the `__init__` annotation, dishka raised `UndefinedTypeAnalysisError`.
- **Fix:** Removed `TYPE_CHECKING` guard; kept `from __future__ import annotations` but imported `EntityInstanceRepository` unconditionally. This matches the pattern used by simpler use cases with a single port dependency.
- **Files modified:** `curate_entity_merge.py`
- **Commit:** cd3b311

**2. [Rule 3 - Blocking] Dead factory functions removed from container.py**
- **Found during:** Task 2 cleanup
- **Issue:** Three factory functions (`_provide_confirm_merge_use_case`, etc.) were created as a workaround for the TYPE_CHECKING issue but became dead code after the fix was applied.
- **Fix:** Removed the factory functions; registered use cases via `provider.provide(ConfirmMergeUseCase)` directly.
- **Files modified:** `container.py`
- **Commit:** 1dcbd7f (same commit)

## Threat Surface Scan

No new network endpoints beyond those planned in the threat model. All three endpoints are behind `require_api_key` (T-10-21). Cross-importer guard covers T-10-20. UUID path params provide T-10-23 protection via FastAPI type coercion. D-22 (repudiation) covered by structlog binds on every operation.

No new threat flags.

## Known Stubs

None — all three use cases write to real repository methods. No mock data reaches any endpoint response.

## Self-Check: PASSED

- [x] `apps/email-listener/app/application/use_cases/curate_entity_merge.py` — FOUND
- [x] `apps/email-listener/tests/test_entity_curation.py` — FOUND
- [x] Commit cff77df — FOUND (test(10-03): add failing tests)
- [x] Commit cd3b311 — FOUND (feat(10-03): implement curation use cases)
- [x] Commit 1dcbd7f — FOUND (feat(10-03): add merge endpoints + DI wiring)
- [x] 26/26 tests pass (no-cov run)
- [x] ruff check: all passed
- [x] mypy: no issues in 5 source files
