---
phase: 06-region-edit-operations-on-the-document-preview-accept-redraw
plan: "04"
subsystem: web-ui
tags: [region-edit, reject-dialog, nest-picker, merge, history, entities-list]
dependency_graph:
  requires: ["06-03"]
  provides: ["reject-confirmation", "nest-picker", "merge-multi-select", "history-badges", "add-region-from-list"]
  affects: ["07-autofill-ui"]
tech_stack:
  added: []
  patterns:
    - "AlertDialog controlled open for destructive confirmation gate"
    - "Popover nest picker with eligible-region filter (same page, not selected, not rejected/superseded)"
    - "Checkbox-driven merge multi-select — 1 selected enters mode, ≥2 submits"
    - "§6.6 status badge map (rejected=outline+line-through, superseded=secondary+opacity-60)"
    - "showHistory filter: rejected/superseded hidden by default, revealed by toggle"
key_files:
  created:
    - apps/web/src/app/emails/[id]/_components/reject-dialog.tsx
    - apps/web/src/app/emails/[id]/_components/nest-picker.tsx
  modified:
    - apps/web/src/app/emails/[id]/_components/use-region-edit.ts
    - packages/api-client/src/router/emails/detail.ts
    - apps/web/src/app/emails/[id]/_components/action-toolbar.tsx
    - apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx
    - apps/web/src/app/emails/[id]/_components/email-detail.tsx
    - apps/web/src/app/emails/[id]/_components/entities-list.tsx
decisions:
  - "AlertDialog opened via controlled state (rejectDialogOpen in useRegionEdit) — not onReject direct; satisfies T-06-17 (Repudiation mitigation)"
  - "Delete key opens RejectDialog not direct reject — preserves keyboard UX while adding confirmation gate"
  - "eligibleRegions computed in email-detail (not the hook) so the hook stays data-agnostic"
  - "NestPicker trigger kept inside the component so it owns focus management of the Popover"
  - "entitiesList receives shiftToggle as onToggleSelect so merge multi-select is unified with overlay shift-click"
metrics:
  duration_minutes: ~35
  completed_date: "2026-06-12"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 8
---

# Phase 06 Plan 04: Reject Dialog + Nest Picker + Merge Multi-Select + History Badges Summary

**One-liner:** AlertDialog reject confirmation, Popover nest picker with eligible-region filter, checkbox-based merge multi-select, §6.6 history badges, and "+ Add region" in the Detected Regions card — resolving all three stubs from 06-03.

## What Was Built

### Task 1 — Reject dialog, nest picker, merge/nest mutations, parentComponentId

- **reject-dialog.tsx**: AlertDialog controlled via `rejectDialogOpen`; title "Reject this region?"; destructive "Reject region" / cancel "Keep region". Zero network call until confirmed.
- **nest-picker.tsx**: Popover w-64; header "Nest into parent region"; ghost buttons per eligible region (label = `entityTypeLabel ?? extractionStatus`); empty state; "Remove parent (un-nest)" when `parentComponentId` non-null.
- **use-region-edit.ts**: Added `mergeMutation` and `nestMutation` with `onSuccess invalidate + toast.success + clearSelection`; added `merge()` and `nest()` handler functions; exposed both in the return object.
- **detail.ts**: Added `parentComponentId: EmailComponents.parentComponentId` to components select.

Commit: `6bc3ddb`

### Task 2 — Wire reject dialog, nest picker, multi-select merge into toolbar + pane

- **action-toolbar.tsx**: Rewrote to accept `rejectDialogOpen`, `onRejectDialogChange`, `nestPickerOpen`, `onNestPickerChange`, `eligibleRegions`, `onMerge`, `onNest`, `onUnNest`; renders `<RejectDialog>` and `<NestPicker>` inside; reject button opens dialog; merge button `variant="default"` when ≥2 selected, fires `onMerge(selectedComponentIds)`; NestPicker replaces the standalone nest button.
- **pdf-preview-pane.tsx**: Added new props; Delete key now opens `onRejectDialogChange(true)` instead of calling `onReject` directly (stub fix); threads all dialog/picker state to ActionToolbar.
- **email-detail.tsx**: Computes `eligibleRegions` (same page_index, not selected id, not rejected/superseded); wraps `handleMerge`, `handleNest`, `handleUnNest`; passes all dialog state from `useRegionEdit` into `PdfPreviewPane`.

Commit: `082d076`

### Task 3 — EntitiesList upgrade + history badges + full phase gates

- **entities-list.tsx**: "+ Add region" Button in CardHeader (right-aligned, `disabled` + Tooltip "Open a PDF to draw regions." when no PDF); `showHistory` filter hides rejected/superseded by default; leading `<Checkbox>` per row when in merge multi-select mode; §6.6 status badge map (`rejected` → `outline + line-through`, `superseded` → `secondary + opacity-60`); updated empty state handles all-rejected case.
- **email-detail.tsx**: Wires `onAddRegion`, `addDisabled`, `selectedComponentIds`, `onToggleSelect`, `showHistory` into EntitiesList.

Commit: `ba18bd4`

## Gate Results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` (api-client) | PASS |
| `npm run build` (api-client) | PASS |
| `npx tsc --noEmit` (web) | PASS |
| `npm run build` (web) | PASS — 5.6s compile |
| `vitest run src/geometry.test.ts` (api-client) | PASS — 14/14 |
| `pytest --tb=no` (email-listener) | PASS — 315 passed, 7 skipped, 90.54% coverage |
| `ruff check app tests` | PASS |
| `mypy app` | PASS — no issues in 81 files |
| `lint-imports` | PASS — 3 kept, 0 broken |
| `bandit -r app -q` | PASS (warnings are comment false-positives) |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

The `parentComponentId` field was confirmed already present on the Drizzle schema from Phase 4; only the `detail.ts` select needed to be extended (as planned). The api-client dist rebuild was needed to surface the new type to web before the tsc check.

## Known Stubs

None — all three stubs from 06-03 were resolved:
1. Reject now opens AlertDialog (was: direct reject call)
2. Merge/Nest buttons now have full handlers wired (was: disabled, no handlers)
3. `rejectDialogOpen`/`nestPickerOpen` state is fully consumed (was: pre-provisioned but unused)

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes beyond what the plan's threat model covers.

| Boundary | Status |
|----------|--------|
| T-06-15: merge across emails | FastAPI 404 enforcement remains the guard; client-side eligible filter is UX convenience |
| T-06-16: nest into ineligible parent | NestPicker filter + tRPC UUID validation + Pydantic re-validation all active |
| T-06-17: reject without confirm | AlertDialog gate implemented — resolves the stub |
| T-06-18: history disclosure | Accepted; same-email lineage only |

## Self-Check: PASSED

- `apps/web/src/app/emails/[id]/_components/reject-dialog.tsx` — FOUND
- `apps/web/src/app/emails/[id]/_components/nest-picker.tsx` — FOUND
- `6bc3ddb` — FOUND
- `082d076` — FOUND
- `ba18bd4` — FOUND
