---
phase: 09-entity-field-region-relationships-canvas
plan: 02a
type: execute
wave: 2
depends_on: ["09-01"]
files_modified:
  - apps/email-listener/app/domain/ports/component_repository.py
  - apps/email-listener/app/domain/entities/component.py
  - apps/email-listener/app/infrastructure/supabase/component_repository.py
  - apps/email-listener/app/application/use_cases/set_component_relationship.py
  - apps/email-listener/app/application/use_cases/deny_field.py
  - apps/email-listener/app/presentation/api/v1/components.py
  - apps/email-listener/app/container.py
  - apps/email-listener/tests/application/test_set_component_relationship.py
  - apps/email-listener/tests/application/test_deny_field.py
autonomous: true
requirements: []
must_haves:
  truths:
    - "D-10/D-11: a component's role, entity_type_id, parent_component_id, and entity_type_field_id can be set/cleared via FastAPI (PATCH /role, /entity-type, /field-relationship)"
    - "D-18: deny is origin-aware — auto-detected field box → soft-reject (status='rejected') + remembered (D-19 memo on parent); user-drawn field box → keep geometry, clear candidate value/property"
    - "All new endpoints are behind X-API-Key (router require_api_key) and derive importer_id from the loaded component row, never from caller input"
  artifacts:
    - path: "apps/email-listener/app/application/use_cases/set_component_relationship.py"
      provides: "SetComponentRoleUseCase, SetComponentEntityTypeUseCase, SetComponentFieldRelationshipUseCase (D-10/D-11)"
      contains: "class SetComponentRoleUseCase"
    - path: "apps/email-listener/app/application/use_cases/deny_field.py"
      provides: "DenyFieldUseCase — origin-aware deny (D-18, writes the D-19 memo)"
      contains: "class DenyFieldUseCase"
    - path: "apps/email-listener/app/infrastructure/supabase/component_repository.py"
      provides: "update_role / update_entity_type / update_field_relationship / clear_candidate_fields writers"
      contains: "update_role"
    - path: "apps/email-listener/app/presentation/api/v1/components.py"
      provides: "PATCH /role, /entity-type, /field-relationship; POST /{field_id}/deny endpoints"
      contains: "/field-relationship"
  key_links:
    - from: "apps/email-listener/app/presentation/api/v1/components.py"
      to: "SetComponent*UseCase / DenyFieldUseCase"
      via: "FromDishka injection on the new routes"
      pattern: "FromDishka\\[(SetComponentRoleUseCase|DenyFieldUseCase)\\]"
    - from: "apps/email-listener/app/container.py"
      to: "the new setter + deny use cases"
      via: "provider.provide(...) registration"
      pattern: "provider.provide\\((SetComponentRoleUseCase|DenyFieldUseCase)"
---

<objective>
Build the relationship-write backend (D-10/D-11/D-18): extend the `Component` entity + `ComponentRepository` with role / entity-type / field-relationship writers; add the four use cases `SetComponentRoleUseCase`, `SetComponentEntityTypeUseCase`, `SetComponentFieldRelationshipUseCase`, and the origin-aware `DenyFieldUseCase`; and expose them as new FastAPI endpoints on the existing `/v1/components` router (X-API-Key, tenant-from-row). The `DenyFieldUseCase` writes the `denied_field_polygons` memo onto the parent entity that `AutofillFieldsUseCase` (09-02b) reads to honor D-19.

Purpose: This is the relationship-mutation half of the canvas backend, split out of the original 09-02 so each plan stays within the task budget. 09-02b adds the sub-field autofill use case on top of these writers; 09-04 proxies all of these endpoints from tRPC.

Output: extended Component entity + ComponentRepository (four new writers), `set_component_relationship.py` (three setters), `deny_field.py` (DenyFieldUseCase), the four PATCH/POST endpoints + DI registrations, and per-use-case fake-repo unit tests.
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
From apps/email-listener/app/domain/entities/component.py:
- `@dataclass(frozen=True) class Component` with fields: id, email_id, importer_id, attachment_id, parent_component_id, source_type, location(dict), content_text, content_markdown, content_raw, embedding, sequence_index, extraction_status. NO role/entity_type_id/entity_type_field_id yet — Task 1 adds them (frozen — use dataclasses.replace for updates).

