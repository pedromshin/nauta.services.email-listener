---
phase: 09-entity-field-region-relationships-canvas
plan: 02a
subsystem: relationship-write-backend
tags: [fastapi, dishka, use-case, component-repository, relationship-model, deny, tenant-from-row]
dependency_graph:
  requires:
    - "09-01: email_components.role / entity_type_id / entity_type_field_id columns (live)"
  provides:
    - "Component entity carries role / entity_type_id / entity_type_field_id (frozen, defaulted)"
    - "ComponentRepository.update_role / update_entity_type / update_field_relationship / clear_candidate_fields"
    - "SetComponentRoleUseCase / SetComponentEntityTypeUseCase / SetComponentFieldRelationshipUseCase (D-10/D-11)"
    - "DenyFieldUseCase — origin-aware deny (D-18) writing the D-19 denied_field_polygons memo on the parent"
    - "PATCH /v1/components/{id}/role · /entity-type · /field-relationship; POST /{id}/deny (X-API-Key, tenant-from-row)"
    - "denied_field_polygons memo contract on the parent entity component.content_raw (09-02b dependency)"
  affects:
    - "09-02b (AutofillFieldsUseCase reads parent content_raw.denied_field_polygons for D-19; stamps origin='auto_detected')"
    - "09-04 (tRPC proxies setRole/setEntityType/setFieldRelationship/denyField to these endpoints)"
tech_stack:
  added: []
  patterns:
    - "Tenant-from-component guard (D-18) — importer_id derived from the loaded row, explicit mismatch -> ValueError -> 404"
    - "Single-writer use case (NestRegionUseCase/AcceptRegionUseCase analog): load -> guard -> one repo writer -> refreshed entity"
    - "Supersede-never-mutate: user-drawn deny supersedes the ExtractionRecord; parent memo writes content_raw only (not geometry)"
    - "Pydantic Literal allow-list at the FastAPI boundary (role) + UUID path params (T-09-13)"
    - "Immutable content_raw merge helper (_append_denied_polygon) — new dict, prior memo preserved"
key_files:
  created:
    - "apps/email-listener/app/application/use_cases/set_component_relationship.py"
    - "apps/email-listener/app/application/use_cases/deny_field.py"
    - "apps/email-listener/tests/application/__init__.py"
    - "apps/email-listener/tests/application/test_set_component_relationship.py"
    - "apps/email-listener/tests/application/test_deny_field.py"
  modified:
    - "apps/email-listener/app/domain/entities/component.py"
    - "apps/email-listener/app/domain/ports/component_repository.py"
    - "apps/email-listener/app/infrastructure/supabase/component_repository.py"
    - "apps/email-listener/app/presentation/api/v1/components.py"
    - "apps/email-listener/app/container.py"
decisions:
  - "D-19 memo mechanism (Claude's Discretion): denied_field_polygons stored as a list under the PARENT entity's content_raw (Phase-6 lineage convention — content_raw is the per-component metadata sidecar), re-persisted via save_many mutating only content_raw (supersede-never-mutate)."
  - "Origin detection reads content_raw lineage origin == 'auto_detected' at BOTH the canonical nested location (content_raw.lineage.origin) and a flat top-level content_raw.origin, so whichever shape 09-02b stamps is detected; absent lineage defaults to user-drawn (safe: keep the box)."
  - "User-drawn deny supersedes the candidate via ExtractionRepository.supersede_active(component_id) (the existing D-16 primitive) rather than reconstructing/saving each ExtractionRecord — cleaner and avoids re-deriving updated_at."
  - "FieldRelationshipRequest uses parent_component_id + entity_type_field_id (PLAN.md Task 3 spec), not the 09-PATTERNS draft's entity_type_id field — the use case sets parent + property together in one write."
  - "New Component fields are defaulted (= None) so existing constructors (propose_regions/classify_document/edit_region) keep working untouched."
metrics:
  duration: "~10m"
  completed: "2026-06-13"
---

# Phase 9 Plan 02a: Relationship-Write Backend Summary

