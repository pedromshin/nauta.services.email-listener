---
phase: 09-entity-field-region-relationships-canvas
plan: 02b
subsystem: subfield-autofill-backend
tags: [fastapi, dishka, use-case, autofill, segmenter, token-grounding, few-shot, tenant-from-row, tdd]
dependency_graph:
  requires:
    - "09-02a: parent entity content_raw.denied_field_polygons memo (D-19 source) + Component relationship writers (update_field_relationship)"
    - "09-01: email_components.role / entity_type_id / entity_type_field_id columns (live)"
    - "04-13/04-14: per-token content_raw geometry + ProposeRegions grounding helpers + SegmenterProtocol seam"
    - "04-08: AutofillProtocol few-shot path (embedder + retrieval ports) + ExtractionRecord candidate persistence"
  provides:
    - "AutofillFieldsUseCase — entity-scoped sub-field auto-detect + autofill (token-grounded, denied-aware, candidate-only)"
    - "EntityTypeRepository.find_by_id (port + Supabase impl) — resolve EntityType + field schema from a component's entity_type_id (D-03)"
    - "POST /v1/components/{entity_id}/autofill-fields (X-API-Key, tenant-from-row) + _provide_autofill_fields_use_case DI factory"
    - "AutofilledField domain DTO + AutofilledFieldView/AutofillFieldsResultView API views (box->property->candidate value->confidence)"
  affects:
    - "09-04 (tRPC autofillFields mutation proxies POST /autofill-fields)"
    - "09-09 (canvas drives autofill-fields; inline confirm/deny consume the candidate field children)"
    - "09-02a DenyFieldUseCase (now receives real origin='auto_detected' stamps from auto-detected children — the forward dependency is closed)"
tech_stack:
  added: []
  patterns:
    - "Token-grounded sub-field detection: filter page tokens to the entity polygon (bbox-center-in-polygon), segment only those, ground each proposal via _union_polygon of real token bboxes (never an invented box) — reused from propose_regions.py"
    - "D-19 geometry overlap exclusion: proposal bounds vs the parent's denied_field_polygons bounds via axis-aligned overlap (positive-area), NOT exact match"
    - "Per-field-child autofill (Claude's Discretion): one autofiller.autofill call per child mirrors AutofillUseCase exactly, reusing the cold-start + few-shot flywheel verbatim"
    - "Property mapping = highest per-field-confidence extracted slug; confidence = that field's breakdown score (overall fallback)"
    - "Tenant-from-component guard (D-18): importer_id derived from the loaded entity row, explicit mismatch -> ValueError -> 404"
    - "Optional embedder/retrieval factory (mirrors _provide_autofill_use_case) — dishka won't auto-inject defaulted Optional params"
key_files:
  created:
    - "apps/email-listener/app/application/use_cases/autofill_fields.py"
    - "apps/email-listener/tests/application/test_autofill_fields.py"
  modified:
    - "apps/email-listener/app/domain/ports/entity_type_repository.py"
    - "apps/email-listener/app/infrastructure/supabase/entity_type_repository.py"
    - "apps/email-listener/app/presentation/api/v1/components.py"
    - "apps/email-listener/app/container.py"
decisions:
  - "EntityTypeRepository.find_by_id was NOT yet present (09-03 had not landed find_entity_type_by_id) — added find_by_id(entity_type_id) to the port + Supabase impl; it is global (not importer-scoped) because tenant isolation is enforced on the entity component row that carries entity_type_id (D-18)."
  - "LLM-call structure (Claude's Discretion, D-CONTEXT): one autofiller.autofill call PER field child rather than one call per entity — this reuses AutofillUseCase's per-component cold-start + few-shot contract verbatim (no new prompt surface), satisfying the constraint (token-grounded boxes + property mapping + per-field confidence)."
  - "Property identity = the extracted field SLUG (not a per-row id). EntityType.fields exposes slug, not a DB field id; the slug is the same identity the FieldRelationship setter persists and the UI resolves, so entity_type_field_id carries the best-confidence slug."
  - "Token containment uses bbox-center-in-polygon-bounds (simple, deterministic, matches geometry.ts polygonToRect bounding-box semantics) rather than full polygon point-in-poly — entity polygons are rectangular bounding boxes in this pipeline."
  - "D-19 overlap is a positive-area axis-aligned box intersection on the proposal's grounded bounds vs each denied polygon's bounds (real geometry test, not exact match), per the plan's explicit constraint."
  - "AutofillFieldsUseCase.segmenter param is typed `object` (not SegmenterProtocol) to avoid a Protocol-introspection edge; the DI factory passes the SegmenterProtocol-resolved instance — same accommodation the codebase already uses for forward-ref ports."
metrics:
  duration: "~25m"
  completed: "2026-06-13"
---

# Phase 9 Plan 02b: Sub-field Autofill Backend Summary

