---
phase: "07"
plan: "03"
subsystem: "web-ui"
tags: ["react", "autofill", "fields-panel", "reprocess", "trpc"]
dependency_graph:
  requires: ["07-01", "07-02"]
  provides: ["autofill-review-surface", "reprocess-dialog"]
  affects: ["email-detail", "entities-list", "pdf-preview-pane"]
tech_stack:
  added: []
  patterns: ["inline-panel-expansion", "alert-dialog-non-destructive", "autofill-state-passthrough"]
key_files:
  created:
    - "apps/web/src/app/emails/[id]/_components/fields-panel.tsx"
    - "apps/web/src/app/emails/[id]/_components/reprocess-dialog.tsx"
  modified:
    - "apps/web/src/app/emails/[id]/_components/entities-list.tsx"
    - "apps/web/src/app/emails/[id]/_components/email-detail.tsx"
    - "apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx"
decisions:
  - "D-16: Reprocess uses variant=default not destructive — supersede semantics, confirmed data never deleted"
  - "Component.extractedFields typed as unknown in entities-list; narrowed inline at FieldsPanel callsite"
  - "confidenceScore typed as unknown in Component interface; narrowed with parseFloat for string API shape"
  - "getStatusBadge copied verbatim from entities-list into fields-panel to maintain consistency without shared util"
metrics:
  duration: "~45 min"
  completed: "2026-06-13T01:00:00Z"
  tasks_completed: 3
  files_changed: 5
---

# Phase 07 Plan 03: Autofill Review Panel (FieldsPanel + Reprocess) Summary

Inline autofill fields review panel, non-destructive Reprocess dialog, and end-to-end wiring of the `useAutofill` state machine into the email detail view.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create FieldsPanel and ReprocessDialog | d1d6b14 | fields-panel.tsx, reprocess-dialog.tsx |
| 2 | Add inline FieldsPanel slot to EntitiesList | 4691f9a | entities-list.tsx |
| 3 | Wire useAutofill + Reprocess into email-detail; final gates | 94bb527 | email-detail.tsx, pdf-preview-pane.tsx |

## What Was Built

**FieldsPanel** (`fields-panel.tsx`): Inline extraction fields panel with 4 phases:
- `extracting` — spinner with `aria-busy="true"` and `Loader2` animation
- `reviewing` / `confirming` — editable `<Input>` rows with per-field confidence score coloring (red < 50%, muted otherwise), Confirm/Discard action row
- `confirmed` — read-only `<p>` values + green "Confirmed" badge, no action row

**ReprocessDialog** (`reprocess-dialog.tsx`): Non-destructive AlertDialog cloned from `reject-dialog.tsx` with `buttonVariants({ variant: "default" })` (not "destructive" per D-16). Copy per §6.7: title "Reprocess this email?", cancel "Keep current data", action "Reprocess Email".

**EntitiesList** (`entities-list.tsx`): Extended with 6 new optional autofill props. List items changed from `flex items-center` to `flex flex-col`. Each row now conditionally renders `<FieldsPanel>` inline below it when the component's autofill phase is extracting/reviewing/confirming/confirmed.

**email-detail.tsx**: Added `useAutofill`, `ReprocessDialog`, reprocess mutation, entity types query, and entity type fields map. Reprocess button added to header (outlined, non-destructive). All 6 autofill props wired into `<EntitiesList>`. 4 autofill passthrough props wired into `<PdfPreviewPane>`.

**pdf-preview-pane.tsx**: 4 autofill props added to interface and function signature; forwarded directly to `<ActionToolbar>`.

## Final Gate Results

| Gate | Result |
|------|--------|
| `apps/web npm run typecheck` | exit 0 |
| `apps/web npm run build` | exit 0 — 4/4 static pages, `/emails/[id]` 168 kB |
| `packages/api-client npm run test` | 27/27 passed |
| `packages/api-client npm run typecheck` | exit 0 |
| `git status apps/email-listener` | clean — backend untouched |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript unknown typing for extraction fields in Component interface**
- **Found during:** Task 2 typecheck
- **Issue:** `entities-list.tsx` Component interface had `extractedFields?: Record<string, unknown> | null` and `confidenceScore?: number | null`, but the API returns these as `unknown` and `string | null` respectively
- **Fix:** Retyped all 4 extraction fields as `unknown` in the Component interface; added explicit narrowing casts inline at the FieldsPanel callsite (`typeof ... === "object"`, `parseFloat()`)
- **Files modified:** `entities-list.tsx`
- **Commit:** 4691f9a

## Known Stubs

None — all autofill data flows through live tRPC queries (`api.entityTypes.list`, `api.emails.detail`) and real mutations (`api.emails.autofillComponent`, `api.emails.confirmComponent`, `api.emails.reprocessEmail`). No hardcoded mock values.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced. All mutations use existing tRPC procedures authenticated server-side. React auto-escaping prevents XSS on all user-entered field values (no `dangerouslySetInnerHTML` per T-07-09).

## Self-Check: PASSED

- fields-panel.tsx: exists at `apps/web/src/app/emails/[id]/_components/fields-panel.tsx`
- reprocess-dialog.tsx: exists at `apps/web/src/app/emails/[id]/_components/reprocess-dialog.tsx`
- Commits d1d6b14, 4691f9a, 94bb527: all present in git log
- Build exit 0: confirmed above
- Backend untouched: git status apps/email-listener clean
