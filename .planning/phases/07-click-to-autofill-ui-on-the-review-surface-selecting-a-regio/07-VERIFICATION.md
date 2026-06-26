---
phase: 07-click-to-autofill-ui
verified: 2026-06-13T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Click Autofill Fields on a candidate region, pick an entity type from the popover, and wait for the AI response"
    expected: "The entity-type picker opens (w-72, labelled 'Select entity type'); picking a type fires the autofill mutation; while in-flight all toolbar buttons are disabled; on success an inline FieldsPanel appears below the region row showing editable extracted fields with per-field confidence badges"
    why_human: "Requires a live browser session with an ingested PDF email; verifies the Bedrock cold-start + few-shot path end-to-end now that Bedrock is unblocked"
  - test: "Edit one or more fields in the FieldsPanel then click 'Confirm Fields'"
    expected: "The panel becomes read-only, the 'Confirmed' badge (bg-primary, text-xs font-semibold) appears, and the emails.detail tRPC query is invalidated (network request visible in DevTools)"
    why_human: "Requires live browser; verifies that correctedFields diff is computed correctly and the confirmComponent mutation persists the edit"
  - test: "Click 'Reprocess Email' in the header, verify dialog text, then click 'Reprocess Email' in the dialog"
    expected: "AlertDialog opens with title 'Reprocess this email?', cancel button reads 'Keep current data', confirm button reads 'Reprocess Email' and uses the default (not destructive) variant; confirming shows a success toast and refreshes the detail query"
    why_human: "Requires live browser; verifies D-16 (supersede-never-delete) and non-destructive dialog variant are correct at runtime"
---

# Phase 7: Click-to-Autofill UI Verification Report

