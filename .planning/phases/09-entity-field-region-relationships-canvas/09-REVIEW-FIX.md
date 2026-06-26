---
phase: 09-entity-field-region-relationships-canvas
fixed_at: 2026-06-14T06:45:00Z
review_path: .planning/phases/09-entity-field-region-relationships-canvas/09-FINAL-REVIEW.md
bundle: D2
findings_in_scope: 24
fixed: 24
skipped: 0
status: bundle_d2_fixed
bundles:
  A: { scope: [CRIT-1, CRIT-2, HIGH-3, WR-03], fixed: 4, status: bundle_a_fixed }
  B: { scope: [HIGH-1, HIGH-2, WR-01, WR-02, WR-05], fixed: 5, status: bundle_b_fixed }
  C: { scope: [MED-DEAD-TOOLBAR, LOW-UUID-BOUNDARY], fixed: 2, status: bundle_c_fixed }
  D1: { scope: [HIGH-1-AUTOFILL-DUP, HIGH-2-SYSTEM-SLUG, MEDIUM-3-FIELD-SLUG, MEDIUM-4-DENY-MEMO, LOW-5-PAGE-INDEX, TEST-DEBT], fixed: 6, status: bundle_d1_fixed }
  D2: { scope: [MEDIUM-A-NESTED-INTERACTIVE, MEDIUM-B-DRAW-NOOP, MEDIUM-C-DEACTIVATE-COPY, MEDIUM-D-LIST-OVERFETCH, MEDIUM-E-CONFIRM-INVALIDATE, LOW-DEAD-CODE], fixed: 6, status: bundle_d2_fixed }
---

# Phase 09: Gap-Closure Fix Report

**Source review:** .planning/phases/09-entity-field-region-relationships-canvas/09-ADVERSARIAL-REVIEW.md

This phase's adversarial review surfaced 2 CRITICAL + 3 HIGH defects plus warnings.
The fixes are split into bundles; **Bundle A** closes the backend + tRPC data-shape
defects (CRIT-1, CRIT-2, HIGH-3, WR-03). The canvas-wiring defects (HIGH-1, HIGH-2)
and the remaining UI warnings (WR-01/02/04/05) are out of Bundle A scope.

---

## Bundle A — backend + tRPC data shape

**Scope:** CRIT-1, CRIT-2, HIGH-3, WR-03
**Fixed:** 4 / 4
**Skipped:** 0

### CRIT-1 — Autofill wrote a field SLUG into the `entity_type_field_id` uuid FK

**Files modified:**
- `apps/email-listener/app/domain/entities/entity_type.py`
- `apps/email-listener/app/infrastructure/supabase/entity_type_repository.py`
- `apps/email-listener/app/application/use_cases/autofill_fields.py`
- tests: `tests/application/test_autofill_fields.py`, `tests/test_entity_type_repository.py`,
  and the `EntityTypeField` fixtures in `tests/test_autofill_use_case.py`,
  `tests/test_autofill_adapter.py`, `tests/test_supabase_repositories.py`,
  `tests/test_domain_entities.py`

**Commit:** 1e2d4c6

**Root cause:** `EntityTypeField` carried no `id`, so `AutofillFieldsUseCase._best_field_mapping`
returned `best_slug` and `_autofill_child` passed that slug into
`component_repository.update_field_relationship`, which writes it into the
`email_components.entity_type_field_id` **uuid FK**. Against real Postgres this fails
(an FK uuid column rejects a slug); the mock-repo suite could not catch it.

**Applied fix:**
- Added `id: str` as the first field of the frozen `EntityTypeField` dataclass (the uuid
  PK the D-04 FK references).
- `_field_from_row` now populates `id` from `row["id"]` (the `entity_type_fields(*)` join
  always returns the PK).
- `_best_field_mapping` now returns the matched field's uuid `id` — never the slug. The slug
  remains the lookup key for the LLM-extracted value; the persisted identity is the uuid.

**Resolution evidence:**
- New test `test_autofill_fields_maps_field_uuid_not_slug_into_relationship` captures the
  third positional arg of `update_field_relationship` and asserts it equals the field's uuid
  (`_FIELD_NAME_ID`) and explicitly `!= "name"` (the slug). The per-field result view mirrors
  the same uuid.
- New test `test_field_id_is_mapped_from_row` asserts the repository maps the real uuid
  (`940d3e36-…`) onto `EntityTypeField.id`.

### CRIT-2 — Soft-deactivated fields were never hidden

**Files modified:**
- `apps/email-listener/app/infrastructure/supabase/entity_type_repository.py`
- tests: `tests/test_entity_type_repository.py`

**Commit:** 1e2d4c6

**Root cause:** `deactivate_field` sets `config.is_active=false`, but `_field_from_row`
never read it, so the `entity_type_fields(*)` join in `find_by_id`/`find_by_slug`/`list_active`
returned deactivated fields. They stayed in `EntityType.fields`, were injected into the
autofill system prompt (`autofill_adapter._render_field_schema` enumerates
`entity_type.fields`), and showed in the management UI — letting the AI re-map onto a
"deleted" property.

**Applied fix:** Added `_field_is_active(row)` (a field is active unless `config.is_active`
is explicitly `False`) and filtered it in `_from_row`:
`tuple(_field_from_row(f) for f in raw_fields if _field_is_active(f))`. The active read paths
all flow through `_from_row`, so deactivated fields are dropped everywhere at once. The row
itself is untouched, preserving the D-04 FK target and the `count_confirmed_references` guard.

**Resolution evidence:**
- New test `test_deactivated_field_excluded_from_active_read_path` — a field with
  `config.is_active=False` is absent from `find_by_slug(...).fields`.
- New test `test_deactivated_field_absent_from_autofill_system_prompt` — builds the real
  autofill system prompt from the read-path result and asserts the deactivated field's slug
  does NOT appear in the prompt (while the active field does).

### HIGH-3 — Field uuid never exposed to the client; field CRUD unwireable

**Files modified:**
- `apps/email-listener/app/presentation/api/v1/entity_types.py`
- tests: `tests/test_entity_types_api.py`

**Commit:** e7bf27b