The relationship-mutation half of the canvas backend: the `Component` entity + `ComponentRepository` gained four relationship writers, three role/entity-type/field-relationship setter use cases plus an origin-aware `DenyFieldUseCase` (D-10/D-11/D-18) landed as domain-pure use cases, and four new endpoints (`PATCH /role`, `/entity-type`, `/field-relationship`; `POST /deny`) were wired on `/v1/components` behind X-API-Key with tenant-from-row. `DenyFieldUseCase` writes the `denied_field_polygons` memo onto the parent entity that 09-02b's `AutofillFieldsUseCase` reads to honor D-19.

## What Was Built

**Task 1 — Component entity + ComponentRepository writers (commit `cef5775`)**
- `component.py`: three defaulted frozen fields after `extraction_status` — `role: str | None = None`, `entity_type_id: str | None = None`, `entity_type_field_id: str | None = None` (D-01/D-03/D-04). Defaults keep existing constructors working.
- `component_repository.py` (Supabase): `_to_row` serializes the three keys; `_from_row` reads them via `.get(...)` (None default). Four new writers mirroring `update_status`/`update_parent` (single `.update(...).eq("id", id).execute()`, empty-data -> `ValueError`): `update_role`, `update_entity_type`, `update_field_relationship` (parent + field in ONE update), `clear_candidate_fields` (entity_type_field_id -> None, used by user-drawn deny).
- Port Protocol (`domain/ports/component_repository.py`): all four methods declared.

**Task 2 — Setters + origin-aware DenyField use cases (commit `eb6e4a3`)**
- `set_component_relationship.py`: `SetComponentRoleUseCase`, `SetComponentEntityTypeUseCase`, `SetComponentFieldRelationshipUseCase`. Each: load component (404 if missing) -> tenant-from-component guard (D-18) -> one repo writer -> refreshed `Component`. `role` is a `Literal["entity","field","unrelated"] | None`; all support None to clear (D-01/D-11).
- `deny_field.py`: `DenyFieldUseCase` branches on origin:
  - **auto-detected** (`content_raw` lineage origin == `auto_detected`): append the denied box's polygon to the PARENT entity's `content_raw.denied_field_polygons` (immutable merge) via `save_many`, then `update_status(id, "rejected")` (soft-reject, D-18/D-19).
  - **user-drawn** (any other / absent lineage): `clear_candidate_fields(id)` (keep geometry, clear the wrong field mapping) + `extractions.supersede_active(id)` (supersede the candidate record, D-16). Never soft-rejected — "your boxes never disappear."
  - tenant-from-component guard on every path.
- Both modules import ONLY `app.domain.*` (import-linter clean).

**Task 3 — FastAPI endpoints + DI (commit `dd28be5`)**
- `components.py`: Pydantic models `RoleRequest` (Literal allow-list, T-09-13), `EntityTypeRequest`, `FieldRelationshipRequest` (parent_component_id + entity_type_field_id). Four endpoints — `PATCH /{id}/role`, `/entity-type`, `/field-relationship`; `POST /{id}/deny` — each `@inject` + `FromDishka[...]`, `UUID` path params, `ValueError -> HTTPException(404, _NOT_FOUND_DETAIL)` (T-09-14), returning `RegionView`. Router-level `Depends(require_api_key)` covers all (T-09-10). `autofill-fields` deliberately NOT added (lands in 09-02b).
- `container.py`: imported + registered the four use cases with the simple `provider.provide(Class)` form (auto-inject ComponentRepository; DenyFieldUseCase also auto-injects ExtractionRepository).
- Smoke: `create_container()` resolves all four; router exposes role/entity-type/field-relationship/deny and NOT autofill-fields.