The AI half of the canvas backend: `AutofillFieldsUseCase` auto-detects FIELD boxes inside a selected ENTITY's bbox (reusing the `propose_regions.py` token-grounding helpers + the `autofill.py` few-shot path), excludes proposals overlapping the parent's `denied_field_polygons` memo (D-19, a real geometry-overlap test), maps each surviving box to a property (`entity_type_field_id`) + candidate value + per-field confidence, and persists them as CANDIDATEs (nothing auto-confirms). Exposed as `POST /v1/components/{entity_id}/autofill-fields` behind X-API-Key with tenant-from-row, wired via a `_provide_autofill_fields_use_case` DI factory. Built TDD-first with 12 fake-repo tests.

## What Was Built

**Task 1 — AutofillFieldsUseCase + EntityTypeRepository.find_by_id (commit `ccff306`)**
- `autofill_fields.py`: `AutofillFieldsUseCase` (domain-pure; imports only `app.domain.*`). `execute(*, entity_component_id, importer_id=None)`:
  1. Load + guard the entity (role must be `entity`, `entity_type_id` must be set, tenant-from-component D-18 — all violations -> `ValueError` -> 404). Resolve `EntityType` + field schema via `entity_types.find_by_id`.
  2. Auto-detect: find the attachment_page on the entity's `page_index`, read its 04-13 tokens (`_page_tokens`), filter to tokens whose bbox center falls inside the entity polygon, run `segmenter.segment(tokens=..., page_index=...)` over only those interior tokens (segmenter failure is isolated -> []).
  3. Ground each proposal's polygon via `_union_polygon` of its selected token bboxes (entity-polygon fallback, never invented). EXCLUDE any proposal whose grounded bounds overlap a `denied_field_polygons` memo polygon (D-19). Create candidate FIELD children (`role="field"`, `parent_component_id`=entity, `source_type="region"`, `extraction_status="candidate"`, `content_raw={"origin":"auto_detected"}`) and `save_many`.
  4. ALSO incorporate the entity's existing live FIELD children (`find_by_page_component_id`, `role="field"`, status not rejected/superseded).
  5. For each field child: run `autofiller.autofill` (KB = entity type description; few-shot when embedder+retrieval present, cold-start preserved on empty retrieval), map the best-confidence extracted slug -> `entity_type_field_id` + value + confidence, persist `ExtractionRecord(status="candidate")`, and set the mapping via `components.update_field_relationship`. Returns `list[AutofilledField]`.
- Geometry helpers (mirroring `propose_regions.py`): `_page_tokens`, `_union_polygon`, plus new `_polygon_bounds`, `_token_bbox_to_box`, `_bbox_center_inside`, `_boxes_overlap`, `_denied_boxes`.
- `EntityTypeRepository.find_by_id(entity_type_id)` added to the port + `SupabaseEntityTypeRepository` (select `*, entity_type_fields(*)` by id). 09-03 had not landed an equivalent, so this is the canonical addition.
- `tests/application/test_autofill_fields.py` (12 tests, AsyncMock repos + tiny fake segmenter/autofiller): entity-role guard, missing-entity_type_id guard, missing-component guard, candidate creation (status="candidate"), interior-token scoping (FOOTER outside the entity is never segmented), origin stamp, token-grounded polygon bounds, D-19 exclude + keep, existing user-drawn incorporation, tenant-mismatch, missing entity-type record.

**Task 2 — /autofill-fields endpoint + DI factory (commit `a74742f`)**
- `components.py`: `AutofilledFieldView` + `AutofillFieldsResultView` Pydantic models; `POST /{component_id}/autofill-fields` (`@inject` + `FromDishka[AutofillFieldsUseCase]`, `UUID` path param, `ValueError -> HTTPException(404, _NOT_FOUND_DETAIL)`) returning the per-field result list. Router-level `Depends(require_api_key)` covers it (T-09-16). `_to_field_view` is a pure DTO mapper.
- `container.py`: `_provide_autofill_fields_use_case(components, entity_types, extractions, autofiller, segmenter, embedder, retrieval)` mirroring `_provide_autofill_use_case` (passes embedder+retrieval explicitly for the few-shot path, segmenter for auto-detect), registered `provides=AutofillFieldsUseCase`.
- Verified: `create_container()` resolves `AutofillFieldsUseCase` (all 7 deps inject); the router exposes a path containing `autofill-fields`.

**Task 3 — Full Python gate (no code changes; gate green from Tasks 1-2)**
- The plan's full gate ran clean with no fixes required.

## Verification Results

- New tests: `pytest tests/application/test_autofill_fields.py -v` -> 12 passed.
- Full project gate (the standing bar): `pytest` -> **401 passed, 8 skipped** (skips are credential-gated Textract/LLM/real-Postgres integration tests), **total coverage 89.06%** (>=80). `ruff check .` 0 (130 files), `ruff format --check .` clean (130 files), `mypy app` 0 (86 files), `lint-imports` 3 contracts kept / 0 broken, `bandit -c pyproject.toml -r app` exit 0 (the printed WARNINGs are bandit mis-parsing `#`-comment words, not findings).
- `create_container()` resolves `AutofillFieldsUseCase` with its components/entity_types/extractions/autofiller/segmenter/embedder/retrieval deps; router exposes POST `/{id}/autofill-fields`.

