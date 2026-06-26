---
phase: 09-entity-field-region-relationships-canvas
plan: 02b
type: tdd
wave: 3
depends_on: ["09-02a"]
files_modified:
  - apps/email-listener/app/application/use_cases/autofill_fields.py
  - apps/email-listener/app/domain/ports/entity_type_repository.py
  - apps/email-listener/app/infrastructure/supabase/entity_type_repository.py
  - apps/email-listener/app/presentation/api/v1/components.py
  - apps/email-listener/app/container.py
  - apps/email-listener/tests/application/test_autofill_fields.py
autonomous: true
requirements: []
must_haves:
  truths:
    - "D-13/D-14: POST /v1/components/{entity_id}/autofill-fields auto-detects + autofills FIELD child boxes inside an entity's bbox, persisting candidate ExtractionRecords (nothing auto-confirms)"
    - "D-15: each autofilled field child gets a candidate value + entity_type_field_id (property) + per-field confidence, feeding the few-shot flywheel on later confirm"
    - "D-19: a denied auto-detected box is remembered (entity content_raw.denied_field_polygons, written by 09-02a deny) so re-running autofill-fields does not re-propose an overlapping box"
    - "autofill-fields is behind X-API-Key (router require_api_key), derives importer_id from the entity component row, and grounds every field box in real token bboxes (never an invented polygon)"
  artifacts:
    - path: "apps/email-listener/app/application/use_cases/autofill_fields.py"
      provides: "AutofillFieldsUseCase — entity-scoped sub-field auto-detect + autofill (D-13/14/19)"
      contains: "class AutofillFieldsUseCase"
    - path: "apps/email-listener/app/presentation/api/v1/components.py"
      provides: "POST /{component_id}/autofill-fields endpoint"
      contains: "autofill-fields"
  key_links:
    - from: "apps/email-listener/app/presentation/api/v1/components.py"
      to: "AutofillFieldsUseCase"
      via: "FromDishka injection on the /autofill-fields route"
      pattern: "FromDishka\\[AutofillFieldsUseCase\\]"
    - from: "apps/email-listener/app/container.py"
      to: "AutofillFieldsUseCase"
      via: "_provide_autofill_fields_use_case factory (Optional embedder/retrieval/segmenter)"
      pattern: "_provide_autofill_fields_use_case"
    - from: "apps/email-listener/app/application/use_cases/autofill_fields.py"
      to: "entity content_raw.denied_field_polygons"
      via: "D-19 exclusion of overlapping proposals on re-run"
      pattern: "denied_field_polygons"
---

<objective>
Build the entity-scoped sub-field autofill use case (D-13/D-14/D-15/D-19): `AutofillFieldsUseCase` auto-detects FIELD boxes inside a selected entity's bbox (reusing the `propose_regions.py` token-grounding helpers + the `autofill.py` few-shot path), excludes boxes overlapping the `denied_field_polygons` memo written by 09-02a's `DenyFieldUseCase` (D-19), maps each to a property (`entity_type_field_id`) + candidate value + confidence, and persists them as CANDIDATEs (nothing auto-confirms). Expose it as `POST /v1/components/{entity_id}/autofill-fields` (X-API-Key, tenant-from-row) and wire DI.

Purpose: This is the AI half of the canvas backend, split out of the original 09-02 so each plan stays within the task budget. It builds on 09-02a's Component writers + the deny memo; 09-04 proxies this endpoint from tRPC; the canvas (09-09) drives it.

Output: `autofill_fields.py` (TDD), an entity-type-by-id lookup added to the repository, the `/autofill-fields` endpoint + the `_provide_autofill_fields_use_case` DI factory, and the full Python gate.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/09-entity-field-region-relationships-canvas/09-CONTEXT.md
@.planning/phases/09-entity-field-region-relationships-canvas/09-PATTERNS.md

<interfaces>
<!-- Source-of-truth analogs the executor replicates. Read the cited files before coding. -->
From 09-02a (this phase, prior plan):
- Component now has role / entity_type_id / entity_type_field_id (frozen). ComponentRepository has update_role / update_entity_type / update_field_relationship / clear_candidate_fields. DenyFieldUseCase writes the parent entity's `content_raw.denied_field_polygons` memo (the D-19 source AutofillFieldsUseCase reads).

From apps/email-listener/app/application/use_cases/autofill.py (AutofillUseCase):
- Tenant-from-component pattern (lines 117-122). few-shot path: embedder.embed + retrieval.find_similar_confirmed + autofiller.autofill(region_text, entity_type, knowledge_base_text, examples); persists ExtractionRecord(status="candidate", routing_reason="cold_start_autofill"|"few_shot_autofill"). Constructor takes components/entity_types/extractions/autofiller and Optional embedder/retrieval.