From apps/email-listener/app/infrastructure/supabase/component_repository.py:
- `_to_row` / `_from_row` map domain<->DB; table "email_components". Existing writers: `update_status(component_id, status)`, `update_parent(component_id, parent_id)`, `save_many(components)`, `find_by_id`, `find_by_email_id`, `find_by_page_component_id`. All return refreshed entities and raise ValueError on no-match.

From apps/email-listener/app/application/use_cases/autofill.py (AutofillUseCase):
- Tenant-from-component pattern (lines 117-122): `if importer_id is not None and component.importer_id != importer_id: raise ValueError(...)`; then `importer_id = component.importer_id`.

From apps/email-listener/app/application/use_cases/edit_region.py:
- NestRegionUseCase / AcceptRegionUseCase — the closest single-write use-case analog (load component, guard, call one repo writer, return refreshed entity, ValueError on missing).

From apps/email-listener/app/domain/ports/extraction_repository.py:
- `find_by_component_id` + `save` — used by DenyFieldUseCase to supersede the candidate record on the user-drawn deny path.

From apps/email-listener/app/presentation/api/v1/components.py:
- Router: `APIRouter(prefix="/v1/components", dependencies=[Depends(require_api_key)])`. `_NOT_FOUND_DETAIL = "Component not found"`. Endpoint idiom: `@router.post|patch(...)` + `@inject` + `FromDishka[UseCase]` + try/except ValueError->HTTPException(404, _NOT_FOUND_DETAIL). Existing models: AutofillRequest, RegionView. `from uuid import UUID` path params.