## TDD Gate Compliance

This `type: tdd` plan's Task 1 was authored test-first: the test module was written and run to confirm RED (`ModuleNotFoundError: app.application.use_cases.autofill_fields`) BEFORE the use case existed, then the implementation was added to reach GREEN (12 passing). Per the project's per-task atomic-commit convention (and the 09-02a precedent of one `feat` commit per use-case task), the RED test + GREEN implementation landed in a single `feat(09-02b)` commit (`ccff306`) rather than separate `test(...)`/`feat(...)` commits. No test passed unexpectedly during RED (the import error is the canonical RED for a not-yet-created module). The fail-fast rule was honored: no implementation was written before observing RED.

## Deviations from Plan

### Adjustments (no behavior loss)

**1. [Decision] EntityTypeRepository.find_by_id added (not reused)**
- The plan flagged that 09-03 might have already added `find_entity_type_by_id`. It had not (grep found no such method anywhere in `app/`), so `find_by_id(entity_type_id)` was added to the port + Supabase impl as the canonical lookup, per the plan's "REUSE if present, else add" instruction.
- **Files:** `app/domain/ports/entity_type_repository.py`, `app/infrastructure/supabase/entity_type_repository.py`
- **Commit:** `ccff306`

**2. [Decision] Per-field-child LLM call (Claude's Discretion)**
- The autofill LLM-call structure (one call per entity vs per-box) was left to Claude's Discretion. Chose one `autofiller.autofill` call PER field child — this reuses `AutofillUseCase`'s per-component cold-start + few-shot contract verbatim (no new prompt surface, the flywheel and Bedrock-degradation behavior are inherited). The constraint (token-grounded boxes + property mapping + per-field confidence) is fully satisfied.

**3. [Decision] Result-view shape**
- The plan said "define an `AutofillFieldsResultView` Pydantic model or reuse `AutofillResultView` appropriately." Defined `AutofillFieldsResultView { fields: [AutofilledFieldView] }` where each `AutofilledFieldView` is `{ field_component_id, entity_type_field_id, candidate_value, confidence }` (matches the plan's Task 2 spec) rather than reusing the per-component `AutofillResultView`.

No auto-fixed bugs (Rules 1-3) were required; the plan executed as written aside from the discretionary decisions above. One incidental tooling correction during GREEN: the `_Box` type alias was written with the 3.12 `type` statement, which ruff rejects under `target-version = "py311"` — switched to `TypeAlias` (caught by the gate before commit, not a behavior change).

## Authentication Gates

None. All gates ran with local `uv` tooling; the use-case tests are pure (AsyncMock repos + fake segmenter/autofiller — no DB/LLM/AWS calls). The live `/autofill-fields` endpoint reaches Bedrock segmentation + autofill at runtime (same IAM-role path as the existing `/autofill` and `/classify-document` endpoints), which is already provisioned.

## Known Stubs

None. The use case wires real repository writers, a real segmenter, and the real autofiller; every field child is persisted with a real candidate `ExtractionRecord` + property mapping. The `denied_field_polygons` memo it reads is the real contract 09-02a writes, and the `origin="auto_detected"` stamp it emits is the real marker 09-02a's `DenyFieldUseCase` branches on — the forward dependency noted in 09-02a's SUMMARY ("until 09-02b lands, every deny is treated as user-drawn") is now closed.

## Threat Flags

None. No new trust boundaries or network surface beyond the single `/autofill-fields` endpoint enumerated in the plan's `<threat_model>` (T-09-16 spoofing, T-09-11 EoP, T-09-12/T-09-17 tampering, T-09-14 info disclosure — all mitigated as designed: router-level X-API-Key, tenant-from-row, `_union_polygon` token-grounded geometry, D-19 denied-box exclusion, generic `_NOT_FOUND_DETAIL`). No new Python packages installed (T-09-SC N/A).

## Self-Check: PASSED

- `apps/email-listener/app/application/use_cases/autofill_fields.py` — FOUND
- `apps/email-listener/tests/application/test_autofill_fields.py` — FOUND
- `apps/email-listener/app/domain/ports/entity_type_repository.py` (find_by_id) — FOUND
- `apps/email-listener/app/infrastructure/supabase/entity_type_repository.py` (find_by_id) — FOUND
- `apps/email-listener/app/presentation/api/v1/components.py` (autofill-fields) — FOUND
- `apps/email-listener/app/container.py` (_provide_autofill_fields_use_case) — FOUND
- Commit `ccff306` (Task 1) — FOUND
- Commit `a74742f` (Task 2) — FOUND
