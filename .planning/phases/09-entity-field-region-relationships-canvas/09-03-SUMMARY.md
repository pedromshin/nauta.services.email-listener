---
phase: 09-entity-field-region-relationships-canvas
plan: 03
subsystem: entity-type-management-backend
tags: [fastapi, dishka, use-case, crud, pydantic-validation, delete-guard, slug-uniqueness, tdd, x-api-key]
dependency_graph:
  requires:
    - "09-02b: EntityTypeRepository.find_by_id (port + Supabase impl) — extended here with the write methods, not duplicated"
    - "09-01: email_components.entity_type_field_id column (D-04 FK) — the delete-guard counts confirmed references against it"
    - "04 (Phase 4): entity_types + entity_type_fields tables seeded with 8 system types (importer_id NULL) — no new tables"
  provides:
    - "EntityTypeRepository write surface: create/update entity types; create/update/delete/reorder fields; deactivate_field; count_confirmed_references (D-27 delete-guard)"
    - "manage_entity_types use cases (Create/Update entity type + Create/Update/Delete/Reorder field) enforcing the field_type allowlist + per-type slug uniqueness + the confirmed-reference delete-guard"
    - "NEW /v1/entity-types FastAPI write router (X-API-Key) — the backend the 09-04 tRPC write router + 09-07 /entity-types page depend on"
    - "DeleteFieldResult DTO + DeleteFieldView API view (hard_deleted vs soft_deactivated outcome surfaced to the UI)"
  affects:
    - "09-04 (tRPC entity-types write mutations proxy POST/PATCH/DELETE /v1/entity-types)"
    - "09-07 (/entity-types management page drives this router)"
tech_stack:
  added: []
  patterns:
    - "Port extension (not duplication): 09-02b's find_by_id stays; the new write methods are appended to the same Protocol + Supabase impl"
    - "Slug-conflict signalling: Postgres unique-violation SQLSTATE 23505 (APIError.code) -> ValueError carrying a 'slug exists' marker -> 409 at the endpoint (D-27, T-09-22)"
    - "Delete-guard (Claude's Discretion -> SOFT-DEACTIVATE): count_confirmed_references > 0 -> deactivate_field (config.is_active=False, keeps the D-04 FK target); zero -> hard delete (D-27, T-09-23)"
    - "is_identifier persisted into entity_type_fields.config jsonb (not a column) — matches the live 739ea1d mapping + D-27 Claude's Discretion"
    - "field_type allowlist enforced twice (defense in depth, T-09-21): Pydantic field_validator at the router boundary + ALLOWED_FIELD_TYPES re-check in the use case"
    - "ValueError -> 409 (slug marker) or 404 (otherwise) via a NoReturn _raise_for_value_error helper; generic detail to the client, structlog server-side (T-09-24)"
    - "Six manage use cases auto-inject EntityTypeRepository (simple provider.provide — no factory needed)"
key_files:
  created:
    - "apps/email-listener/app/application/use_cases/manage_entity_types.py"
    - "apps/email-listener/app/presentation/api/v1/entity_types.py"
    - "apps/email-listener/tests/application/test_manage_entity_types.py"
    - "apps/email-listener/tests/test_entity_types_api.py"
  modified:
    - "apps/email-listener/app/domain/ports/entity_type_repository.py"
    - "apps/email-listener/app/infrastructure/supabase/entity_type_repository.py"
    - "apps/email-listener/app/main.py"
    - "apps/email-listener/app/container.py"
decisions:
  - "Delete-guard policy (Claude's Discretion, D-27): SOFT-DEACTIVATE on confirmed references > 0 (config.is_active=False) rather than a hard block. Non-destructive + reversible, and never orphans the D-04 FK; the DeleteFieldResult/DeleteFieldView reports the outcome so the UI can explain why the field was kept. Zero references -> hard delete."
  - "EXTENDED 09-02b's find_by_id rather than duplicating it (per the upstream note). Added find_entity_type_by_id as the 09-03 plan's named alias delegating to find_by_id, so the management use cases load the field schema before a write without a second lookup method."
  - "Slug-conflict detection uses the Postgres unique-violation SQLSTATE (23505) read off postgrest APIError.code, translated to a 'slug exists' ValueError marker. The use case ALSO pre-checks per-type field-slug uniqueness against the loaded entity type's fields (clean 409 before the insert); the DB UNIQUE(importer_id, slug) is the backstop for entity-type slugs."
  - "is_identifier kept in entity_type_fields.config jsonb (not promoted to a column) — D-27 Claude's Discretion; the create/update writers merge {is_identifier: <bool>} into config immutably."
  - "Added a thin FastAPI router integration test (tests/test_entity_types_api.py) using the existing mock-DI test-client harness even though total coverage was already >=80% — it directly exercises the 409/404/422 mapping + the delete-guard response body (T-09-21/22/23/24), lifting entity_types.py local coverage 68% -> 90%."
metrics:
  duration: "~14m"
  completed: "2026-06-13"
---

# Phase 9 Plan 03: Entity-Type & Property Management Backend Summary

