---
phase: "07"
plan: "02"
subsystem: web-ui
tags: [autofill, state-machine, entity-type-picker, react-hook, trpc]
dependency_graph:
  requires: [07-01]
  provides: [useAutofill, EntityTypePicker, ActionToolbar.autofill]
  affects: [apps/web/src/app/emails/[id]/_components]
tech_stack:
  added: []
  patterns: [tRPC-useMutation, Radix-Popover, controlled-state-machine-hook]
key_files:
  created:
    - apps/web/src/app/emails/[id]/_components/use-autofill.ts
    - apps/web/src/app/emails/[id]/_components/entity-type-picker.tsx
  modified:
    - apps/web/src/app/emails/[id]/_components/action-toolbar.tsx
decisions:
  - "allDisabled = disabled || autofillExtracting applied to all ActionToolbar buttons (07-UI-SPEC §3.4)"
  - "EntityTypePicker receives trigger as ReactNode for flexible popover anchor"
  - "api-client dist rebuilt before typecheck (Phase 7 procedures not in prior dist)"
  - "discardFields clears local state only, no API call (D-16 compliance)"
  - "correctedFields diff sends null when no user edits, not empty object"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-12"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
---

# Phase 7 Plan 02: Autofill UI — State Machine Hook + Entity Type Picker + Toolbar Integration Summary

**One-liner:** React state-machine hook (idle→picking→extracting→reviewing→confirming→confirmed) with controlled EntityTypePicker Popover and ActionToolbar autofill button wired to tRPC Phase 7 mutations.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create `use-autofill.ts` hook | `7df413a` | `use-autofill.ts` (created) |
| 2 | Create `entity-type-picker.tsx` component | `4da300d` | `entity-type-picker.tsx` (created) |
| 3 | Extend `action-toolbar.tsx` with autofill button | `47a36d9` | `action-toolbar.tsx` (modified) |

## What Was Built

### Task 1 — `useAutofill` Hook
- Exports `AutofillPhase` type (7 states), `ExtractionResult` interface, `AutofillState` interface, and `useAutofill({ emailId })` function
- Wires `api.emails.autofillComponent.useMutation` (no optimistic update; on error resets to idle + exact verbatim toast)
- Wires `api.emails.confirmComponent.useMutation` (invalidates `emails.detail` on success)
- Snake_case → camelCase mapping: `extracted_fields` → `extractedFields`, `confidence_score` → `confidenceScore`, `confidence_breakdown` → `confidenceBreakdown`
- Verbatim error toast: `"AI autofill is unavailable — model access is pending."` with `duration: 6000`
- `correctedFields` diff: sends only keys where current value differs from extracted; `null` if no changes
- `discardFields` clears local state only — no API call (D-16)
- Full immutable state updates throughout (spread operator)

### Task 2 — `EntityTypePicker` Component
- Controlled Popover (`open`, `onOpenChange`, `onSelect`, `trigger` props)
- Internally calls `api.entityTypes.list.useQuery(undefined, { enabled: open })`
- Width `w-72`, heading "Select entity type"
- `role="listbox"` on options container; `role="option"` `aria-selected="false"` on each row
- Skeleton loading state (3 placeholder rows)
- Empty state: "No entity types available."
- Each row shows `label` + optional `description`

### Task 3 — `action-toolbar.tsx` Extended
- New props: `onAutofill?`, `autofillPickerOpen?`, `onAutofillPickerChange?`, `autofillExtracting?`
- `allDisabled = disabled || autofillExtracting` applied to Accept, Reject, Redraw, Split, Merge buttons
- Autofill button logic per 07-UI-SPEC §3.1:
  - `candidate` status + `onAutofill` present → EntityTypePicker with enabled trigger
  - `pending` status → disabled button with tooltip "Accept the region first"
  - `rejected`/`superseded` → disabled button with tooltip "Region is not active"
  - `confirmed` → no button rendered (absent)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] api-client dist out of date — Phase 7 procedures not compiled**
- **Found during:** Task 1 typecheck
- **Issue:** `api.emails.autofillComponent` and `api.emails.confirmComponent` existed in source (`packages/api-client/src/router/emails/mutations.ts`) but not in `dist/`. Typecheck in `apps/web` failed with `Property 'autofillComponent' does not exist on type ...`
- **Fix:** Ran `npm run build --workspace=packages/api-client` to rebuild dist; dist is gitignored so no commit needed
- **Files modified:** `packages/api-client/dist/` (rebuilt, not committed)
- **Commit:** No separate commit — fix applied before Task 1 commit

## Known Stubs

None — all data flows are wired to real tRPC procedures.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary crossings introduced. All mutations were already present in 07-01.

## Self-Check: PASSED

- `apps/web/src/app/emails/[id]/_components/use-autofill.ts` — FOUND
- `apps/web/src/app/emails/[id]/_components/entity-type-picker.tsx` — FOUND
- `apps/web/src/app/emails/[id]/_components/action-toolbar.tsx` — FOUND (modified)
- Commit `7df413a` — FOUND (useAutofill hook)
- Commit `4da300d` — FOUND (EntityTypePicker)
- Commit `47a36d9` — FOUND (ActionToolbar extension)
- `npm run typecheck` — PASSED
- `npm run build` — PASSED (165 kB route, no errors)
