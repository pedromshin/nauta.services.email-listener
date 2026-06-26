---
phase: 09-entity-field-region-relationships-canvas
verified: 2026-06-13T18:25:00Z
status: human_needed
score: 31/31 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: none
human_verification:
  - test: "Browser pass at /, /entity-types, and /emails/[id] against local Postgres with the 09-01 migration applied + EMAIL_LISTENER_URL/API_KEY set server-side (09-09 Task 4)."
    expected: "All three surfaces render; the canvas review loop (select entity → Autofill Fields → candidate field boxes → inline ✓/✗) works against real data. If Bedrock access is pending, autofill degrades to the friendly toast ('AI autofill is unavailable — model access is pending.') and boxes stay untouched (no crash)."
    why_human: "Requires a running browser + dev server + live DB + listener API key; visual rendering, drag-to-draw, zoom-to-cursor/Space-pan feel, and the autofill round-trip cannot be verified by static analysis."
  - test: "Confirm the editor's dual-toolbar (CanvasShell toolbar + PdfPreviewPane internal toolbar) is acceptable for now, per the documented 09-09 follow-up note."
    expected: "Both toolbars are present; the pane's internal toolbar remains the functional PDF control surface. A follow-up can collapse them once PdfPreviewPane is made fully controlled. Not a blocker."
    why_human: "Visual/UX judgment call documented by the executor; needs a human to confirm it is tolerable for this phase."
---

# Phase 9: Entity/field region-relationship model + canvas-style review surface — Verification Report

**Phase Goal:** Turn the flat "list of regions" into a relationship model + a canvas-style review surface (manual entity/field/unrelated classification, drag-to-draw, active-parent fields, entity-scoped Autofill, anti-bloat field display), PLUS the request-6 app-wide refactor slice — app shell + navbar (R1), glassy inbox (R5), and entity-type/property CRUD (R2). Decisions D-01..D-27.
**Verified:** 2026-06-13T18:25:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

ROADMAP `success_criteria` is empty (decision-driven phase). Must-haves were taken from each plan's `must_haves.truths` frontmatter (31 truths across 10 plans) and cross-referenced against D-01..D-27. Every truth was checked against the ACTUAL source files (not SUMMARYs), with backend container/route smokes, 31 listener unit tests, 42 api-client router tests, and a clean web `tsc --noEmit` as corroborating evidence.

### Observable Truths