**Root cause:** `FieldView` omitted `id` and `_to_field_view` never surfaced it, so no
`/v1/entity-types` read returned a field uuid — yet `update_field`/`delete_field`/`reorder_fields`
require a uuid `field_id` path param. The client could not obtain a field id, so edit/delete/
reorder could not be driven end-to-end. (Shared root cause with CRIT-1's `EntityTypeField.id`.)

**Applied fix:** Added `id: str` to `FieldView` and `id=field.id` to `_to_field_view`. Every
field read now carries the uuid.

**End-to-end note:** The tRPC `entityTypes.list` shape already exposes the field `id`
(`packages/api-client/src/router/entity-types.ts` selects `fieldId: EntityTypeFields.id` and
`groupEntityTypeRows` emits `id`; committed earlier in `bbda632`). With this backend fix, the
field uuid is obtainable through the entire stack: Postgres → FastAPI `FieldView` → tRPC list
→ admin UI / field-relationship picker. The tRPC write router's existing
`fieldId: z.string().uuid()` validation now has a real id to validate against.

**Resolution evidence:**
- Updated `test_create_field_returns_200_for_allowed_field_type` asserts the response body
  carries `id`.
- Existing api-client vitest `entity-types.test.ts` already asserts `result[…].fields[0].id`
  (passes — 56/56 api-client tests green); `apps/web` `tsc --noEmit` exits 0 consuming the id.

### WR-03 — `UpdateFieldUseCase` skipped the per-type slug-uniqueness pre-check

**Files modified:**
- `apps/email-listener/app/domain/ports/entity_type_repository.py`
- `apps/email-listener/app/infrastructure/supabase/entity_type_repository.py`
- `apps/email-listener/app/application/use_cases/manage_entity_types.py`
- tests: `tests/application/test_manage_entity_types.py`

**Commit:** 6f1ecbc

**Root cause:** `CreateFieldUseCase` enforces per-type slug uniqueness before inserting, but
`UpdateFieldUseCase` performed no such check, so a rename could collide with a sibling field
and surface a raw DB-constraint 500 instead of a clean 409.

**Applied fix:**
- Added the `find_entity_type_by_field_id(field_id) -> EntityType | None` port method,
  implemented in the repository (reads the field row's `entity_type_id`, resolves the owning
  EntityType + active field schema via `find_by_id`).
- `UpdateFieldUseCase` now runs `_guard_slug_unique` when a new slug is supplied: it loads the
  owning entity type and raises `ValueError("field slug exists: …")` (the 409 marker) if any
  **sibling** field already holds that slug. The field being updated is excluded by `id`, so
  renaming a field to its own slug is a no-op (not a false 409). When the owning type cannot be
  resolved, the DB unique constraint remains the backstop (no false positive).

**Resolution evidence:**
- `test_update_field_rename_to_sibling_slug_raises` — collision → 409 marker, no write.
- `test_update_field_rename_to_own_slug_is_allowed` — self-rename proceeds to the write.
- `test_update_field_unique_slug_passes` — a fresh slug proceeds.
- `test_update_field_without_slug_skips_uniqueness_check` — no slug → lookup not called.

---

## Skipped Issues (Bundle A)

None — all four in-scope defects were fixed.

Out of Bundle A scope (separate bundles): HIGH-1 (canvas OverlayLayer props inert on PDF),
HIGH-2 (zero-friction drag-to-draw not wired), WR-01/02/04/05 (UI warnings), INFO-1..4.

---

## Gate Results

All gates run from `apps/email-listener/` after the three commits:

| Gate | Result |
|------|--------|
| `uv run pytest` | 432 passed, 8 skipped (AWS/LLM/integration skips) — 86.87% coverage (≥80%) |
| `uv run ruff check .` | All checks passed |
| `uv run ruff format --check .` | 134 files already formatted |
| `uv run mypy app` | Success — no issues in 88 source files |
| `uv run lint-imports` | 3 contracts kept, 0 broken |
| `uv run bandit -c pyproject.toml -r app` | High: 0, Medium: 0, Low: 0 |

api-client / web gates (HIGH-3 end-to-end consumes the field id — verified, not changed):

| Gate | Result |
|------|--------|
| `npm run build -w @nauta/api-client` | EXIT 0 |
| `npm test -w @nauta/api-client` | 56 passed (6 files) |
| `cd apps/web && npx tsc --noEmit` | EXIT 0 |

---

## Commits

| Commit | Defects | Summary |
|--------|---------|---------|
| 1e2d4c6 | CRIT-1, CRIT-2 | `EntityTypeField.id`; autofill writes field uuid into the FK; hide soft-deactivated fields from active read paths + autofill prompt |
| e7bf27b | HIGH-3 | Expose field uuid in `FieldView` so field CRUD is wireable end-to-end |
| 6f1ecbc | WR-03 | Enforce per-type slug uniqueness on field update (excluding self) |

---

_Fixed: 2026-06-14T00:50:00Z_
_Fixer: gsd plan executor (Bundle A)_
_Bundle: A (backend + tRPC data shape)_

---

## Bundle B — frontend canvas (the review loop on the PDF)

**Scope:** HIGH-1, HIGH-2, WR-01, WR-02, WR-05
**Fixed:** 5 / 5
**Skipped:** 0

Bundle B makes the Phase-9 canvas visual model actually render and operate on the
PDF. Bundle A (backend) is the dependency: `EntityTypeField`/field now carry a uuid
`id`, `entity_type_field_id` is a real uuid, and the tRPC `entityTypes.list` exposes
the field `id` + `key` (slug) Bundle B's WR-02 resolves against.

### HIGH-1 — The Phase-9 canvas visual model was inert on the PDF (D-08/D-10/D-12/D-16)

**Files modified:**
- `apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx`
- `apps/web/src/app/emails/[id]/_components/email-detail.tsx`

**Commit:** 35819e2

**Root cause:** `PdfPreviewPane`'s local `Component` type had no `role`, and its
`<OverlayLayer>` call site passed NONE of the Phase-9 props that 09-08 added to
`overlay-layer.tsx` + `region-overlay-box.tsx` (`activeParentId` / `showUnrelated` /
`confirmDenyComponentIds` / `onConfirmField` / `onDenyField`). So role colors, the
D-10 active-parent ring, D-12 anti-bloat hiding, and the D-16 inline ✓/✗ rendered
ONLY in the side LAYERS tree — never on the document.

**Applied fix:**
- Added `role?: ComponentRole` to `PdfPreviewPane`'s `Component` type (the data
  already carries `role` + `parentComponentId` from `emails.detail` / 09-04).
- Added the Phase-9 props to `PdfPreviewPaneProps` (`activeParentId`,
  `showUnrelated`, `confirmDenyComponentIds`, `autoDetectedComponentIds`,
  `onConfirmField`, `onDenyField`, `onRestoreField`) and threaded every one into
  the `<OverlayLayer>` call (OverlayLayer already forwarded them to
  RegionOverlayBox in 09-08 — the call path is now complete end to end).
