---
status: cleared
resolution: All 9 findings (2 CRIT + 3 HIGH + 4 WARNING) fixed in gap-fix Bundles A/B/C and re-verified CLEARED (no high/critical regressions). See 09-REVIEW-FIX.md.
phase: 09-entity-field-region-relationships-canvas
source: ultracode adversarial verification (canonical gsd-verifier + gsd-code-reviewer + 4 decision-slice auditors + cross-stack integration auditor + synthesis)
generated: 2026-06-13
resolved: 2026-06-14
verifier_status: human_needed (31/31 must-haves "present" — presence-only, missed the defects below)
orchestrator_confirmed: CRIT-1, CRIT-2, HIGH-1, HIGH-2, HIGH-3 read against actual code; all fixed + re-verified
remaining_followups: server-side deny restore (optimistic-only today); LAYERS-tree deny undo toast; staging/prod 0013 push before deploy; Bedrock RPM quota (infra) for live autofill
---

# Phase 09 — Adversarial Verification Synthesis

**Verdict: BLOCKED.** The canonical verifier scored 31/31 plan must-haves but only checked *presence*. Deeper adversarial auditors (corroborated, with file:line evidence, and re-confirmed by the orchestrator reading the cited code) found 2 CRITICAL + 3 HIGH correctness defects that break the phase goal. Backend relationship model (D-01..D-03, D-10/D-11, D-14/D-15, D-18/D-19), app shell + glassy inbox (D-20..D-24), entity-type CRUD transport, and all security contracts (API key server-only, uuid validation, no XSS) are genuinely solid and verified.

## Confirmed blockers (orchestrator-verified)

### CRIT-1 — Autofill writes a slug into the `entity_type_field_id` uuid FK (D-13/D-04)
`apps/email-listener/app/application/use_cases/autofill_fields.py:215-235,524-530` — `_best_field_mapping` returns `best_slug`; `_autofill_child` writes it into `entity_type_field_id`, a **uuid FK** (`migration 0013:19`, `components.ts:102`). `EntityTypeField` carries no `id` (`entity_type.py`), so the use case cannot resolve the uuid. Every autofill property-mapping write fails against real Postgres (the mock-repo suite cannot catch it; real-PG test is credential-skipped). The SetFieldRelationship setter shares the slug-identity assumption.
**Fix:** expose `id` on `EntityTypeField` (+ `_field_from_row`); `_best_field_mapping` returns the field uuid; write the uuid. Add a test asserting `entity_type_field_id` is a valid uuid matching a real field row.

### CRIT-2 — Soft-deactivated fields never hidden (D-27)
`entity_type_repository.py:31-44,263-271` — `deactivate_field` sets `config.is_active=false`, but `_field_from_row` (used by `find_by_id`/`find_by_slug`/`list_active` via the `entity_type_fields(*)` join) never filters it. (Entity-type-level `is_active` IS filtered at lines 99/127 — different thing.) Deactivated fields stay in `EntityType.fields` → still injected into the autofill system prompt and shown in the management UI; the AI can re-map onto a "deleted" property.
**Fix:** drop fields with `config.is_active == false` in the active read paths (keep the row for `count_confirmed_references`/FK). Test: deactivated field absent from `list_active` + autofill schema.

### HIGH-1 — Phase-9 canvas visual model is inert on the PDF (D-08/D-10/D-12/D-16)
`pdf-preview-pane.tsx:31-43,661-672` — the pane's local `Component` interface has no `role`; its `<OverlayLayer>` call passes none of `roleFilter`/`activeParentId`/`showUnrelated`/`confirmDenyComponentIds`/`onConfirmField`/`onDenyField`. So role colors, the D-10 active-parent ring, D-12 anti-bloat hiding, and D-16 inline ✓/✗ render **only in the side LAYERS tree, never on the document**. The 09-09 SUMMARY's "candidate field boxes appear with inline ✓/✗ on the canvas" overstates completeness. (The canonical verifier mis-cleared this — it saw `region-overlay-box.tsx` *supports* `showConfirmDeny` and assumed it was wired.)
**Fix:** thread the Phase-9 props from `email-detail.tsx` through `PdfPreviewPane` into `OverlayLayer`; add `role`/`parentComponentId` to the pane `Component` type (data already carries them from `detail.ts`). Largest single fix; unblocks D-08/D-10/D-12/D-16 on the canvas.

### HIGH-2 — Zero-friction drag-to-draw not implemented (D-08)
`pdf-preview-pane.tsx:676` DrawOverlay mounts only when `drawMode!==null`; `email-detail.tsx:503` passes the legacy Phase-6 `canvas.edit.drawMode`. The Phase-9 `canvas.mode` (Select/Draw shell toggle, `use-canvas-state.ts`) never drives `drawMode`, so the new toggle is decorative — draw is armed only by the legacy "+ Add region".
**Fix:** default empty-area drag to draw / wire `canvas.mode === 'draw'` → `drawMode`.

### HIGH-3 — Field uuid never exposed; entity-type field CRUD unwireable end-to-end (D-26)
`entity_types.py` `FieldView` omits `id`; no read returns one; yet `update_field`/`delete_field`/`reorder_fields` need a uuid `field_id` path param. The client cannot obtain a field id → edit/delete/reorder cannot be driven end-to-end. Shares root cause with CRIT-1 (`EntityTypeField.id`).
**Fix:** add `id` to `FieldView` + `_field_from_row` + `EntityTypeView`; surface through the tRPC `entityTypes.list` shape the admin UI consumes.

## Warnings (fix-worthy, non-blocking)
- **WR-01** deny "Undo" affordance dead — `confirm-deny-controls.tsx` never imported; no restore mutation flips `rejected→candidate` / pops the deny memo.
- **WR-02** `getCandidateValue` picks `Object.entries(extractedFields)[0]` (non-deterministic) — may show a value for a different property than the mapped field. Pairs with CRIT-1.
- **WR-03** `UpdateFieldUseCase` skips the per-type slug-uniqueness pre-check `CreateFieldUseCase` enforces.
- **WR-04** `confirmAllFields` fires N optimistic mutations in a sync loop sharing snapshots (inconsistent rollback).
- **WR-05** optimistic deny marks user-drawn boxes `rejected` transiently (contradicts "your boxes never disappear").

## Info / cleanup (non-blocking)
INFO-1 `detail.ts` resolves entity-type label off `ExtractionRecords.entityTypeId` not the new `EmailComponents.entityTypeId` (editor label lags; inbox chips are correct). INFO-2 auto-detected deny doesn't supersede the candidate ExtractionRecord. INFO-3 `reorder_fields` non-atomic/no existence check. INFO-4 dead code (`onBoxGeometryChange`/`onDrawComplete` unused; two divergent inline ✓/✗ impls; dead shell toggles; over-fetching `emails.list`).

## Accepted follow-ups (documented, non-blocking)
- Staging/prod migration `0013` push (must land *with* the CRIT-1 fix). Harden `0013`: guard `CREATE TYPE component_role`.
- Dual-toolbar in `email-detail.tsx` (folds into HIGH-1's fix when OverlayLayer is properly threaded).
- R3/R4/R6 correctly split to Phases 10/11.
- 09-09 Task 4 human-verify browser pass — would fail today on the canvas loop + autofill round-trip until CRIT-1/HIGH-1 are fixed.

## Cross-stack integration (transport)
All flows PASS at the transport layer (path/method/shape align, contract-tested). Two flows PASS transport but FAIL outcome: autofillFields (CRIT-1 DB write) and entity-type field CRUD (HIGH-3 no field id). Security: EMAIL_LISTENER_API_KEY server-only + uuid validation — PASS.