**Phase Goal:** Close the learning-flywheel loop from the browser: selecting a candidate region triggers AI autofill via a server-side tRPC proxy, renders candidate extracted fields with per-field confidence, and lets the human confirm with optional corrections. TS-only: FastAPI backend NOT modified; browser never holds EMAIL_LISTENER_API_KEY.
**Verified:** 2026-06-13
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Server-side proxy for autofill/confirm/reprocess never exposes API key to browser | VERIFIED | `mutations.ts`: `getListenerConfig()` reads `process.env.EMAIL_LISTENER_API_KEY` server-side; 0 `NEXT_PUBLIC_` references in entire api-client/src; Zod UUID validation before URL interpolation |
| 2 | entityTypes.list Drizzle query returns active types with grouped fields | VERIFIED | `entity-types.ts`: leftJoin on EntityTypeFields, `where(eq(EntityTypes.isActive, true))`, `groupEntityTypeRows` pure helper; `entityTypes` registered on `appRouter` in `root.ts` |
| 3 | emails.detail exposes correctedFields, confidenceBreakdown, extractionRecordStatus | VERIFIED | `detail.ts` select block contains all three fields; CR-03 filter `ne(status, "superseded")` preserved |
| 4 | Candidate region shows enabled Autofill Fields button; pending shows disabled with tooltip; terminal shows disabled | VERIFIED | `action-toolbar.tsx` lines 288-336: three conditional branches keyed on `status === "candidate"`, `status === "pending"`, `isTerminal`; `allDisabled = disabled || autofillExtracting` gates entire toolbar |
| 5 | EntityTypePicker opens on click, fires autofill mutation on row selection | VERIFIED | `entity-type-picker.tsx`: Radix Popover w-72, `api.entityTypes.list.useQuery({ enabled: open })`, role="listbox", Skeleton loading, empty state; wired in `action-toolbar.tsx` with `onAutofill` callback |
| 6 | Failure path fires verbatim 6-second toast; region returns to idle | VERIFIED | `use-autofill.ts`: `toast.error("AI autofill is unavailable — model access is pending.", { duration: 6000 })`; onError sets state back to idle |
| 7 | FieldsPanel renders editable inputs with per-field confidence; Confirm Fields persists via confirmComponent; Discard Fields clears local state only | VERIFIED | `fields-panel.tsx`: reviewing/confirming phases show editable Input rows; confidence below 0.5 → `text-destructive`; "Confirm Fields" variant="default"; "Discard Fields" variant="ghost"; `use-autofill.ts` discardFields makes NO API call (D-16 compliant) |
| 8 | ReprocessDialog uses non-destructive variant with correct copy ("Keep current data") | VERIFIED | `reprocess-dialog.tsx`: title "Reprocess this email?", cancel "Keep current data", action `buttonVariants({ variant: "default" })` — not "destructive" per D-16 |
| 9 | FastAPI backend untouched; full wiring: useAutofill → ActionToolbar → EntitiesList → FieldsPanel → email-detail | VERIFIED | `git status apps/email-listener` clean (no modifications); `email-detail.tsx` mounts `useAutofill`, passes `autofill.*` props to both ActionToolbar and EntitiesList; `entities-list.tsx` renders `<FieldsPanel>` inline when `shouldShowPanel`; `ReprocessDialog` mounted in header |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api-client/src/router/emails/mutations.ts` | autofillComponent, confirmComponent, reprocessEmail mutations | VERIFIED | Contains all 3 mutations with UUID validation and server-side key |
| `packages/api-client/src/router/entity-types.ts` | entityTypesRouter with list query | VERIFIED | 138 lines; Drizzle leftJoin + groupEntityTypeRows |
| `packages/api-client/src/router/emails/detail.ts` | correctedFields, confidenceBreakdown, extractionRecordStatus in select | VERIFIED | All three fields confirmed in select block |
| `packages/api-client/src/root.ts` | entityTypes router registered | VERIFIED | `entityTypes: entityTypesRouter` in appRouter |
| `packages/api-client/src/router/__tests__/mutations.test.ts` | vitest coverage of 3 mutations | VERIFIED | File exists; confirmed present |
| `packages/api-client/src/router/__tests__/entity-types.test.ts` | vitest coverage of groupEntityTypeRows | VERIFIED | File exists |
| `apps/web/src/app/emails/[id]/_components/use-autofill.ts` | 7-state machine hook (min 80 lines) | VERIFIED | 235 lines; full state machine + verbatim toast + correctedFields diff |
| `apps/web/src/app/emails/[id]/_components/entity-type-picker.tsx` | Popover w-72, role=listbox, entityTypes.list | VERIFIED | 93 lines; all UI-SPEC requirements present |
| `apps/web/src/app/emails/[id]/_components/action-toolbar.tsx` | Autofill Fields button states | VERIFIED | Three conditional branches for candidate/pending/terminal states |
| `apps/web/src/app/emails/[id]/_components/fields-panel.tsx` | Inline fields panel (min 90 lines) | VERIFIED | Substantive; all 4 phases; Confirmed badge; confidence coloring |
| `apps/web/src/app/emails/[id]/_components/reprocess-dialog.tsx` | Non-destructive AlertDialog | VERIFIED | Correct copy; variant="default" on action |
| `apps/web/src/app/emails/[id]/_components/entities-list.tsx` | FieldsPanel slot below region row | VERIFIED | `shouldShowPanel` guard; FieldsPanel imported and rendered inline |
| `apps/web/src/app/emails/[id]/_components/email-detail.tsx` | Full useAutofill wiring + Reprocess button | VERIFIED | useAutofill mounted; all autofill props threaded; ReprocessDialog in header; entityTypeFieldsMap built from entityTypes.list |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `entity-types.ts` | `root.ts` | appRouter `entityTypes: entityTypesRouter` | WIRED | Confirmed by reading root.ts |
| `mutations.ts` | FastAPI `/v1/components/{id}/autofill` | `fetch` with X-API-Key from `getListenerConfig()` | WIRED | `process.env.EMAIL_LISTENER_API_KEY` server-side only; `/autofill` path confirmed |
| `entity-type-picker.tsx` | `api.entityTypes.list` | `useQuery(undefined, { enabled: open })` | WIRED | Lazy fetch on picker open |
| `use-autofill.ts` | `api.emails.autofillComponent` | `useMutation` with onSuccess/onError | WIRED | State transitions + toast on error confirmed |
| `email-detail.tsx` | `useAutofill` | Hook instantiated; props threaded to ActionToolbar + EntitiesList | WIRED | `const autofill = useAutofill({ emailId })` at line 112 |
| `email-detail.tsx` | `api.emails.reprocessEmail` | `useMutation` with `utils.emails.detail.invalidate` on success | WIRED | Lines 121-127 in email-detail.tsx |
| `entities-list.tsx` | `FieldsPanel` | `shouldShowPanel` guard renders inline below region `<li>` | WIRED | Lines 224-337 in entities-list.tsx |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `entity-type-picker.tsx` | `data` from `entityTypes.list.useQuery` | Drizzle DB query via tRPC server | Yes — leftJoin with isActive filter | FLOWING |
| `fields-panel.tsx` | `extractedFields`, `confidenceBreakdown`, `fieldValues` | Returned from `/autofill` endpoint; stored in `useAutofill` state | Yes — real Bedrock response or error | FLOWING (when Bedrock available) |
| `email-detail.tsx` | `entityTypeFieldsMap` | `api.entityTypes.list.useQuery()` result mapped to slug→fields | Yes — DB-backed | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — Phase 7 is a browser-UI phase. The only runnable checks are API-client tests. The SUMMARY documents 27/27 vitest tests passing; test files confirmed to exist at `packages/api-client/src/router/__tests__/mutations.test.ts` and `entity-types.test.ts`. Live browser interaction required for behavioral verification (see Human Verification section).

### Probe Execution

No probe scripts declared in PLAN files. No `scripts/*/tests/probe-*.sh` found matching this phase. Step 7c: SKIPPED.

### Requirements Coverage

No formal REQ-IDs mapped to Phase 7 per ROADMAP.md ("Decision-driven — no REQ-IDs mapped"). All must-haves derive from 07-CONTEXT.md and 07-UI-SPEC.md, which were verified by reading the relevant code artifacts directly.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TBD/FIXME/XXX found in any Phase 7 modified file | — | — |
| (none) | — | `return null` in helper functions only (`getFieldScore`, `getPageIndex`) — not component render paths | — | Not stubs |

No debt markers, no hollow returns in render paths, no NEXT_PUBLIC_ key exposure, no console.log in production paths (except one `console.error` in error boundary in email-detail.tsx — correct per logging guidelines: detailed error logged client-devtools, friendly message shown to user).

### Human Verification Required

All machine-verifiable criteria pass. Three items require a live browser session:

#### 1. Live Autofill Round-Trip (Bedrock Now Unblocked)

**Test:** Open an email with an ingested PDF attachment. Select a candidate region in the PDF preview pane. Click "Autofill Fields" in the action toolbar. In the entity-type picker, select an entity type. Wait for the extraction to complete.
**Expected:** Picker opens as a w-72 popover labelled "Select entity type". All toolbar buttons disable during extraction (aria-busy spinner in FieldsPanel). On success: an inline FieldsPanel appears below the region row in EntitiesList showing editable field inputs, per-field confidence scores (red text-destructive if below 50%), and overall confidence score.
**Why human:** Requires live Bedrock response to verify the full happy path — extraction result stored in `useAutofill` state, snake_case→camelCase mapping applied, fields rendered.

#### 2. Edit + Confirm Fields

**Test:** After autofill succeeds (step 1), edit one or more field values in the inline FieldsPanel. Click "Confirm Fields".
**Expected:** confirmComponent mutation fires with the corrected fields diff (only changed keys, null if all unchanged). Panel transitions to confirmed state: inputs become read-only `<p>` tags, the "Confirmed" badge (bg-primary background, text-primary-foreground, text-xs font-semibold) appears. emails.detail tRPC cache is invalidated (verify via network tab).
**Why human:** Requires live mutation round-trip to verify correctedFields diff logic and the DB write that turns the component into a few-shot example (D-15).

#### 3. Reprocess Dialog Round-Trip (D-16)

**Test:** On the email detail page, click "Reprocess Email" in the header. Inspect the AlertDialog that opens. Click "Reprocess Email" in the dialog.
**Expected:** Dialog title is "Reprocess this email?". Cancel button reads "Keep current data". Confirm button reads "Reprocess Email" and is visually styled as the default (non-destructive) variant — not red. Clicking confirm fires reprocessEmail mutation, shows success toast "Email sent for reprocessing", and refreshes emails.detail.
**Why human:** Requires live browser to verify visual variant (default vs destructive button color), toast appearance, and cache invalidation in the network tab.

### Gaps Summary

No gaps found. All 9 observable truths are verified by codebase evidence. The phase goal — closing the learning-flywheel loop from the browser — is structurally complete in shipped code. Status is `human_needed` because three live browser UAT items remain that require Bedrock to be active (now unblocked) and a running Next.js dev/preview session.

---

_Verified: 2026-06-13_
_Verifier: Claude (gsd-verifier)_