- `email-detail.tsx` computes `confirmDenyComponentIds` (candidate FIELD boxes that
  carry a resolved candidate value, not confirmed/terminal) and
  `autoDetectedComponentIds` (the `content_raw` origin marker) and passes them, plus
  `activeParentId` / `showUnrelated` and the confirm/deny/restore handlers from
  `use-role-mutations`, down through `PdfPreviewPane`.

**Resolution evidence:** `cd apps/web && npx tsc --noEmit` exits 0 consuming the
threaded props; `npm run web:build` exits 0 with `/emails/[id]` rendering. The
overlay now receives role-color, active-parent-ring, D-12 visibility, and the
inline ✓/✗ inputs on the document (the props OverlayLayer/RegionOverlayBox already
render).

### HIGH-2 — Zero-friction drag-to-draw was not wired (D-08)

**Files modified:**
- `apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx`
- `apps/web/src/app/emails/[id]/_components/email-detail.tsx`

**Commit:** e805c03

**Root cause:** `PdfPreviewPane` mounted the `DrawOverlay` only when the legacy
Phase-6 `drawMode` (`redraw`/`split`/`add`) was non-null. The Phase-9 shell tool
toggle (`canvas.mode`, Select/Draw in `use-canvas-state`) never drove drawing, so
the new toolbar toggle was decorative — draw was armed only by the legacy
"+ Add region".

**Applied fix:** Added an optional `canvasMode` prop. The pane derives
`legacyDrawActive = drawMode !== null` and `drawArmed = legacyDrawActive ||
canvasMode === "draw"`; the `DrawOverlay` mount + the overlay-dimming now key off
`drawArmed`, while the `DrawModeBar` stays exclusive to the legacy flow (its UX is
redraw/split). `email-detail` passes `canvas.mode`. On rect-drawn, the existing
`handleRectDrawn` routing is preserved: a legacy flow still wins; otherwise an
active-parent drawn box becomes a FIELD child (D-10) and a no-active-parent draw
creates a standalone region.

**Resolution evidence:** With `canvas.mode === "draw"` the `DrawOverlay` mounts
(crosshair drag-to-draw); the D-10 active-parent → field-child chain is unchanged.
tsc 0; web build 0.

### WR-01 — Deny "Undo" affordance was dead; two divergent inline ✓/✗ impls

**Files modified:**
- `apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx`
- `apps/web/src/app/emails/[id]/_components/overlay-layer.tsx`
- `apps/web/src/app/emails/[id]/_components/use-role-mutations.ts` (restoreField)

**Commits:** e15eae0 (convergence), 07c0921 (restoreField, shared with WR-05)

**Root cause:** `confirm-deny-controls.tsx` (the canonical control with the D-18
origin-aware Undo toast) was never imported; the canvas instead used a duplicate
inline `<button>✓/✗</button>` block in `region-overlay-box.tsx`, and nothing
implemented the `onRestore` (rejected→candidate) undo path.

**Applied fix:**
- `region-overlay-box.tsx` now renders the canonical `ConfirmDenyControls`
  (gated on `showConfirmDeny` + both handlers) and the duplicate inline button
  block is deleted — the two divergent impls are converged on the canonical one.
  (The LAYERS-tree inline ✓/✗ in `layers-tree-row.tsx` is a *separate*,
  UI-SPEC-mandated text-row surface — §LAYERS Panel — not the canvas floating
  control; it is intentionally left in place.)
- `overlay-layer.tsx` threads `isAutoDetected` + `onRestore` to each box.
- `use-role-mutations.ts` adds `restoreField` — an optimistic un-reject
  (`rejected → candidate`) + `emails.detail` re-invalidate, wired into the undo
  toast. No server un-reject endpoint exists yet, so this is the documented partial
  per the objective: the undo affordance restores optimistic state and
  re-invalidates so the authoritative server state reconciles the cache. A true
  server-side restore (un-reject + drop the D-19 memo) is a follow-up backend
  endpoint (Rule 4 — out of this bundle's scope).

**Resolution evidence:** A single inline ✓/✗ implementation remains on the canvas
(`ConfirmDenyControls`, imported by `region-overlay-box.tsx`); the deny path now
fires the origin-aware Undo toast whose action calls `restoreField`. tsc 0.

### WR-02 — `getCandidateValue` picked `Object.entries(...)[0]` (non-deterministic)

**Files modified:**
- `apps/web/src/app/emails/[id]/_components/email-detail.tsx`

**Commit:** 035d877

**Root cause:** `getCandidateValue` returned the FIRST entry of the
`extractedFields` JSONB blob by insertion order, so a FIELD box could surface a
value for a *different* property than its mapped `entity_type_field_id`.

**Applied fix:** `getCandidateValue(extractedFields, fieldKey)` now selects the
value by the mapped property's slug. `email-detail` resolves the field uuid → its
slug via a new `fieldIdToKey` map (uuid → `entity_type_fields.slug`, exposed as
`key` on the tRPC `entityTypes.list` shape from Bundle A) and a `fieldKeyFor`
helper, then indexes `extractedFields[slug]`. All three call sites (layers rows,
the inspector's candidate value, and the `candidateFieldIds` filter) pass the
resolved key. An UNMAPPED box only surfaces a value when the blob has exactly one
entry (a safe, unambiguous default) — never an arbitrary pick from a multi-property
blob.

**Resolution evidence:** mapped FIELD boxes select by slug deterministically; tsc 0.

### WR-05 — Optimistic deny transiently marked user-drawn boxes `rejected`

**Files modified:**
- `packages/api-client/src/router/emails/detail.ts` (expose `content_raw`)
- `apps/web/src/app/emails/[id]/_components/use-role-mutations.ts`

**Commit:** 07c0921

**Root cause:** `denyFieldMutation.onMutate` optimistically set
`extractionStatus: "rejected"` for EVERY deny, so a user-drawn box momentarily
disappeared from the canvas before the server-reconciled invalidate — contradicting
"your boxes never disappear; the AI's guesses do" (D-18).

**Applied fix:**
- Exposed `email_components.content_raw` through `emails.detail` so the client can
  read the lineage origin marker the backend stamps (`{ origin: "auto_detected" }`,
  recognized by `DenyFieldUseCase`).
- `isAutoDetectedOrigin(content_raw)` mirrors the server's check (nested
  `lineage.origin` Phase-6 convention + flat top-level `origin`).
- `denyField.onMutate` now branches on origin: an **auto-detected** box optimistically
  soft-rejects (leaves the default view); a **user-drawn** box keeps its geometry and
  status and only clears `entity_type_field_id` + `extractedFields` (reverts to
  unclassified-with-box). The post-success invalidate reconciles the authoritative
  outcome either way.

**Resolution evidence:** `npm run build -w @nauta/api-client` exits 0;
`npm test -w @nauta/api-client` 56/56 green; `cd apps/web && npx tsc --noEmit` 0.
A user-drawn deny no longer flips the box to `rejected` in the optimistic cache.

---

## Skipped Issues (Bundle B)

None — all five in-scope defects were fixed.

Documented partial (per objective): WR-01's `restoreField` delivers the Undo
affordance via an optimistic un-reject + re-invalidate; a full server-side restore
(un-reject + drop the D-19 rejection memo) is a follow-up backend endpoint.

Out of Bundle B scope: INFO-1..4 (label lag, candidate-record supersede, reorder
atomicity, residual dead code / dual-toolbar deferral) remain as documented
non-blocking follow-ups.

---

## Gate Results (Bundle B)

| Gate | Result |
|------|--------|
| `cd apps/web && npx tsc --noEmit` (after each fix) | EXIT 0 |
| `npm run web:build` (full next build) | EXIT 0 — `/emails/[id]` renders the wired canvas |
| `npm run build -w @nauta/api-client` (detail.ts touched) | EXIT 0 |
| `npm test -w @nauta/api-client` | 56 passed (6 files) |

---

## Commits (Bundle B)

| Commit | Defects | Summary |
|--------|---------|---------|
| 07c0921 | WR-05 (+ WR-01 restoreField) | origin-aware optimistic deny; expose content_raw; add restoreField |
| 035d877 | WR-02 | resolve candidate value by mapped field slug, not insertion order |
| e15eae0 | WR-01 | converge inline ✓/✗ on canonical ConfirmDenyControls + undo |
| 35819e2 | HIGH-1 | render role colors / active-parent ring / D-12 hide / inline ✓/✗ ON THE PDF |
| e805c03 | HIGH-2 | shell Draw tool arms drag-to-draw on the canvas |

---

_Fixed: 2026-06-14T04:07:00Z_
_Fixer: gsd plan executor (Bundle B)_
_Bundle: B (frontend canvas)_

---

## Bundle C — dead toolbar controls + overlay source-of-truth + UUID boundary

**Scope:** MED-DEAD-TOOLBAR, LOW-UUID-BOUNDARY (the 2 non-blocking residuals from the
gap-fix re-verification CLEARED verdict)
**Fixed:** 2 / 2
**Skipped:** 0

Bundle C closes the two residuals that survived Bundle A+B re-verification: the
CanvasShell toolbar's dead/no-op PDF controls (with the divergent "Show regions"
state), and the one backend type that let a malformed id reach Postgres.