From apps/email-listener/app/container.py:
- `provider.provide(UseCaseClass)` auto-injects ports for simple use cases (see AcceptRegionUseCase etc.). The setters + DenyFieldUseCase have no Optional ports -> register with the simple `provider.provide(Class)` form.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend Component entity + ComponentRepository with role/entity-type/field-relationship writers</name>
  <read_first>
    - apps/email-listener/app/domain/entities/component.py (add the 3 frozen fields)
    - apps/email-listener/app/domain/ports/component_repository.py (add the new Protocol methods)
    - apps/email-listener/app/infrastructure/supabase/component_repository.py (implement — `_to_row`/`_from_row` + the existing `update_status`/`update_parent` writers are the analog)
    - 09-PATTERNS.md sections "Tenant-from-Component Pattern" and "Drizzle Nullable FK Column Pattern"
    - 09-01-SUMMARY.md (confirms the live DB columns role / entity_type_id / entity_type_field_id exist)
  </read_first>
  <action>
    Add three fields to the frozen `Component` dataclass: `role: str | None`, `entity_type_id: str | None`, `entity_type_field_id: str | None` (place them after `extraction_status`; give them `= None` defaults so existing constructors that omit them still work, preferring defaults to avoid touching propose_regions/classify_document constructors). Update `_to_row` to serialize the three new keys (`role`, `entity_type_id`, `entity_type_field_id`) and `_from_row` to read them with `.get(...)` defaulting to None.

    Add to the `ComponentRepository` Protocol AND `SupabaseComponentRepository`: `update_role(component_id, role)` -> UPDATE `{"role": role}` returning refreshed Component (ValueError on no-match, like `update_status`); `update_entity_type(component_id, entity_type_id)` -> UPDATE `{"entity_type_id": entity_type_id}`; `update_field_relationship(component_id, parent_component_id, entity_type_field_id)` -> UPDATE both `parent_component_id` + `entity_type_field_id` in one call; `clear_candidate_fields(component_id)` -> UPDATE `{"entity_type_field_id": None}` (used by user-drawn deny, D-18). Each mirrors the existing `update_status`/`update_parent` Supabase writer exactly (same `.update(...).eq("id", id).execute()` + empty-data -> ValueError guard).
  </action>
  <verify>
    <automated>cd apps/email-listener && ruff check app/domain/entities/component.py app/infrastructure/supabase/component_repository.py app/domain/ports/component_repository.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE 'role|entity_type_id|entity_type_field_id' apps/email-listener/app/domain/entities/component.py` shows the three new frozen fields.
    - `grep -nE 'update_role|update_entity_type|update_field_relationship|clear_candidate_fields' apps/email-listener/app/domain/ports/component_repository.py apps/email-listener/app/infrastructure/supabase/component_repository.py` shows all four methods in BOTH the port and the impl.
    - `_to_row` writes role/entity_type_id/entity_type_field_id; `_from_row` reads them with None defaults.
    - ruff exits 0 on the three files.
  </acceptance_criteria>
  <done>Component carries role/entity_type_id/entity_type_field_id; repository can write each (and clear field candidate), mirroring update_status/update_parent.</done>
</task>

<task type="auto">
  <name>Task 2: Three relationship setters + origin-aware DenyField use cases (D-10/D-11/D-18)</name>
  <read_first>
    - apps/email-listener/app/application/use_cases/autofill.py (tenant-from-component pattern lines 117-122; imports-only-domain-ports architecture contract)
    - apps/email-listener/app/application/use_cases/edit_region.py (the simple status/parent use-case shape — NestRegionUseCase / AcceptRegionUseCase analogs)
    - apps/email-listener/app/domain/ports/component_repository.py (the writers added in Task 1)
    - apps/email-listener/app/domain/ports/extraction_repository.py (find_by_component_id + save, for superseding the candidate record on user-drawn deny)
    - 09-CONTEXT.md D-10, D-11, D-18, D-19
    - 09-PATTERNS.md sections "Tenant-from-Component Pattern", "FastAPI ValueError -> 404 Pattern"
  </read_first>
  <action>
    New module `set_component_relationship.py` with three classes (imports ONLY domain ports/entities per the architecture contract; structlog binding like autofill.py):
    - `SetComponentRoleUseCase`: load component (ValueError 404 if missing), apply tenant-from-component guard, call `components.update_role(component_id, role)`; `role` is `Literal["entity","field","unrelated"] | None` (None clears to unclassified, D-01). Returns the refreshed Component.
    - `SetComponentEntityTypeUseCase`: same shape, calls `components.update_entity_type(component_id, entity_type_id)`; `entity_type_id` may be None to clear.
    - `SetComponentFieldRelationshipUseCase`: same shape, calls `components.update_field_relationship(component_id, parent_component_id, entity_type_field_id)` (both may be None).

    New module `deny_field.py` with `DenyFieldUseCase` (D-18 origin-aware, writes the D-19 memo): load the FIELD component; determine origin — auto-detected when the component's `content_raw` carries `origin == "auto_detected"` (stamped by AutofillFieldsUseCase in 09-02b); user-drawn otherwise. For auto-detected: call `components.update_status(component_id, "rejected")` (soft-reject; D-18) AND record the rejection memo for D-19 (append the denied box's canonical polygon to the PARENT entity component's `content_raw.denied_field_polygons` list via a repository write — keep the memo on the parent so a 09-02b re-run can read it; document the chosen mechanism in the SUMMARY per Claude's Discretion). For user-drawn: keep geometry, call `components.clear_candidate_fields(component_id)` to clear `entity_type_field_id`, and supersede the candidate ExtractionRecord (status -> "superseded") so the wrong value/property is cleared and the box reverts to unclassified-with-geometry. Tenant-from-component guard on every path.
  </action>
  <verify>
    <automated>cd apps/email-listener && ruff check app/application/use_cases/set_component_relationship.py app/application/use_cases/deny_field.py && lint-imports 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE 'class SetComponentRoleUseCase|class SetComponentEntityTypeUseCase|class SetComponentFieldRelationshipUseCase' apps/email-listener/app/application/use_cases/set_component_relationship.py` shows all three.
    - `grep -n 'class DenyFieldUseCase' apps/email-listener/app/application/use_cases/deny_field.py` present; deny branches on origin (auto_detected -> update_status rejected + denied_field_polygons memo on parent; user-drawn -> clear_candidate_fields + supersede candidate record + geometry untouched).
    - Both modules import ONLY from `app.domain.*` (no `app.infrastructure.*`) — confirmed by import-linter.
    - Every use case applies the tenant-from-component guard (`if importer_id is not None and component.importer_id != importer_id`).
  </acceptance_criteria>
  <done>Role/entity-type/field-relationship setters + origin-aware deny exist as domain-pure use cases honoring D-10/D-11/D-18 (+ the D-19 memo) with tenant-from-row.</done>