**Task 4 — Per-use-case tests + full gate (commit `4158003`)**
- `tests/application/test_set_component_relationship.py` (12 tests) + `tests/application/test_deny_field.py` (7 tests), all AsyncMock-repo (project convention), per-use-case named for `-k` traceability:
  - `test_set_role_*` / `test_set_entity_type_*` / `test_set_field_relationship_*`: write + None-clear + missing-404 + tenant-mismatch-404.
  - `test_deny_field_auto_detected_*`: rejected + parent `denied_field_polygons` memo (fresh + append-to-existing + top-level-origin variants).
  - `test_deny_field_user_drawn_*`: clear_candidate_fields + supersede_active, geometry untouched, NOT rejected.
  - guards: missing-component-404, tenant-mismatch-404 (nothing written).
- Added `tests/application/__init__.py` (subpackage convention, matching `tests/corpus/`).

## Verification Results

- New tests: 19 passed (`pytest tests/application/ -v`); all 19 individually selectable via `-k 'set_role or set_entity_type or set_field_relationship or deny_field'`.
- Full project gate (the standing bar): `pytest` green, **total coverage 89.84%** (>=80); `ruff check .` 0; `ruff format --check .` clean (128 files); `mypy app` 0 (85 files); `lint-imports` 3 contracts kept / 0 broken; `bandit -c pyproject.toml -r app` 0 issues.
- `create_container()` resolves the three setters + DenyFieldUseCase; router exposes `/role`, `/entity-type`, `/field-relationship`, `/deny` (autofill-fields absent — 09-02b).

## Deviations from Plan

### Adjustments (no behavior loss)

**1. [Correction] FieldRelationshipRequest field shape**
- The 09-PATTERNS.md draft showed `FieldRelationshipRequest(entity_type_id, entity_type_field_id)`, but PLAN.md Task 3 (the authoritative spec) and `SetComponentFieldRelationshipUseCase` use `parent_component_id` + `entity_type_field_id` (set parent + property together, D-04/D-11). Followed PLAN.md.

**2. [Correction] Test location**
- Existing tests live directly under `tests/` (`testpaths = ["tests"]`), but PLAN.md specifies `tests/application/test_*.py`. Created the `tests/application/` subpackage with an `__init__.py` (mirroring the existing `tests/corpus/` subpackage); pytest discovers and runs them under the `tests` testpath. No config change needed.

**3. [Style] Test framework**
- PLAN.md said "a fake ComponentRepository + ExtractionRepository"; the project's established use-case test convention is `AsyncMock` repositories (see `tests/test_edit_region_use_cases.py`). Followed the project convention for consistency and `-k`-traceability — the tests still assert exact writer calls and no-write-on-guard behavior.

No auto-fixed bugs (Rules 1–3) were required; the plan executed as written aside from the spec corrections above.

## Authentication Gates

None. All gates ran with local `uv` tooling; no external credentials required (use-case tests are pure, no DB/LLM/AWS calls).

## Known Stubs

None. Every endpoint resolves a real use case and a real repository writer; the `denied_field_polygons` memo is a real persisted contract that 09-02b consumes. The auto-detected deny path's `origin == "auto_detected"` marker is stamped by 09-02b's `AutofillFieldsUseCase` (a forward dependency, by design — documented in the deny_field module docstring); until 09-02b lands, every deny is correctly treated as user-drawn (the safe default).

## Threat Flags

None. No new trust boundaries or network surface beyond the four endpoints already enumerated in the plan's `<threat_model>` (T-09-10..T-09-15, all mitigated as designed: router-level X-API-Key, tenant-from-row, Pydantic Literal/UUID validation, generic 404 detail, origin-aware non-destructive deny). No new Python packages installed (T-09-SC N/A).

## Self-Check: PASSED

- `apps/email-listener/app/application/use_cases/set_component_relationship.py` — FOUND
- `apps/email-listener/app/application/use_cases/deny_field.py` — FOUND
- `apps/email-listener/tests/application/test_set_component_relationship.py` — FOUND
- `apps/email-listener/tests/application/test_deny_field.py` — FOUND
- `apps/email-listener/tests/application/__init__.py` — FOUND
- Commit `cef5775` (Task 1) — FOUND
- Commit `eb6e4a3` (Task 2) — FOUND
- Commit `dd28be5` (Task 3) — FOUND
- Commit `4158003` (Task 4) — FOUND