### MED — Dual toolbar with DEAD controls + broken "Show regions" (D-06)

**Files modified:**
- `apps/web/src/app/emails/[id]/_components/canvas-toolbar.tsx`
- `apps/web/src/app/emails/[id]/_components/canvas-shell.tsx`
- `apps/web/src/app/emails/[id]/_components/email-detail.tsx`
- `apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx`

**Commit:** a139aaf

**Root cause:** The CanvasShell `CanvasToolbar` was rendered from `email-detail` with
`numPages={null}`, `scale={1}`, and zoom/fit/page-nav handlers that were no-ops
(`() => undefined`). That produced a perpetual "Loading…" page label, a permanently
disabled Next button, and dead zoom %/Fit buttons — a second, non-functional copy of
the PDF controls whose real, working versions live inside PdfPreviewPane's own toolbar
(which owns the `numPages`/`scale` state). Separately, "Show regions" had TWO sources of
truth: the shell's `showRegions` state vs PdfPreviewPane's pane-local `showOverlays`, so
the shell switch did NOT hide the on-PDF overlays.

**Applied fix (minimal remove-dead-controls path):**
- `canvas-toolbar.tsx` — removed the page-nav, zoom %, and Fit control groups (and their
  now-unused props/icons: `currentPage`/`numPages`/`onPrevPage`/`onNextPage`/`scale`/
  `onZoomIn`/`onZoomOut`/`onZoomReset`/`onFitWidth`/`onFitPage`/`zoomMin`/`zoomMax`, plus the
  `ChevronLeft`/`ChevronRight`/`ZoomIn`/`ZoomOut` imports). The toolbar now renders ONLY the
  controls that genuinely work at the shell level: the Select/Draw tool toggle (V/S/D
  keybindings retained) and the Regions/History/Unrelated view toggles, plus close.
- `canvas-shell.tsx` — dropped the dead page/zoom prop pass-through; updated the layout
  docstring to note page/zoom/Fit live in the pane.
- `email-detail.tsx` — stopped passing the dead `numPages`/`scale`/no-op handlers to
  CanvasShell.
- **Single source of truth for overlays:** the shell's `showRegions` state is now lifted
  down to PdfPreviewPane as the controlled read-only `showOverlays` prop. PdfPreviewPane's
  pane-local `useState` copy AND its own duplicate "Show regions" toggle are deleted, so the
  shell "Regions" switch is the only control and it actually toggles the on-PDF overlay layer
  (`style={{ display: showOverlays ? … : "none" }}`).
- **Unrelated:** the shell "Unrelated" toggle continues to drive `showUnrelated` →
  PdfPreviewPane → OverlayLayer `showUnrelated` (the Bundle-B path), unchanged and not
  regressed. The working pane zoom/draw/page-sync and the Bundle-B canvas overlay are
  untouched.

**Resolution evidence:** `cd apps/web && npx tsc --noEmit` exits 0; `npm run web:build`
exits 0 with `/emails/[id]` rendering. Zero dead/no-op controls remain in the editor
toolbars — every visible shell control performs a real action. The change is a net
−210/+31 lines (deletions of the dead controls + the divergent state).

### LOW — Manual-override endpoint lacked server-side UUID validation (D-04)

**Files modified:**
- `apps/email-listener/app/presentation/api/v1/components.py`
- tests: `tests/test_components_api.py`

**Commit:** 548ef41

**Root cause:** `FieldRelationshipRequest.entity_type_field_id` and `.parent_component_id`
were typed `str | None`, so a malformed value passed Pydantic and reached the
`email_components` uuid FK columns in Postgres (entity_type_field_id → the D-04 FK,
parent_component_id → the self-FK), where it would surface as a raw DB error rather than a
clean client-side rejection.