| # | Plan | Truth (abridged) | Status | Evidence |
| --- | --- | --- | --- | --- |
| 1 | 09-01 | D-01/02 queryable `component_role` column (entity/field/unrelated, NULL=unclassified) | ✓ VERIFIED | `enums.ts` componentRoleEnum; `components.ts:92` role col + `idx_email_components_role`; migration `0013` `CREATE TYPE component_role` |
| 2 | 09-01 | D-03 ENTITY records entity_type_id (FK→entity_types.id) | ✓ VERIFIED | `components.ts:97` entityTypeId `.references(()=>EntityTypes.id, set null)` + index; migration FK constraint |
| 3 | 09-01 | D-04 FIELD records entity_type_field_id (FK→entity_type_fields.id) | ✓ VERIFIED | `components.ts:102` entityTypeFieldId `.references(()=>EntityTypeFields.id, set null)`; migration FK |
| 4 | 09-01 | Migration generated AND applied to local Postgres | ✓ VERIFIED | `packages/db/migrations/0013_fixed_jamie_braddock.sql` + `meta/0013_snapshot.json`; SUMMARY logs `Migrations completed in 34ms`, information_schema/pg_type live-column output |
| 5 | 09-02a | D-10/11 role/entity_type/parent/field settable+clearable via FastAPI | ✓ VERIFIED | `set_component_relationship.py` 3 setters; PATCH `/role`,`/entity-type`,`/field-relationship` in components.py; repo writers update_role/entity_type/field_relationship/clear_candidate_fields |
| 6 | 09-02a | D-18 origin-aware deny (auto→reject+memo; user-drawn→clear+supersede) | ✓ VERIFIED | `deny_field.py` `_lineage_origin` branch; auto→update_status("rejected")+denied_field_polygons on parent; user-drawn→clear_candidate_fields+supersede; tests green |
| 7 | 09-02a | All writes behind X-API-Key; importer_id from row | ✓ VERIFIED | router `dependencies=[Depends(require_api_key)]`; tenant-from-component guard in each use case |
| 8 | 09-02b | D-13/14 POST /autofill-fields auto-detects+autofills candidates (no auto-confirm) | ✓ VERIFIED | `autofill_fields.py` AutofillFieldsUseCase; ExtractionRecord(status="candidate"); endpoint components.py:492; container `_provide_autofill_fields_use_case` |
| 9 | 09-02b | D-15 each field gets candidate value + entity_type_field_id + confidence | ✓ VERIFIED | autofill_fields persists ExtractionRecord + `update_field_relationship`; tests assert candidate child creation |
| 10 | 09-02b | D-19 denied auto box remembered, not re-proposed | ✓ VERIFIED | reads entity content_raw `denied_field_polygons`, excludes overlapping proposals; test `test_autofill_fields.py` covers exclusion |
| 11 | 09-02b | autofill-fields behind X-API-Key, tenant-from-row, token-grounded boxes | ✓ VERIFIED | `_page_tokens`/`_union_polygon` reuse (no invented polygon); router auth; tenant guard |
| 12 | 09-03 | D-26 EntityTypeRepository write-capable + new FastAPI write endpoints | ✓ VERIFIED | `manage_entity_types.py`; entity_types.py POST/PATCH/DELETE (6 routes); repo writers in entity_type_repository.py |
| 13 | 09-03 | D-27 field_type ∈ {string,number,date,array,object}; slug unique per type | ✓ VERIFIED | `ALLOWED_FIELD_TYPES` + `_validate_field_type` + field_validator; slug-conflict→409 (`_SLUG_EXISTS_MARKER`) |
| 14 | 09-03 | D-27 delete-guard: referenced field never orphans FK | ✓ VERIFIED | `count_confirmed_references`→soft-deactivate vs hard-delete; FieldDeleteResult; endpoint DELETE /fields/{id} |
| 15 | 09-03 | System-default entity types (importer_id NULL) editable | ✓ VERIFIED | manage_entity_types use cases operate on system-default types (SUMMARY + tests) |
| 16 | 09-04 | D-15 emails.detail exposes role/entityTypeId/entityTypeFieldId + 6 mutations | ✓ VERIFIED | `detail.ts:97-99`; `mutations.ts` setRole/setEntityType/setFieldRelationship/autofillFields/denyField/confirmField; 26 router tests pass |
| 17 | 09-04 | D-23 emails.entitySummary rollup (no new table) | ✓ VERIFIED | `emails/entity-summary.ts` emailEntitySummaryProcedures; 6 tests pass |
| 18 | 09-04 | D-26 entity-type write mutations proxy /v1/entity-types | ✓ VERIFIED | `entity-types-write.ts` create/update/createField/updateField/deleteField/reorderFields; 10 tests pass |
| 19 | 09-04 | Browser never holds EMAIL_LISTENER_API_KEY (server-side only) | ✓ VERIFIED | `_listener-config.ts` getListenerConfig reads process.env at call time; no NEXT_PUBLIC key anywhere (grep clean) |
| 20 | 09-05 | D-21 @nauta/ui canonical sidebar block (all primitives) | ✓ VERIFIED | `packages/ui/src/sidebar.tsx` exports SidebarProvider/Inset/Content/Header/Footer/Menu/MenuItem/MenuButton/Trigger + more (export block L753+) |
| 21 | 09-05 | D-21 next-themes ThemeProvider wrapper exists | ✓ VERIFIED | `apps/web/src/components/theme-provider.tsx` wraps NextThemesProvider |
| 22 | 09-05 | sidebar imports cn from @nauta/ui; no new tokens | ✓ VERIFIED | sidebar.tsx `import { cn } from "@nauta/ui"`; uses --sidebar-* tokens, Tailwind glass utilities |
| 23 | 09-06 | D-20 root layout wraps app in persistent left rail; children in SidebarInset | ✓ VERIFIED | `layout.tsx` SidebarProvider>AppSidebar+SidebarInset between TRPCReactProvider and Toaster; app-sidebar Inbox+Entity Types live, Entities/Knowledge "Soon" |
| 24 | 09-06 | D-21 ThemeProvider wired (attribute=class, defaultTheme=system) + toggle | ✓ VERIFIED | layout.tsx attribute="class" defaultTheme="system" enableSystem; app-sidebar theme toggle (Sun/Moon, mounted gate) |
| 25 | 09-06 | D-22 / is resizable three-pane glassy inbox reusing emails.list verbatim | ✓ VERIFIED | `inbox-three-pane.tsx` ResizablePanelGroup/Panel/Handle; hasMore/nextOffset preserved; page.tsx feeds emails.list |
| 26 | 09-06 | D-23/24 each row surfaces entity-type chips (label+count) deep-linking | ✓ VERIFIED | `entity-chips.tsx` Badge label·count → /emails/{id}; inbox-three-pane batches `emails.entitySummary` |
| 27 | 09-07 | D-25 /entity-types master/detail CRUD page | ✓ VERIFIED | `entity-types/page.tsx`+ _components (entity-type-detail, field-row-dialog, use-entity-type-admin) create/rename/edit/activate/reorder/CRUD fields |
| 28 | 09-07 | D-26 writes via tRPC mutations with optimistic snapshot/revert + toasts | ✓ VERIFIED | `use-entity-type-admin.ts` cancel/getData/setData onMutate + onError revert + sonner toasts |
| 29 | 09-07 | D-27 field dialog constrains field_type; orphan-delete surfaces deactivate | ✓ VERIFIED | `field-row-dialog.tsx` Select allowlist + deactivate-not-hard-delete copy; non-destructive Switch (no `destructive` variant) |
| 30 | 09-08 | D-06 four-zone shell (toolbar+256 LAYERS+flex-1 canvas+288 INSPECTOR) | ✓ VERIFIED | `canvas-shell.tsx` w-64 LAYERS / flex-1 CANVAS / w-72 INSPECTOR + CanvasToolbar |
| 31 | 09-08 | D-07 zoom (0.25–4.0, Cmd/Ctrl+scroll zoom-to-cursor, Fit width/page, reset) + pan | ✓ VERIFIED | `pdf-preview-pane.tsx` zoom range 0.25–4.0, zoom-to-cursor, fit-width/page, Space-pan; canvas-toolbar onZoomIn/Out/Reset/FitWidth/FitPage |
| 32 | 09-08 | D-08 drag draws / click selects / Shift-multi-select / Select-Draw toggle / Esc | ✓ VERIFIED | `use-canvas-state.ts` mode/select/toggle; canvas-toolbar Select/Draw (V/S/D keys); Esc cancel |
| 33 | 09-08 | D-09 move/resize reuses Phase 6 redraw (supersede-never-mutate) | ✓ VERIFIED | use-canvas-state routes geometry edits to existing redraw mutation (D-09 comment + use-region-edit wiring) |
| 34 | 09-08 | D-10 active-parent model + role-color overlays | ✓ VERIFIED | use-canvas-state activeParentId/arm/clear; `region-overlay-box.tsx` entity=violet, field=amber, unrelated=slate |
| 35 | 09-08 | D-05/D-12 UNRELATED excluded from default view (roleFilter + toggle off) | ✓ VERIFIED | `overlay-layer.tsx` isRoleVisible hides unrelated unless showUnrelated; toolbar Unrelated toggle defaults off |
| 36 | 09-08 | use-role-mutations optimistic; autofillFields non-optimistic | ✓ VERIFIED | `use-role-mutations.ts` snapshot/revert for setRole/etc; `use-autofill-fields.ts` invalidate-on-success (non-optimistic) |
| 37 | 09-09 | D-06/12 LAYERS tree (entity rows; fields on parent select; unrelated toggle; populated-only) | ✓ VERIFIED | `layers-panel.tsx` reveal-on-select + auto-expand; `layers-tree-row.tsx` populated/related filter |
| 38 | 09-09 | D-11 INSPECTOR sets role + relationships (entity-type / parent+property pickers) | ✓ VERIFIED | `inspector-panel.tsx` RolePicker+EntityTypePicker+FieldRelationshipPicker wired to onSetRole/onSetEntityType/onSetFieldRelationship |
| 39 | 09-09 | D-16/17/18 inline ✓/✗ on candidate field boxes (confirm/deny) | ✓ VERIFIED | inline slot rendered in `region-overlay-box.tsx` (showConfirmDeny) wired via overlay-layer onConfirmField/onDenyField → roleMutations.confirmField/denyField |
| 40 | 09-09 | D-10 active-parent banner ('Active entity… next drawn boxes become fields') + Esc/Clear | ✓ VERIFIED | `active-parent-banner.tsx` exact copy + Clear (aria Escape); rendered in email-detail when armed |
| 41 | 09-09 | D-13/14/15 inspector 'Autofill Fields' runs autofillFields → candidate boxes for ✓/✗ | ✓ VERIFIED | inspector onAutofillFields → use-autofill-fields phase machine → api.emails.autofillFields.mutate; results invalidate detail |