</task>

<task type="auto">
  <name>Task 3: Wire FastAPI endpoints + DI registrations</name>
  <read_first>
    - apps/email-listener/app/presentation/api/v1/components.py (the router + endpoint idiom; AutofillRequest/RegionView models; ValueError->404 pattern)
    - apps/email-listener/app/container.py (_build_provider; the simple provider.provide(Class) form used by the edit_region use cases)
    - the two new use-case modules from Task 2
    - 09-PATTERNS.md section "components.py (modify)" (Pydantic models RoleRequest/EntityTypeRequest/FieldRelationshipRequest; endpoint signatures)
  </read_first>
  <action>
    In `components.py`: add Pydantic request models `RoleRequest(role: Literal["entity","field","unrelated"] | None = None)`, `EntityTypeRequest(entity_type_id: str | None = None)`, `FieldRelationshipRequest(parent_component_id: str | None = None, entity_type_field_id: str | None = None)`. Add endpoints (all `@inject`, `FromDishka[...]`, ValueError->404 with `_NOT_FOUND_DETAIL`, return RegionView): `@router.patch("/{component_id}/role")`, `@router.patch("/{component_id}/entity-type")`, `@router.patch("/{component_id}/field-relationship")`, `@router.post("/{component_id}/deny")` (DenyFieldUseCase; returns RegionView). Use `from uuid import UUID` path params (T-06 UUID-leak guard already in place). No per-endpoint auth — the router-level `Depends(require_api_key)` covers all. (The `/autofill-fields` endpoint is added in 09-02b.)

    In `container.py`: register `provider.provide(SetComponentRoleUseCase)`, `SetComponentEntityTypeUseCase`, `SetComponentFieldRelationshipUseCase`, `DenyFieldUseCase` (simple auto-inject like the edit_region use cases). Import the four use cases at the top of container.py.
  </action>
  <verify>
    <automated>cd apps/email-listener && python -c 'from app.container import create_container; create_container(); print("container ok")' && python -c 'from app.presentation.api.v1.components import router; paths=[r.path for r in router.routes]; assert any("role" in p for p in paths) and any("entity-type" in p for p in paths) and any("field-relationship" in p for p in paths) and any("deny" in p for p in paths); print("routes ok")'</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE '/role|/entity-type|/field-relationship|/deny' apps/email-listener/app/presentation/api/v1/components.py` shows all four new routes wired with @inject + FromDishka.
    - `grep -nE 'SetComponentRoleUseCase|SetComponentEntityTypeUseCase|SetComponentFieldRelationshipUseCase|DenyFieldUseCase' apps/email-listener/app/container.py` shows all four registered.
    - The container-build smoke (`create_container()`) succeeds — all four new use cases resolve their dependencies.
    - The router exposes paths containing `role`, `entity-type`, `field-relationship`, and `deny` (NOT `autofill-fields` — that lands in 09-02b).
  </acceptance_criteria>
  <done>FastAPI exposes PATCH /role, /entity-type, /field-relationship and POST /deny (X-API-Key via router); DI resolves the setter + deny use cases.</done>
</task>

<task type="auto">
  <name>Task 4: Per-use-case relationship + deny tests + Python gate</name>
  <read_first>
    - apps/email-listener/tests/application/ (existing fake-repo test style for set/deny tests)
    - apps/email-listener/pyproject.toml (the project's gate config: ruff/mypy/import-linter/bandit/pytest commands)
    - the use cases from Task 2 + the endpoints from Task 3
  </read_first>
  <action>
    Write `tests/application/test_set_component_relationship.py` and `tests/application/test_deny_field.py` with PER-USE-CASE test functions (a fake ComponentRepository + ExtractionRepository) so a single use-case regression is individually traceable:
    - `test_set_role_*`: SetComponentRoleUseCase writes via update_role; tenant-mismatch raises; missing component 404s; None clears the role.
    - `test_set_entity_type_*`: SetComponentEntityTypeUseCase writes via update_entity_type; None clears; tenant guard.
    - `test_set_field_relationship_*`: SetComponentFieldRelationshipUseCase writes parent + entity_type_field_id together; both-None clears; tenant guard.
    - `test_deny_field_auto_detected_*`: DenyFieldUseCase on an origin="auto_detected" box -> update_status("rejected") + denied_field_polygons memo appended to the parent.
    - `test_deny_field_user_drawn_*`: DenyFieldUseCase on a user-drawn box -> clear_candidate_fields + candidate ExtractionRecord superseded + box geometry untouched (no status change to rejected).
    Then run the full project gate and fix any failures. Do NOT lower the existing >=80% coverage bar.
  </action>
  <verify>
    <automated>cd apps/email-listener && python -m pytest -v -k 'set_role or set_entity_type or set_field_relationship or deny_field' 2>&1 | tail -30 && ruff check app && ruff format --check app && mypy app && lint-imports && bandit -r app -q && python -m pytest -q --cov=app --cov-report=term-missing 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `pytest -v -k 'set_role'` passes the role-setter tests (write + tenant + 404 + clear) as named functions.
    - `pytest -v -k 'set_entity_type'` and `pytest -v -k 'set_field_relationship'` each pass their named per-use-case tests.
    - `pytest -v -k 'deny_field'` passes BOTH `test_deny_field_auto_detected_*` (rejected + parent memo) and `test_deny_field_user_drawn_*` (cleared value + superseded record + geometry untouched) — the origin-aware branch is individually traceable.
    - ruff (check + format --check), mypy, lint-imports, bandit all exit 0; `pytest --cov=app` >=80% and green.
  </acceptance_criteria>
  <done>Each setter and both deny branches are individually tested and traceable via `-k`; ruff/mypy/import-linter/bandit clean; pytest >=80%.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client -> tRPC -> FastAPI /v1/components | Untrusted caller input crosses into the listener; X-API-Key is an installation-wide principal (D-18). |
| caller-supplied importer_id | NEVER trusted — tenant is derived from the loaded component row. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-10 | Spoofing | new /v1/components relationship endpoints | mitigate | Router-level `dependencies=[Depends(require_api_key)]` covers PATCH /role, /entity-type, /field-relationship and POST /deny — no anonymous access. |
| T-09-11 | Elevation of Privilege | tenant from caller input | mitigate | Every setter + deny derives importer_id from the loaded component row (tenant-from-component pattern); a caller-supplied importer_id mismatch raises ValueError -> 404. |
| T-09-13 | Tampering | input validation at boundary | mitigate | Pydantic models constrain `role` to a Literal allowlist; UUID path params via `from uuid import UUID`; entity_type_id/entity_type_field_id are str|None. |
| T-09-14 | Information Disclosure | error detail leakage | mitigate | All endpoints return the generic `_NOT_FOUND_DETAIL`; full context logged server-side via structlog (Phase 6 pattern). |
| T-09-15 | Repudiation | destructive deny on user-drawn box | mitigate | Origin-aware deny: user-drawn boxes keep geometry (clear value/property only); only auto-detected boxes are soft-rejected — "your boxes never disappear; the AI's guesses do." |
| T-09-SC | Tampering | npm/pip/cargo installs | mitigate | No new Python packages installed (structlog/dishka/fastapi/pydantic already present); package legitimacy gate N/A. |
</threat_model>

<verification>
- `create_container()` resolves the three setters + DenyFieldUseCase.
- Router exposes /role, /entity-type, /field-relationship, /deny under /v1/components (autofill-fields is 09-02b).
- ruff/format/mypy/lint-imports/bandit exit 0; pytest >=80% with the per-use-case test modules green.
- Use-case modules import only `app.domain.*` (import-linter clean).
</verification>

<success_criteria>
- D-10/D-11: role + entity_type_id + parent + entity_type_field_id settable/clearable via FastAPI, tenant-from-row.
- D-18: origin-aware deny (auto-detected -> rejected + parent memo; user-drawn -> keep box, clear value/property).
- All writes behind X-API-Key; per-use-case tests pass; Python gate green.
</success_criteria>

<output>
Create `.planning/phases/09-entity-field-region-relationships-canvas/09-02a-SUMMARY.md` when done
</output>