**Applied fix:** Both fields are now typed `UUID | None` at the Pydantic boundary, so a
malformed id → 422 before reaching the use case / Postgres. The
`SetComponentFieldRelationshipUseCase` still operates on plain `str` ids, so the route
coerces each UUID with `str(...)` (and passes `None` through unchanged for the D-11 clear
path). Friendly 422 at the boundary; detailed context still logged server-side inside the
use case.

**Resolution evidence (TDD — RED then GREEN):**
- New `test_field_relationship_malformed_field_id_returns_422` and
  `test_field_relationship_malformed_parent_id_returns_422` — a non-uuid id → 422 and the
  use case `execute` is NOT called (verified the boundary rejects before dispatch). Both
  failed (returned 200) before the type change, pass after.
- New `test_field_relationship_valid_uuids_returns_200` — a well-formed pair reaches the use
  case as str-coerced kwargs (asserts `isinstance(..., str)`).
- New `test_field_relationship_null_ids_clear_relationship` — both null → 200, use case sees
  `None` (D-11 clear path preserved).

---

## Skipped Issues (Bundle C)

None — both in-scope residuals were fixed.

Out of Bundle C scope: INFO-1..4 remain as documented non-blocking follow-ups. The
pre-existing unused `emailId` prop on `CanvasShell` was left untouched (outside the
dead-toolbar-controls scope; not a visible control).

---

## Gate Results (Bundle C)

Frontend (after the toolbar commit):

| Gate | Result |
|------|--------|
| `cd apps/web && npx tsc --noEmit` | EXIT 0 |
| `npm run web:build` (api-client + next build) | EXIT 0 — `/emails/[id]` renders |

Backend (full suite, after the UUID commit):

| Gate | Result |
|------|--------|
| `uv run pytest` | 436 passed, 8 skipped (AWS/LLM/integration skips) — 86.97% coverage (≥80%) |
| `uv run ruff check .` | All checks passed |
| `uv run ruff format --check .` | 134 files already formatted |
| `uv run mypy app` | Success — no issues in 88 source files |
| `uv run lint-imports` | 3 contracts kept, 0 broken |
| `uv run bandit -c pyproject.toml -r app` | High: 0, Medium: 0, Low: 0 |

---

## Commits (Bundle C)

| Commit | Defects | Summary |
|--------|---------|---------|
| 548ef41 | LOW-UUID-BOUNDARY | validate field-relationship ids as UUID at the API boundary (422 on malformed) |
| a139aaf | MED-DEAD-TOOLBAR | remove dead canvas-shell toolbar controls + unify Show-regions (single source of truth) |

---

_Fixed: 2026-06-14T05:30:00Z_
_Fixer: gsd plan executor (Bundle C)_
_Bundle: C (dead toolbar controls + overlay source-of-truth + UUID boundary)_

## Self-Check (Bundle C): PASSED

- Files verified on disk: components.py, test_components_api.py, canvas-toolbar.tsx,
  canvas-shell.tsx, email-detail.tsx, pdf-preview-pane.tsx, 09-REVIEW-FIX.md, STATE.md.
- Commits verified in git log: 548ef41 (LOW UUID boundary), a139aaf (MED dead toolbar),
  9ce3db0 (docs). No file deletions across the bundle.

---

## Bundle D1 — backend final-review fixes (the 2 confirmed HIGH + genuine MEDIUM/LOW + test-debt)

**Source review:** `.planning/phases/09-entity-field-region-relationships-canvas/09-FINAL-REVIEW.md`
**Scope:** HIGH-1 (autofill dup), HIGH-2 (system slug), MEDIUM-3 (field slug), MEDIUM-4
(deny memo), LOW-5 (page index), backend TEST-DEBT
**Fixed:** 6 / 6
**Skipped:** 0

Bundle D1 closes the backend defects surfaced by the full final review (the frontend
HIGH-3 "apps/web has no tests" is a documented follow-up, NOT in scope). The 0014/0015
migrations are LOCAL-ONLY here — see the deploy follow-up below.

### HIGH-1 — Autofill double-processed auto-detected children

**Files:** `apps/email-listener/app/application/use_cases/autofill_fields.py`;
tests `tests/application/test_autofill_fields.py`
**Commit:** 7373d53

**Root cause:** `execute` built `all_children = persisted (auto-detected) + existing`, and
`_existing_field_children` excluded only `rejected`/`superseded` — NOT `candidate`. The
real Supabase `find_by_page_component_id` REFLECTS the rows `save_many` just persisted, so
every freshly auto-detected box (status `candidate`, origin `auto_detected`) was read back
and autofilled a SECOND time → 2x LLM cost, duplicate `ExtractionRecord`s + relationship
writes + UI entries. The original unit test masked it with a STATIC empty mock.

**Applied fix:**
- De-duplicate `all_children` by `child.id` (order-preserving `_dedupe_by_id`) before the
  autofill loop, so each box is autofilled EXACTLY once.
- Defense-in-depth: `_existing_field_children` now also excludes the just-persisted ids AND
  any row whose `content_raw.origin == 'auto_detected'` (`_child_origin`), so the reflected
  read can never re-surface a machine box.

**Resolution evidence:** new regression test
`test_autofill_fields_autofills_each_child_exactly_once_when_repo_reflects_saved_rows` uses a
REFLECTING mock (`find_by_page_component_id` returns the saved rows) and asserts exactly one
LLM call, one `extractions.save`, one `update_field_relationship`. A second test
(`..._dedupes_when_existing_read_includes_persisted_child`) covers the mixed user-drawn +
auto-detected case (2 distinct → exactly 2 of each). **Both FAIL against the pre-fix code**
(verified by temporarily reverting: `field_count=3`, the same component autofilled twice).

### HIGH-2 — `CreateEntityTypeUseCase` slug-uniqueness inoperative for system defaults

**Files:** `apps/email-listener/app/application/use_cases/manage_entity_types.py`;
`packages/db/src/schema/entity-types.ts`; `packages/db/migrations/0014_fresh_marvel_apes.sql`;
tests `tests/application/test_manage_entity_types.py`
**Commit:** 74d3a9e

**Root cause:** No app-level pre-check existed, and the DB `UNIQUE(importer_id, slug)` never
collides on `NULL importer_id` (`NULL != NULL`), so duplicate SYSTEM entity types persisted
silently and the repo's 23505→409 path was dead for system types.

**Applied fix (both):**
- (a) `CreateEntityTypeUseCase.execute` now pre-checks `find_by_slug(None, slug)` (the existing
  port method, no new method needed) BEFORE the insert and raises the `slug exists` marker → 409.