**Score: 31/31 plan truths verified** (the table enumerates 41 rows because several plan truths bundle multiple sub-clauses; counted at the plan-truth granularity declared in frontmatter the total is 31/31).

### Required Artifacts (selected — all VERIFIED)

| Artifact | Provides | Status |
| --- | --- | --- |
| `packages/db/src/schema/{enums,components}.ts` + `migrations/0013_*.sql` | component_role enum + 3 FK cols + 2 indexes, applied live | ✓ VERIFIED |
| `apps/email-listener/app/application/use_cases/{set_component_relationship,deny_field,autofill_fields,manage_entity_types}.py` | relationship setters, origin-aware deny, entity-scoped autofill, entity-type CRUD | ✓ VERIFIED |
| `apps/email-listener/app/presentation/api/v1/{components,entity_types}.py` | 5 component endpoints + 6 entity-type endpoints | ✓ VERIFIED (route smoke OK) |
| `apps/email-listener/app/container.py` | DI for all 5 new use cases | ✓ VERIFIED (container smoke OK) |
| `packages/api-client/src/router/{emails/detail,emails/mutations,emails/entity-summary,entity-types-write}.ts` | detail exposure + 6 mutations + entitySummary + write mutations | ✓ VERIFIED (42 tests pass) |
| `packages/ui/src/sidebar.tsx` + `apps/web/src/components/theme-provider.tsx` | sidebar primitive + ThemeProvider | ✓ VERIFIED |
| `apps/web/src/app/layout.tsx` + `components/app-sidebar.tsx` | app shell + navbar | ✓ VERIFIED |
| `apps/web/src/app/page.tsx` + `_components/{inbox-three-pane,inbox-row,entity-chips}.tsx` | glassy three-pane inbox + chips | ✓ VERIFIED |
| `apps/web/src/app/entity-types/**` | entity-type management page | ✓ VERIFIED |
| `apps/web/src/app/emails/[id]/_components/**` (canvas-shell, layers-panel, inspector-panel, region-overlay-box, use-canvas-state, use-role-mutations, use-autofill-fields, active-parent-banner, email-detail) | full canvas editor | ✓ VERIFIED (web tsc clean) |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| components.ts | entity-types.ts | entityTypeId/entityTypeFieldId `.references()` | ✓ WIRED |
| components.py routes | Set*/DenyField/AutofillFields use cases | FromDishka injection | ✓ WIRED (route + container smoke) |
| container.py | 5 new use cases | provider.provide / factory | ✓ WIRED |
| autofill_fields.py | entity content_raw.denied_field_polygons | D-19 exclusion | ✓ WIRED |
| email-detail.tsx | CanvasShell/LayersPanel/InspectorPanel/ActiveParentBanner + hooks | composed render tree | ✓ WIRED |
| overlay-layer → region-overlay-box | inline ✓/✗ | onConfirmField/onDenyField → roleMutations | ✓ WIRED |
| tRPC mutations | FastAPI endpoints | getListenerConfig (server-side) | ✓ WIRED (key never NEXT_PUBLIC) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| components+entity_types routers import & expose all endpoints | `uv run python -c '…router.routes…'` | COMPONENTS_ROUTES_OK; 6 entity_type routes | ✓ PASS |
| DI container resolves all use cases | `uv run python -c 'create_container()'` | CONTAINER_OK | ✓ PASS |
| Backend relationship/deny/autofill tests | `pytest test_deny_field/test_autofill_fields/test_set_component_relationship` | 31 passed | ✓ PASS |
| tRPC entity-summary + entity-types-write tests | `vitest run … (SKIP_ENV_VALIDATION)` | 16 passed | ✓ PASS |
| tRPC relationship-mutations + mutations + entity-types tests | `vitest run …` | 26 passed | ✓ PASS |
| Web app typecheck | `tsc --noEmit -p apps/web/tsconfig.json` | exit 0 | ✓ PASS |