From apps/email-listener/app/application/use_cases/propose_regions.py:
- Grounding helpers to REUSE: `_page_tokens(component)`, `_union_polygon(boxes)`, `_FULL_PAGE_POLYGON`, `_resolve_parent`. `_build_children` shows ProposedRegion -> Component grounding (polygon = union of selected token bboxes; fall back to page polygon; never an invented box). SegmenterProtocol.segment(tokens, page_index) -> ProposedRegion list.

From apps/email-listener/app/domain/ports/entity_type_repository.py:
- Read-only today (find_by_slug, list_active). This plan adds `find_by_id(entity_type_id)` (port + Supabase impl) so the use case can resolve the EntityType + field schema from entity_type_id. NOTE: 09-03 also extends this port (write methods); if 09-03 already landed `find_entity_type_by_id`, REUSE it instead of adding a duplicate — check first and document.

From apps/email-listener/app/presentation/api/v1/components.py (after 09-02a):
- Router + endpoint idiom; `_NOT_FOUND_DETAIL`; RegionView model. The relationship + /deny endpoints already exist; add only the `/autofill-fields` POST here.

From apps/email-listener/app/container.py (after 09-02a):
- The setters + DenyFieldUseCase are registered. AutofillUseCase uses the factory `_provide_autofill_use_case` because of Optional embedder/retrieval — mirror it with `_provide_autofill_fields_use_case` passing components/entity_types/extractions/autofiller/segmenter + Optional embedder/retrieval explicitly.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: AutofillFieldsUseCase — entity-scoped sub-field auto-detect + autofill (TDD; D-13/14/19)</name>
  <behavior>
    - Given an entity component with role != 'entity' OR entity_type_id is None -> ValueError (404).
    - Given a valid entity component: gathers existing FIELD children (parent_component_id == entity id, role == 'field') AND auto-detects new field boxes inside the entity bbox via the segmenter over the page's tokens filtered to the entity's polygon (reusing _page_tokens + _union_polygon containment), EXCLUDING any box overlapping a remembered denied polygon read from the entity's content_raw.denied_field_polygons (D-19).
    - Each detected/existing field child gets an autofill candidate value + entity_type_field_id (property mapping) + per-field confidence; results persisted as ExtractionRecord(status="candidate") — nothing auto-confirms (D-14).
    - Auto-detected children are stamped content_raw origin="auto_detected" (so 09-02a DenyFieldUseCase can branch, D-18); token-grounded polygon (never invented).
    - Tenant derived from the entity component row; mismatch -> ValueError.
  </behavior>
  <read_first>
    - apps/email-listener/app/application/use_cases/autofill.py (FULL — the per-component autofill + few-shot path to call per field child; ExtractionRecord(status="candidate") persistence)
    - apps/email-listener/app/application/use_cases/propose_regions.py (FULL — _page_tokens, _union_polygon, _FULL_PAGE_POLYGON, _build_children grounding; SegmenterProtocol.segment usage; containment-by-token-bbox)
    - apps/email-listener/app/domain/ports/segmenter_protocol.py (PageToken / ProposedRegion / SegmenterProtocol signatures)
    - apps/email-listener/app/domain/ports/component_repository.py + entity_type_repository.py + extraction_repository.py + autofill_protocol.py + embedding_protocol.py + retrieval_port.py
    - 09-02a-SUMMARY.md (the denied_field_polygons memo shape DenyFieldUseCase writes — read its exact structure)
    - 09-CONTEXT.md D-13, D-14, D-19 (+ Claude's Discretion: LLM call structure, remember-denials mechanism)
    - 09-PATTERNS.md section "autofill_fields.py" (class structure, tenant derivation, structlog binding)
  </read_first>
  <action>
    Write tests FIRST in `tests/application/test_autofill_fields.py` using fake repositories/protocols (follow the existing fake-repo test style under tests/application/) covering the five behaviors above (RED), then implement `AutofillFieldsUseCase` (GREEN).

    Add a `find_by_id(entity_type_id)` lookup to EntityTypeRepository (port + Supabase impl) if 09-03 has not already added an equivalent (`find_entity_type_by_id`) — check the port first and REUSE the existing method if present (document the choice in the SUMMARY).

    Implementation: class imports ONLY domain ports/entities. Constructor takes `components, entity_types, extractions, autofiller, segmenter` and Optional `embedder, retrieval` (mirror AutofillUseCase). `execute(*, entity_component_id, importer_id=None)`:
    1. Load entity component; ValueError if missing, if role != "entity", or if entity_type_id is None. Tenant-from-component guard. Resolve the EntityType + its field schema via the by-id lookup. The field schema drives property mapping.
    2. Load the page tokens for the entity's page (find the attachment_page / parent on the same page_index); reuse `_page_tokens`. Filter to tokens whose bbox falls inside the entity polygon (containment via bbox-center-in-polygon or bbox-intersection — add a small geometry helper). Run `segmenter.segment(tokens=..., page_index=...)` to get candidate sub-regions; EXCLUDE proposals overlapping any remembered denied polygon read from the entity's content_raw.denied_field_polygons (D-19).
    3. Ground each proposal's polygon via `_union_polygon` of its selected token bboxes (fall back to entity polygon). Create FIELD child Components (role="field", parent_component_id=entity id, source_type="region", extraction_status="candidate", content_raw stamped `{"origin": "auto_detected"}`); persist via `save_many`. ALSO include any existing user-drawn FIELD children of the entity.
    4. For each field child, run the autofill path (autofiller.autofill with the entity type description as KB + few-shot when embedder/retrieval present) to get a candidate value, map it to the best `entity_type_field_id` (property), and a confidence; persist an ExtractionRecord(status="candidate") per child and set the child's `entity_type_field_id` via `components.update_field_relationship`. Return a result view listing each field child id + property + candidate value + confidence.
    LLM-call structure (one call per entity returning box->property->value, vs per-box) is Claude's Discretion — document the choice; constraint: token-grounded boxes + property mapping + per-field confidence.
  </action>
  <verify>
    <automated>cd apps/email-listener && python -m pytest tests/application/test_autofill_fields.py -v 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `tests/application/test_autofill_fields.py` exists with named tests asserting: entity-role+entity_type_id guard raises on invalid input; valid entity produces >=1 candidate field child with status="candidate"; auto-detected children stamped origin="auto_detected"; a proposal overlapping a denied_field_polygons memo is excluded (D-19); tenant mismatch raises.
    - `pytest tests/application/test_autofill_fields.py -v` is GREEN.
    - AutofillFieldsUseCase imports only `app.domain.*` (import-linter clean in Task 3).
    - No box geometry is invented — every field child polygon is a union of real token bboxes or the entity polygon fallback (reuses _union_polygon).
  </acceptance_criteria>
  <done>AutofillFieldsUseCase auto-detects + autofills entity sub-fields as candidates, token-grounded, origin-stamped, denied-aware; covered by fake-repo tests (TDD).</done>
</task>

<task type="auto">
  <name>Task 2: Wire the /autofill-fields endpoint + DI factory</name>
  <read_first>
    - apps/email-listener/app/presentation/api/v1/components.py (after 09-02a — the relationship + /deny endpoints already exist; add only /autofill-fields)
    - apps/email-listener/app/container.py (after 09-02a — `_provide_autofill_use_case` is the analog factory for the Optional embedder/retrieval ports)
    - the AutofillFieldsUseCase from Task 1
    - 09-PATTERNS.md section "components.py (modify)" (autofill-fields endpoint signature; AutofillResultView)
  </read_first>
  <action>
    In `components.py`: add an `@router.post("/{component_id}/autofill-fields")` endpoint (`@inject`, `FromDishka[AutofillFieldsUseCase]`, ValueError->404 with `_NOT_FOUND_DETAIL`) that calls `use_case.execute(entity_component_id=str(component_id))` and returns the autofill-fields result view (a list of `{ field_component_id, entity_type_field_id, candidate_value, confidence }` — define an `AutofillFieldsResultView` Pydantic model or reuse AutofillResultView appropriately). `from uuid import UUID` path param.

    In `container.py`: add `_provide_autofill_fields_use_case(components, entity_types, extractions, autofiller, segmenter, embedder, retrieval) -> AutofillFieldsUseCase` mirroring `_provide_autofill_use_case` (passing embedder+retrieval explicitly so the few-shot path is active; segmenter passed for auto-detect), registered via `provider.provide(_provide_autofill_fields_use_case, provides=AutofillFieldsUseCase)`. Import AutofillFieldsUseCase at the top.
  </action>
  <verify>
    <automated>cd apps/email-listener && python -c 'from app.container import create_container; create_container(); print("container ok")' && python -c 'from app.presentation.api.v1.components import router; paths=[r.path for r in router.routes]; assert any("autofill-fields" in p for p in paths); print("autofill-fields route ok")'</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n 'autofill-fields' apps/email-listener/app/presentation/api/v1/components.py` shows the route wired with `@inject` + `FromDishka[AutofillFieldsUseCase]`.
    - `grep -nE '_provide_autofill_fields_use_case|AutofillFieldsUseCase' apps/email-listener/app/container.py` shows the factory + registration.
    - `create_container()` succeeds (AutofillFieldsUseCase resolves its components/entity_types/extractions/autofiller/segmenter/embedder/retrieval deps).
    - The router exposes a path containing `autofill-fields`.
  </acceptance_criteria>
  <done>FastAPI exposes POST /{id}/autofill-fields (X-API-Key via router); DI resolves AutofillFieldsUseCase with the few-shot ports.</done>
</task>

<task type="auto">
  <name>Task 3: Full Python gate</name>
  <read_first>
    - apps/email-listener/pyproject.toml (the project's gate config: ruff/mypy/import-linter/bandit/pytest commands)
    - 09-02b Tasks 1-2 outputs
  </read_first>
  <action>
    Run the full project gate and fix any failures introduced by this plan. Do NOT lower the existing >=80% coverage bar; the TDD test from Task 1 plus the existing suite must keep total coverage >=80%.
  </action>
  <verify>
    <automated>cd apps/email-listener && ruff check app && ruff format --check app && mypy app && lint-imports && bandit -r app -q && python -m pytest -q --cov=app --cov-report=term-missing 2>&1 | tail -25</automated>
  </verify>
  <acceptance_criteria>
    - ruff (check + format --check), mypy, lint-imports (import-linter), bandit all exit 0.
    - `pytest --cov=app` reports >=80% total coverage and all tests pass (including test_autofill_fields.py).
    - AutofillFieldsUseCase imports only `app.domain.*` (import-linter clean).
  </acceptance_criteria>
  <done>autofill-fields backend passes the full Python gate; coverage >=80%.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client -> tRPC -> FastAPI /v1/components/{id}/autofill-fields | Untrusted caller crosses into the listener; X-API-Key is an installation-wide principal (D-18). |
| caller-supplied importer_id | NEVER trusted — tenant is derived from the loaded entity component row. |
| LLM segmenter/autofiller output | Untrusted model output grounded to real token bboxes (never an invented polygon). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-16 | Spoofing | /autofill-fields endpoint | mitigate | Router-level `dependencies=[Depends(require_api_key)]` covers POST /autofill-fields — no anonymous access. |
| T-09-11 | Elevation of Privilege | tenant from caller input | mitigate | AutofillFieldsUseCase derives importer_id from the loaded entity component row (tenant-from-component pattern); a caller-supplied importer_id mismatch raises ValueError -> 404. |
| T-09-12 | Tampering | LLM-invented box geometry | mitigate | Field-box polygons are `_union_polygon` of real token bboxes (or entity-polygon fallback) — reused from propose_regions.py; no model-invented coordinates persisted. The entity bbox + page_index drive token filtering. |
| T-09-17 | Tampering | re-proposing a denied box | mitigate | D-19: proposals overlapping the entity's content_raw.denied_field_polygons memo are excluded on re-run, so a denied auto-detected box does not reappear. |
| T-09-14 | Information Disclosure | error detail leakage | mitigate | The endpoint returns the generic `_NOT_FOUND_DETAIL`; full context logged server-side via structlog. |
| T-09-SC | Tampering | npm/pip/cargo installs | mitigate | No new Python packages installed (structlog/dishka/fastapi/pydantic already present); package legitimacy gate N/A. |
</threat_model>

<verification>
- `create_container()` resolves AutofillFieldsUseCase with its few-shot + segmenter ports.
- Router exposes POST /{id}/autofill-fields under /v1/components.
- test_autofill_fields.py is GREEN (entity guard, candidate creation, origin stamp, D-19 exclusion, tenant mismatch).
- ruff/format/mypy/lint-imports/bandit exit 0; pytest >=80% coverage.
</verification>

<success_criteria>
- D-13/D-14: autofill-fields auto-detects + autofills entity sub-fields as token-grounded CANDIDATEs (nothing auto-confirms).
- D-15: per-field property + candidate value + confidence persisted, feeding the flywheel on confirm.
- D-19: denied auto-detected boxes (parent memo) excluded from re-run.
- All writes behind X-API-Key; tenant-from-row; Python gate green.
</success_criteria>

<output>
Create `.planning/phases/09-entity-field-region-relationships-canvas/09-02b-SUMMARY.md` when done
</output>