Made the read-only `EntityTypeRepository` write-capable and exposed entity-type + field CRUD through a NEW FastAPI router `/v1/entity-types` (D-26), with the D-27 validation + integrity guards: `field_type` constrained to `{string,number,date,array,object}`, per-entity-type slug uniqueness, and a delete-guard that soft-deactivates (never hard-deletes) a field still referenced by a confirmed component's `entity_type_field_id` (the D-04 FK). System-default entity types (`importer_id` NULL) are editable; per-importer overrides stay out of scope. No new tables — `entity_types` + `entity_type_fields` already exist, seeded with 8 system types. This is the backend the 09-04 tRPC write router and the 09-07 `/entity-types` page depend on; it is independent of 09-02 (different files: `entity_types.py` vs `components.py`).

## What Was Built

**Task 1 — EntityTypeRepository write-capable (commit `f2216cd`)**
- `app/domain/ports/entity_type_repository.py`: extended the Protocol (09-02b's `find_by_id` untouched) with `create_entity_type`, `update_entity_type`, `find_entity_type_by_id`, `create_field`, `update_field`, `deactivate_field`, `delete_field`, `reorder_fields`, `count_confirmed_references` — documented the `'slug exists'` ValueError marker contract for 409 mapping.
- `app/infrastructure/supabase/entity_type_repository.py`: implemented all writes on the system-default scope (`importer_id` NULL). Inserts via `.insert(...)`, partial updates via `.update(patch).eq("id", ...)`, `is_identifier` merged into `config` jsonb (immutable `_merged_config`), `count_confirmed_references` via an exact count (`CountMethod.exact`) on `email_components` filtered to `entity_type_field_id` + `extraction_status='confirmed'`. Postgres `23505` (off `postgrest` `APIError.code`) → `'slug exists'` ValueError. Extracted `_build_field_patch` to keep `update_field` under the branch limit.

**Task 2 — manage_entity_types use cases (TDD, commits `cde58b6` RED + `0cf9217` GREEN)**
- RED: wrote `tests/application/test_manage_entity_types.py` (14 AsyncMock tests) first; confirmed `ModuleNotFoundError` (canonical RED for a not-yet-created module) — no test passed unexpectedly.
- GREEN: `app/application/use_cases/manage_entity_types.py` (domain-pure — imports only `app.domain.*`). `ALLOWED_FIELD_TYPES = ("string","number","date","array","object")`; `CreateEntityTypeUseCase`, `UpdateEntityTypeUseCase`, `CreateFieldUseCase` (validates field_type + loads the entity type and rejects a duplicate slug before insert), `UpdateFieldUseCase` (validates field_type when provided), `DeleteFieldUseCase` (delete-guard → `DeleteFieldResult`), `ReorderFieldsUseCase`. Delete-guard policy = **soft-deactivate** on references > 0.

**Task 3 — /v1/entity-types router + mount + DI (commit `4d1496f`)**
- `app/presentation/api/v1/entity_types.py`: `APIRouter(prefix="/v1/entity-types", tags=["entity-types"], dependencies=[Depends(require_api_key)])`. Pydantic request models with a `field_type` `field_validator` (membership in `ALLOWED_FIELD_TYPES`). Endpoints: `POST ""` (create type), `PATCH /{id}` (update/deactivate), `POST /{id}/fields`, `PATCH /fields/{field_id}`, `DELETE /fields/{field_id}` (returns the guard outcome), `POST /{id}/fields/reorder`. `_raise_for_value_error` (typed `NoReturn`) maps the slug marker → 409, else → 404.
- Mounted in `app/main.py` (`app.include_router(entity_types_router)`); the six manage use cases registered in `app/container.py` via simple `provider.provide(...)` (they auto-inject the already-bound `EntityTypeRepository`).

**Task 4 — Full Python gate + router integration tests (commit `5f9ea79`)**
- Added `tests/test_entity_types_api.py` (9 tests via the existing mock-DI test-client harness): 200 create, 409 slug conflict, 404 not-found, 422 invalid field_type, hard-delete vs soft-deactivate body, reorder 200, X-API-Key required. Applied `ruff format` to the repository file.

## Verification Results

- New unit tests: `pytest tests/application/test_manage_entity_types.py` → 14 passed. Router tests: `pytest tests/test_entity_types_api.py` → 9 passed.
- Full project gate (the standing bar): `pytest` → **424 passed, 8 skipped** (skips are credential-gated Textract/LLM/real-Postgres integration tests), **total coverage 87.06%** (≥80; `entity_types.py` 90%). `ruff check app` 0, `ruff format --check app` clean (88 files), `mypy app` 0 (88 files), `lint-imports` 3 contracts kept / 0 broken (the new use case imports only `app.domain.*`), `bandit -c pyproject.toml -r app` exit 0 (printed WARNINGs are bandit mis-parsing `#`-comment words, not findings).
- `create_container()` builds and resolves all six manage use cases; the app mounts six routes under `/v1/entity-types`; the `field_type` allowlist is enforced at the Pydantic boundary; slug conflict → 409, not-found → 404.

## TDD Gate Compliance

Task 2 (`tdd="true"`) was authored test-first: `tests/application/test_manage_entity_types.py` was written and run to confirm RED (`ModuleNotFoundError: app.application.use_cases.manage_entity_types`) **before** the use case existed, committed as a `test(09-03)` commit (`cde58b6`), then the implementation reached GREEN (14 passing) in a `feat(09-03)` commit (`0cf9217`). The fail-fast rule was honored: no implementation was written before observing RED, and no test passed unexpectedly during RED. Gate sequence present in git log: `test(...)` (`cde58b6`) → `feat(...)` (`0cf9217`). No REFACTOR commit was needed.

## Deviations from Plan

### Adjustments (no behavior loss)

**1. [Decision] Delete-guard = SOFT-DEACTIVATE (Claude's Discretion, D-27)**
- The plan left "block vs soft-deactivate" to Claude's Discretion. Chose soft-deactivate (`config.is_active=False`) on confirmed references > 0 — non-destructive, reversible, preserves the D-04 FK target. Surfaced via `DeleteFieldResult`/`DeleteFieldView` (`hard_deleted` / `soft_deactivated`) so the UI can explain the guarded outcome. Zero references → hard delete.
- **Files:** `manage_entity_types.py`, `entity_types.py`. **Commits:** `0cf9217`, `4d1496f`.

**2. [Decision] EXTENDED 09-02b's find_by_id; added find_entity_type_by_id as a delegating alias**
- Per the upstream note, `find_by_id` (from 09-02b) was kept and the write methods appended. The plan's `find_entity_type_by_id` was added as a thin alias delegating to `find_by_id` so the use cases load the field schema before a write — no duplicate lookup logic.

**3. [Rule 3 - Blocking] mypy/ruff fixes during Task 1**
- `payload` dicts needed `: dict[str, Any]` annotations; the count argument needed `CountMethod.exact` (not the string `"exact"`) for the `postgrest` typed `select`; `update_field` exceeded the 12-branch ruff limit, so the scalar-column patch building was extracted into `_build_field_patch`. All caught by the gate before commit; no behavior change.

**4. [Decision] Added a router integration test though coverage was already ≥80%**
- The plan permits a thin FastAPI integration test "if the new endpoint/repo code drops coverage below the bar." Total coverage was already 86% without it, but `entity_types.py` had 0 direct coverage (68% incidental). Added `tests/test_entity_types_api.py` to directly assert the 409/404/422 mapping + the delete-guard response body (the T-09-21/22/23/24 mitigations), lifting `entity_types.py` to 90% and total to 87.06%.

No auto-fixed bugs (Rule 1) or missing-functionality additions (Rule 2) beyond the validation/guards the plan already specified. No architectural changes (Rule 4).

## Authentication Gates

None. All gates ran with local `uv` tooling; tests are pure (AsyncMock repos / mock-DI test client — no DB/LLM/AWS calls). The live `/v1/entity-types` router reaches Supabase at runtime (same client path as the existing repositories), already provisioned. No new Python packages were installed (T-09-SC N/A — fastapi/pydantic/dishka/supabase/postgrest already present).

## Known Stubs

None. The repository writers issue real Supabase insert/update/delete/count queries; the use cases enforce the real D-27 rules; the router maps real ValueError markers to 409/404 and surfaces the real delete-guard outcome. The delete-guard counts against the real `email_components.entity_type_field_id` column (the D-04 FK from 09-01).

## Threat Flags

None. No security surface beyond the `/v1/entity-types` endpoints enumerated in the plan's `<threat_model>`. All STRIDE dispositions mitigated as designed: T-09-20 (router-level X-API-Key on every route, asserted by `test_entity_types_requires_api_key`), T-09-21 (Pydantic field_type allowlist + use-case re-check), T-09-22 (DB UNIQUE + per-type pre-check → 409), T-09-23 (count_confirmed_references → soft-deactivate, never orphans the D-04 FK), T-09-24 (generic 404/409 detail to the client, full context logged via structlog server-side). No new network surface, auth path, or schema change at a trust boundary (no new tables).

## Self-Check: PASSED

- `apps/email-listener/app/application/use_cases/manage_entity_types.py` — FOUND
- `apps/email-listener/app/presentation/api/v1/entity_types.py` — FOUND
- `apps/email-listener/tests/application/test_manage_entity_types.py` — FOUND
- `apps/email-listener/tests/test_entity_types_api.py` — FOUND
- `apps/email-listener/app/domain/ports/entity_type_repository.py` (write methods) — FOUND
- `apps/email-listener/app/infrastructure/supabase/entity_type_repository.py` (write methods) — FOUND
- `apps/email-listener/app/main.py` (entity_types_router mounted) — FOUND
- `apps/email-listener/app/container.py` (six use cases registered) — FOUND
- Commit `f2216cd` (Task 1) — FOUND
- Commit `cde58b6` (Task 2 RED) — FOUND
- Commit `0cf9217` (Task 2 GREEN) — FOUND
- Commit `4d1496f` (Task 3) — FOUND
- Commit `5f9ea79` (Task 4) — FOUND