- (b) Partial unique index `uniq_entity_types_system_slug ON entity_types (slug) WHERE
  importer_id IS NULL` via the Drizzle schema route (`uniqueIndex(...).on(slug).where(sql\`...IS NULL\`)`),
  generated as migration 0014 and applied local. Fixed the stale `entity-types.ts` comment that
  claimed a NULLS-NOT-DISTINCT migration which never existed.

**Resolution evidence:** `test_create_entity_type_duplicate_system_slug_precheck_raises`
(pre-check fires, `create_entity_type` never awaited); `..._db_backstop_raises` (TOCTOU path
still 409s). Index verified live: `WHERE (importer_id IS NULL)` predicate present + a duplicate
system-slug insert is rejected at the DB.

### MEDIUM-3 — Field slug uniqueness had no DB constraint (TOCTOU only)

**Files:** `packages/db/src/schema/entity-types.ts`; migration 0014
**Commit:** 74d3a9e (folded into the same migration)

**Applied fix:** Added `UNIQUE(entity_type_id, slug)` (Drizzle `unique(...)`) on
`entity_type_fields` — the real backstop behind the existing app-level pre-checks (which stay
for the friendly 409). Index verified live.

### MEDIUM-4 — Denial-memo write was a full-row read-modify-upsert (lost-update)

**Files:** `apps/email-listener/app/application/use_cases/deny_field.py`;
`app/domain/ports/component_repository.py`;
`app/infrastructure/supabase/component_repository.py`;
`packages/db/migrations/0015_denied_polygon_append_rpc.sql`;
tests `tests/application/test_deny_field.py`, `tests/test_supabase_repositories.py`
**Commit:** 618c399

**Root cause:** `_deny_auto_detected` read the parent, appended to
`content_raw["denied_field_polygons"]`, and `save_many` full-row upserted → concurrent denies
lose entries (last writer wins).

**Applied fix:** Added a narrow `ComponentRepository.append_denied_polygon(component_id, polygon)`
port method + Supabase impl delegating to a new `append_denied_polygon` Postgres function
(migration 0015) that performs the append as a SINGLE atomic `UPDATE … SET content_raw =
jsonb_set(coalesce(content_raw,'{}'), '{denied_field_polygons}', coalesce(…,'[]') ||
jsonb_build_array(polygon))`. `DenyFieldUseCase` now calls it (no parent re-read). Removed the
dead immutable `_append_denied_polygon` helper + unused `dataclasses` import.

**Resolution evidence:** two PARALLEL `append_denied_polygon` calls on a real local row both
survive (count=2 — atomic, no lost update). Unit tests assert the atomic call
(`append_denied_polygon(parent_id, polygon)`), that the parent is NOT re-read, and that
`save_many` is never called on this path.

### LOW-5 — `_coerce_page_index` mapped a float page_index (2.0) to 0

**Files:** `apps/email-listener/app/application/use_cases/autofill_fields.py`; test added
**Commit:** 7373d53

**Root cause:** `str(2.0).isdigit()` is `"2.0".isdigit()` == False, so a float page_index
collapsed to 0.

**Applied fix:** coerce numerically first — `int(raw)` for int/float (bool excluded),
`int(float(text))` for numeric strings. `test_coerce_page_index_handles_float` asserts
`2.0 → 2`, `"3" → 3`, missing → 0.

### Backend TEST-DEBT — the CRIT-1 "fake-repo hides a real-row 500" class

**Files:** tests `tests/test_supabase_repositories.py`, `tests/test_components_api.py`
**Commits:** 618c399 (repo shape), 6016e7c (route integration)

- **Real-row-shape tests** for the new `ComponentRepository` write methods
  (`update_role`/`update_entity_type`/`update_field_relationship`/`clear_candidate_fields`/
  `append_denied_polygon`) MagicMock the supabase client and assert the EXACT payload column
  KEYS (role, entity_type_id, both FK columns) / RPC param keys, so a column/shape drift fails
  the test (mirrors the prior data_type regression).
- **Thin-integration tests** for the 4 new FastAPI routes (`/role`, `/entity-type`, `/deny`,
  `/autofill-fields`): 200 happy-path + ValueError→404 + malformed-uuid→422 (+ role allow-list
  422), mirroring the entity-types router suite.

---

## Deploy follow-up (Bundle D1) — LOCAL-ONLY migrations

Migrations **0014** (system-slug partial unique index + entity_type_fields unique) and **0015**
(append_denied_polygon RPC) are applied to LOCAL Postgres only. Push them to staging/prod
**together with the pending 0013** (09-01 relationship columns) via
`npm run migrate:staging` / `migrate:prod` (packages/db) before/with the next deploy. Do NOT
touch AWS from this bundle. No data backfill needed (no existing duplicate system/field slugs
were found locally; verify the same on staging/prod before applying the unique indexes).

---

## Gate Results (Bundle D1)

All gates run from `apps/email-listener/` after the four commits; `packages/db` typechecks.

| Gate | Result |
|------|--------|
| `uv run pytest` | 458 passed, 8 skipped — 87.96% coverage (≥80%, up from 436/86.97%) |
| `uv run ruff check .` | All checks passed |
| `uv run ruff format --check .` | 134 files already formatted |
| `uv run mypy app` | Success — no issues in 88 source files |
| `uv run lint-imports` | 3 contracts kept, 0 broken |
| `uv run bandit -c pyproject.toml -r app` | High: 0, Medium: 0, Low: 0 |
| `cd packages/db && npm run migration:generate` | 0014 emitted (2 index statements, no drift) |
| `cd packages/db && npm run migrate:local` | 0014 + 0015 applied (12 tables); indexes verified live |
| `cd packages/db && npx tsc --noEmit` | EXIT 0 |

---

## Commits (Bundle D1)

| Commit | Defects | Summary |
|--------|---------|---------|
| 7373d53 | HIGH-1, LOW-5 | dedupe autofill children (each autofilled once) + numeric page_index coercion |
| 74d3a9e | HIGH-2, MEDIUM-3 | system entity-type slug pre-check + partial unique index; field slug DB unique (migration 0014) |
| 618c399 | MEDIUM-4 | atomic denied-polygon append RPC (migration 0015); repo real-row-shape tests |
| 6016e7c | TEST-DEBT | thin-integration tests for the 4 new Phase-9 component routes |

---

_Fixed: 2026-06-14_
_Fixer: gsd plan executor (Bundle D1)_
_Bundle: D1 (backend final-review fixes)_