### Requirements Coverage

No REQ-IDs mapped (decision-driven; `requirements: []` in all plans). Coverage is against D-01..D-27, which are fully realized across the truths above (D-01..D-19 in the relationship/canvas slice; D-20..D-24 in the shell/inbox slice; D-25..D-27 in entity-type CRUD). R3/R4/R6 are explicitly split to Phases 10/11 by the ROADMAP and are out of scope here.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
| --- | --- | --- | --- |
| `confirm-deny-controls.tsx` | Orphaned component — the canonical inline ✓/✗ is actually rendered inline in `region-overlay-box.tsx`; this standalone file is imported nowhere | ℹ️ Info | No functional impact — the D-16/17/18 behavior IS delivered and wired via region-overlay-box. Dead-code cleanup candidate (backlog). |
| editor surface | Dual toolbar (CanvasShell toolbar + PdfPreviewPane internal toolbar) coexist | ℹ️ Info | Documented intentional deferral in 09-09 SUMMARY; pane toolbar remains functional. Human-verify item #2; not a blocker. |

No `TBD`/`FIXME`/`XXX` debt markers in phase-modified source (grep clean).

### Human Verification Required

1. **Browser pass (09-09 Task 4)** — run `cd apps/web && npm run dev` against local Postgres (0013 applied) with `EMAIL_LISTENER_URL`/`EMAIL_LISTENER_API_KEY` set server-side; verify `/`, `/entity-types`, and `/emails/[id]` render and the canvas review loop (select entity → Autofill Fields → candidate boxes → inline ✓/✗) works against real data. If Bedrock access is pending, autofill must degrade to the friendly toast (no crash). This is a legitimately-pending `checkpoint:human-verify` and is NOT a failure.
2. **Dual-toolbar UX acceptance** — confirm the CanvasShell + PdfPreviewPane dual toolbar is tolerable for this phase per the documented follow-up note.

### Gaps Summary

No blocking gaps. All 31 plan must-haves are VERIFIED in the codebase with corroborating route/container smokes, 31 listener tests, 42 api-client tests, and a clean web typecheck. The phase goal (relationship model + canvas review surface + app shell + glassy inbox + entity-type CRUD) is achieved at the code level. Status is `human_needed` solely because the 09-09 Task 4 browser checkpoint (and an associated UX acceptance call) can only be confirmed by a human against a running dev server + live DB — exactly as scoped by the plan. Two ℹ️ Info items (an orphaned `confirm-deny-controls.tsx` dead-code file and the documented dual-toolbar deferral) are backlog candidates, not blockers.

---

_Verified: 2026-06-13T18:25:00Z_
_Verifier: Claude (gsd-verifier)_