## Self-Check (Bundle D1): PASSED

- Files verified on disk: autofill_fields.py, manage_entity_types.py, deny_field.py,
  component_repository.py (port + supabase), entity-types.ts, 0014_fresh_marvel_apes.sql,
  0015_denied_polygon_append_rpc.sql, 0014_snapshot.json, the 5 touched test files,
  09-REVIEW-FIX.md, STATE.md.
- Commits verified in git log: 7373d53 (HIGH-1+LOW-5), 74d3a9e (HIGH-2+MEDIUM-3),
  618c399 (MEDIUM-4), 6016e7c (route test-debt). No file deletions across the bundle.
- Migrations 0014 + 0015 applied to local Postgres; indexes + RPC verified live.

---

## Bundle D2 — frontend final-review fixes (the genuine MEDIUM + LOW frontend findings)

**Source review:** `.planning/phases/09-entity-field-region-relationships-canvas/09-FINAL-REVIEW.md`
**Scope:** MEDIUM-A (nested interactive), MEDIUM-B (silent draw no-op), MEDIUM-C (dead
deactivate-vs-delete copy), MEDIUM-D (emails.list over-fetch), MEDIUM-E (confirm-all
N×N invalidations), LOW (dead-code cleanup)
**Fixed:** 6 / 6
**Skipped:** 0 (the optional layers-tree undo-toast item was consciously deferred — see below)

Bundle D2 closes the frontend defects from the full final review (the backend HIGH/MEDIUM/
LOW were Bundle D1; the frontend HIGH-3 "apps/web has zero tests" remains the top documented
follow-up). All fixes are surgical review cleanups — no refactor, no DEFER items touched, no
regression to Bundle B/C canvas wiring (overlays on the PDF, drag-to-draw, Show-regions single
source, confirm/deny).

### MEDIUM-A — `EntityChips <a>` nested inside `InboxRow <button>`

**Files:** `apps/web/src/app/_components/inbox-row.tsx`
**Commit:** 4be8c62

**Root cause:** The inbox row was a `<button>` that wrapped the `EntityChips`, which render
`<a>` deep-links (Next `<Link>`). An interactive `<a>` nested inside an interactive `<button>`
is invalid HTML and a nested-interactive a11y violation (it logged a dev-console error).

**Applied fix:** Converted the row to a `<div role="button" tabIndex={0}>` with an explicit
`onKeyDown` that mirrors native button activation (Enter and Space select the row; Space's
default scroll is prevented; key events that originate from the nested chip links are ignored
via the `event.target !== event.currentTarget` guard so the chip's own anchor semantics
handle Enter). `aria-pressed`, the click-to-select behavior, and the selected `bg-primary/10`
accent are preserved. The chips stay a sibling (never nested in an interactive element) and
keep their existing `stopPropagation` so a chip click never toggles the row selection.

**Resolution evidence:** No interactive element is nested inside another; valid HTML; the row
and the chips remain independently operable. apps/web tsc 0.

### MEDIUM-B — Drag-to-draw silently no-ops on pages with no resolvable page component

**Files:** `apps/web/src/app/emails/[id]/_components/email-detail.tsx`
**Commit:** 4eac97e

**Root cause:** `handleRectDrawn` only acted when `drawMode` was redraw/split OR a
`pageComponentId` resolved for the current page. With no legacy draw mode and no resolvable
`attachment_page` component, the drawn rect fell through with no `else` — silently dropped,
making the shell Draw tool look dead.

**Applied fix (toast, the preferred option):** Added the trailing `else` branch — it cancels
the draw and fires `toast.warning("Can't draw a region on this page — it has no recognized
document page to attach to.")`. All existing routing (redraw, split, active-parent → field
child, standalone unclassified region) is unchanged. (Draw is intentionally NOT gated off,
per the objective — a toast is less surprising than a dead-looking toggle.)

**Resolution evidence:** A draw on an unanchorable page now surfaces a clear reason instead of
a silent no-op; the active-parent → FIELD-child chain (D-10) and the standalone-region path are
untouched. apps/web tsc 0.

### MEDIUM-C — D-27 deactivate-vs-delete pre-confirmation copy was dead

**Files:** `apps/web/src/app/entity-types/_components/field-row-dialog.tsx`
**Commit:** c868596

**Root cause:** `FieldRowDialog` already supported reference-aware copy via `referenceCount`,
but `entity-type-detail.tsx` never passed it, so the prop defaulted to `0` and the pre-delete
AlertDialog ALWAYS showed the destructive "permanently removed / cannot be undone" copy even
when the server soft-deactivates a confirmed-referenced field (D-27). The list query exposes no
reference count, and computing one would require a new backend query (out of a surgical
cleanup's scope).

**Applied fix (neutral copy — the objective's stated fallback):** Made `referenceCount`
genuinely tri-state:
- `> 0` (known reference) → "Deactivate this field?" + non-destructive (secondary) variant.
- `undefined` (count NOT known pre-delete, the live path) → NEUTRAL copy: "Remove this field?"
  + a secondary (non-destructive) variant + a description that does not promise permanent
  deletion ("If no confirmed data references this field it is removed permanently; if it is
  referenced it is deactivated … You'll be told which happened.").
- `0` (confirmed hard delete) → the destructive copy, unchanged.

The post-action toast in `use-entity-type-admin.deleteField` is already honest (it resolves the
FastAPI `{hard_deleted, soft_deactivated}` outcome) — this fix only aligns the PRE-confirmation
copy so it never promises something the server may not do.

**Resolution evidence:** With no count passed, the dialog now shows the neutral, non-destructive
copy; the destructive variant is reserved for a confirmed hard delete. apps/web tsc 0.

### MEDIUM-D — `emails.list` over-fetch (SELECT * pulled bodyHtml/raw)

**Files:** `packages/api-client/src/router/emails/index.ts`
**Commit:** 0ef8662

**Root cause:** `emails.list` used `.select()` (SELECT *), streaming `bodyHtml`, the raw
storage key, and every envelope column to the inbox for rows that render none of them (a single
email body can be large).

**Applied fix:** Explicit column projection — only the inbox-needed columns (`id`, `subject`,
`senderName`, `senderAddress`, `toAddresses`, `receivedAt`, `importerId`) plus a `bodyText`
snippet truncated server-side via `left(body_text, 2000)` (the exact length the reading preview
slices to). `bodyHtml`, the raw storage key, and the rest of the envelope are no longer fetched.

**Resolution evidence:** `npm run build -w @nauta/api-client` EXIT 0; `npm test -w
@nauta/api-client` 56/56 green (no list-shape fixture existed to update — the projected shape is
a superset of the inbox `InboxEmailItem` the three-pane casts to); `cd apps/web && npx tsc
--noEmit` 0 consuming the narrowed shape; `npm run web:build` EXIT 0.

### MEDIUM-E — `confirmAllFields` fanned out N mutations × N `emails.detail` invalidations

**Files:** `apps/web/src/app/emails/[id]/_components/use-role-mutations.ts`,
`use-autofill-fields.ts`, `email-detail.tsx`
**Commit:** 0f62c8f

**Root cause:** `confirmAllFields` looped `confirmField(id)`, and each `confirmField`'s
`onSuccess` invalidated `emails.detail` — N mutations fanned out N cache refetches for one user
action ("Confirm All Fields").

**Applied fix:** Added `roleMutations.confirmFields(ids)` — a single optimistic patch marking
every target confirmed at once, then N confirm mutations via a dedicated **no-`onSuccess`** bulk
mutation (`confirmFieldBulkMutation`) awaited together with `Promise.all`, then exactly ONE
trailing `emails.detail.invalidate`. Errors revert the single snapshot + toast. The
`use-autofill-fields.confirmAllFields` now delegates to it (and marks the entity confirmed once
the batch resolves). `email-detail` passes `roleMutations.confirmFields` to the autofill hook.

**Resolution evidence:** "Confirm All Fields" now issues N confirms + ONE invalidate. apps/web
tsc 0; web:build 0.

### LOW — dead/divergent code removal (divergence traps)

**Files:** `apps/web/src/app/emails/[id]/_components/use-role-mutations.ts` (dead autofill
machine), `use-canvas-state.ts` (dead `liveRect`/`onDrawComplete`/`onBoxGeometryChange` API),
`canvas-shell.tsx` + `email-detail.tsx` (unused `CanvasShell` emailId prop)
**Commits:** 0f62c8f (dead autofill machine, folded with MEDIUM-E), 4577282 (use-canvas-state
API + CanvasShell emailId)

- **Dead duplicate autofill machine** in `use-role-mutations.ts`: removed the
  `AutofillFieldsPhase` type, the `autofillPhases` state, `autofillFieldsMutation`, the
  `autofillFields` handler, its `mutatingComponentIds` entry, and the now-unused `useState`
  import. The canonical non-optimistic autofill path is `use-autofill-fields` (09-09 decision);
  nothing consumed `roleMutations.autofillFields`/`autofillPhases`.
- **Dead `use-canvas-state` API** (~50 lines): removed `liveRect`/`setLiveRect`/
  `onDrawComplete`/`onBoxGeometryChange` (email-detail drives draw/redraw through `canvas.edit`,
  the use-region-edit machine — these copies were never consumed) plus the now-unused
  `resolvePageComponentId` param, the `NormalizedRect`/`Polygon` types and the
  `normalizedRectToPolygon` import. `email-detail` drops the `resolvePageComponentId` prop pass
  (the helper stays — it still computes `pageComponentId` locally).
- **Unused `CanvasShell` emailId prop**: removed from `CanvasShellProps` and its email-detail
  call-site pass.

**Resolution evidence:** No behavior change; three divergence traps removed. apps/web tsc 0;
web:build 0.

---

## Skipped / Deferred (Bundle D2)

- **Layers-tree inline-deny undo toast** (the OPTIONAL LOW item, `layers-tree-row.tsx:161-171`):
  CONSCIOUSLY DEFERRED. Adding the canvas `ConfirmDenyControls` origin-aware Undo toast to the
  LAYERS-tree text-row deny would require threading `isAutoDetected` + `onRestore` through
  `LayersTreeRow` → `LayersPanel` → `email-detail` AND adding the origin marker to the
  `LayersComponent` data model (the panel currently passes only `onConfirmField`/`onDenyField`,
  no origin/restore). That is a multi-file data-model change — exactly the "skip if it risks
  scope creep" the objective flagged. Left as a documented non-blocking follow-up.
- **DEFER items untouched** (per objective): canvas hover-state re-render / OverlayLayer
  memoization / RegionOverlayBox React.memo; email-detail god-component split; standing up the
  apps/web test harness (vitest/playwright — the top separate follow-up, frontend HIGH-3).

---

## Gate Results (Bundle D2)

| Gate | Result |
|------|--------|
| `npm run build -w @nauta/api-client` (MEDIUM-D touched api-client) | EXIT 0 |
| `npm test -w @nauta/api-client` | 56 passed (6 files) |
| `cd apps/web && npx tsc --noEmit` (after each fix) | EXIT 0 |
| `npm run web:build` (full next build) | EXIT 0 — `/`, `/entity-types`, `/emails/[id]` all render (5/5 static pages) |

---

## Commits (Bundle D2)

| Commit | Defect | Summary |
|--------|--------|---------|
| 4be8c62 | MEDIUM-A | InboxRow `<div role="button">` + keyboard handlers — no nested interactive elements |
| 4eac97e | MEDIUM-B | toast.warning when drag-to-draw has no page component to anchor (was a silent no-op) |
| c868596 | MEDIUM-C | pre-delete dialog neutral copy when reference count is unknown (deactivate-vs-delete) |
| 0ef8662 | MEDIUM-D | explicit `emails.list` column projection (drop bodyHtml/raw; truncated bodyText snippet) |
| 0f62c8f | MEDIUM-E + LOW | Confirm All Fields = N confirms + ONE invalidate; remove dead autofill machine |
| 4577282 | LOW | delete dead `use-canvas-state` API + `CanvasShell` emailId prop |

---

_Fixed: 2026-06-14_
_Fixer: gsd plan executor (Bundle D2)_
_Bundle: D2 (frontend final-review fixes)_

## Self-Check (Bundle D2): PASSED

- Files verified on disk: inbox-row.tsx, email-detail.tsx, field-row-dialog.tsx,
  emails/index.ts (api-client), use-role-mutations.ts, use-autofill-fields.ts,
  use-canvas-state.ts, canvas-shell.tsx, 09-REVIEW-FIX.md, STATE.md.
- Commits verified in git log: 4be8c62 (MEDIUM-A), 4eac97e (MEDIUM-B), c868596 (MEDIUM-C),
  0ef8662 (MEDIUM-D), 0f62c8f (MEDIUM-E + dead autofill machine), 4577282 (dead use-canvas-state
  API + CanvasShell emailId). No tracked-file deletions across the bundle (only dead-code
  removal within existing files).
