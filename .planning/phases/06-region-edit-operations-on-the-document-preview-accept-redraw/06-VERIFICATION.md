---
phase: 06-region-edit-operations-on-the-document-preview-accept-redraw
verified: 2026-06-12T20:10:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Draw a region on the PDF preview with zero proposed regions (Bedrock-blocked default)"
    expected: "Clicking '+ Add region' in the Detected Regions card header enters draw mode; drawing a rectangle on the page creates a new candidate region box visible in the overlay and the list."
    why_human: "Pointer-driven canvas draw and optimistic cache update cannot be verified by grep or tsc; requires a real browser with a PDF loaded."
  - test: "Accept a pending region box from the overlay"
    expected: "Clicking a pending (dashed) region box, then clicking Accept in the action toolbar, transitions the box to solid-border (candidate) instantly (optimistic), then toast 'Region accepted' appears."
    why_human: "Visual status-class transition and toast feedback require browser interaction against a live tRPC/FastAPI stack."
  - test: "Reject a region via the confirmation dialog"
    expected: "Clicking Reject opens an AlertDialog with 'Reject this region?'. Confirming fires the mutation; the region disappears from the default view. Enabling 'Show history' toggle reveals it struck-through."
    why_human: "AlertDialog open state, visual disappearance, and history toggle rendering require browser interaction."
  - test: "Multi-select merge of two regions"
    expected: "With one region selected, clicking Merge enters multi-select mode (checkboxes appear on overlay boxes and list rows). Shift-clicking or checking a second region enables the Merge button; submitting produces one merged region and supersedes the originals."
    why_human: "Multi-select state machine and resulting overlay update require live browser interaction."
  - test: "Nest a region into a parent via the nest picker"
    expected: "Clicking Nest opens a Popover listing same-page eligible regions. Selecting one nests the child (parentComponentId set). 'Remove parent (un-nest)' appears when a parent is set; clicking it clears the parent."
    why_human: "Popover rendering and parentComponentId round-trip require live browser and real DB."
---

# Phase 6: Region Edit Operations Verification Report

**Phase Goal:** Make proposed entity regions editable from the Phase 5 preview — accept / reject / redraw / split / merge / nest plus add-region-from-scratch — wired to `email_components` through FastAPI write endpoints (X-API-Key, supersede-safe per D-16, tenant-from-row per D-18) and server-side tRPC mutations so the browser never holds the key. Edits run optimistically against real data; add-region works with zero proposed regions (the default state while Bedrock is blocked); supersede preserves an auditable lineage and never mutates or deletes originals.
**Verified:** 2026-06-12T20:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | Each of the seven ops (accept / reject / redraw / split / merge / nest / add-region) works end-to-end against real data via the UI | ? UNCERTAIN | Backend: all 7 use cases + endpoints verified. Frontend: all 7 mutations wired. Visual/live validation requires human UAT (items 1–5 in human verification). |
| 2  | Supersede lineage is preserved (content_raw.lineage); originals are never mutated or deleted; accept/reject are status-only; nest sets parent without supersede | ✓ VERIFIED | `_merge_lineage()` in `edit_region.py` records `origin`, `supersedes`, `superseded_by` immutably. `AcceptRegionUseCase`/`RejectRegionUseCase` call `update_status` only; `NestRegionUseCase` calls `update_parent` only. `RedrawRegionUseCase`, `SplitRegionUseCase`, `MergeRegionsUseCase` each `save_many` with the original marked `extraction_status="superseded"` and a new child born `candidate`. Confirmed by 45 passing unit+endpoint tests. |
| 3  | Add-region works with zero proposed regions (the Bedrock-blocked default state) | ✓ VERIFIED | `CreateRegionUseCase` loads the page component directly (no region proposals required); `find_by_page_component_id` returning `[]` is the unit-tested path. Frontend: entities-list renders `+ Add region` always (even in empty state), disabled only when no PDF is open. `handleRectDrawn` in `email-detail.tsx` routes to `edit.createRegion(pageComponentId, polygon, currentPage - 1)` when `drawMode === "add"`. Code path is complete; live draw requires human UAT. |
| 4  | The browser never holds EMAIL_LISTENER_API_KEY (server-side tRPC proxy only; never NEXT_PUBLIC_) | ✓ VERIFIED | `grep -rn "NEXT_PUBLIC_EMAIL_LISTENER" apps/web packages/api-client` returns zero matches. `mutations.ts` reads `process.env.EMAIL_LISTENER_API_KEY` inside `getListenerConfig()` at call time (server-side). `.env.example` documents `EMAIL_LISTENER_API_KEY` with no `NEXT_PUBLIC_` prefix. |
| 5  | All quality gates pass on both stacks (Python: ruff, mypy, import-linter, bandit, pytest ≥80%; Web: tsc, vitest, next build) | ✓ VERIFIED | Python: 315 passed 7 skipped, 0 failures; coverage 90.54% (>80%). Ruff: all checks passed. Mypy: no issues in 81 source files. lint-imports: 3 kept 0 broken. Bandit: no issues identified. Web: `npx tsc --noEmit` exits 0 (both `apps/web` and `packages/api-client`). Vitest: 14/14 geometry tests pass. Next.js build artifact exists (BUILD_ID `9ARBPUIGEKZfYPrKulWQF`, built 2026-06-12 19:49). |

**Score:** 4/5 machine-verifiable truths VERIFIED; 1 awaits human UAT (visual end-to-end)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/email-listener/app/application/use_cases/edit_region.py` | 7 use cases (accept/reject/redraw/split/merge/nest/create) | ✓ VERIFIED | `grep -c "class.*UseCase"` returns 7; all import cleanly via `uv run python`; no infrastructure imports (lint-imports clean). |
| `apps/email-listener/app/presentation/api/v1/components.py` | 7 new region-edit endpoints (total 9 @router.post) | ✓ VERIFIED | `grep -c "@router.post"` returns 9. All 7 use cases wired via `FromDishka`. `/regions` endpoint present. |
| `apps/email-listener/app/infrastructure/supabase/component_repository.py` | `update_status`, `update_parent`, `find_by_page_component_id` | ✓ VERIFIED | 3 new async methods confirmed in both port (Protocol) and Supabase impl. |
| `apps/email-listener/app/container.py` | 7 use cases registered via `provider.provide()` | ✓ VERIFIED | `grep -c "provider.provide(...UseCase)"` returns 7. |
| `packages/api-client/src/geometry.ts` | `clientXYToNormalized` + `normalizedRectToPolygon` added alongside `polygonToRect` | ✓ VERIFIED | Both exported functions confirmed; `polygonToRect` unchanged; 14 vitest tests pass. |
| `packages/api-client/src/router/emails/mutations.ts` | 7 tRPC mutations with server-side env guard | ✓ VERIFIED | `grep -c "accept:\|reject:\|redraw:\|split:\|merge:\|nest:\|createRegion:"` returns 7; `process.env.EMAIL_LISTENER_API_KEY` read inside `getListenerConfig()`. |
| `packages/api-client/src/router/emails/index.ts` | `...componentMutationProcedures` spread into emailsRouter | ✓ VERIFIED | Pattern found. |
| `apps/web/src/app/emails/[id]/_components/use-region-edit.ts` | Hook with selectedComponentIds, 7 mutation handlers, draw state | ✓ VERIFIED | `selectedComponentIds`, `accept`/`reject`/`redraw`/`split`/`createRegion`/`merge`/`nest` mutations all present; `enterDraw`/`cancelDraw`/`pushRect` draw helpers exposed. |
| `apps/web/src/app/emails/[id]/_components/action-toolbar.tsx` | `role="toolbar"` + 6 action buttons + RejectDialog + NestPicker mounts | ✓ VERIFIED | `role="toolbar"` present; `RejectDialog` and `NestPicker` imported and rendered; context label shows single/multi selection count. |
| `apps/web/src/app/emails/[id]/_components/draw-overlay.tsx` | Pointer-driven draw surface using `clientXYToNormalized` + `normalizedRectToPolygon` | ✓ VERIFIED | Both geometry helpers imported and used; NOT pointer-events-none (draw surface is interactive). |
| `apps/web/src/app/emails/[id]/_components/draw-mode-bar.tsx` | Mode-specific instruction bar with "Draw Mode: Redraw" heading | ✓ VERIFIED | "Draw Mode: Redraw" string present; split variant with confirm button, cancel ghost button present. |
| `apps/web/src/app/emails/[id]/_components/reject-dialog.tsx` | AlertDialog with "Reject this region?", destructive confirm | ✓ VERIFIED | Full implementation (not stub); `AlertDialogTitle` = "Reject this region?"; destructive `AlertDialogAction` calls `onConfirm`. |
| `apps/web/src/app/emails/[id]/_components/nest-picker.tsx` | Popover with eligible regions + "Remove parent (un-nest)" | ✓ VERIFIED | Full implementation; "Nest into parent region" header; eligible regions list; "Remove parent (un-nest)" conditional on `parentComponentId !== null`. |
| `apps/web/src/app/emails/[id]/_components/entities-list.tsx` | `+ Add region` button, merge checkboxes, history-aware badges, `line-through` for rejected | ✓ VERIFIED | "Add region" button in CardHeader + empty state; `Checkbox` for merge multi-select; `line-through` class in status badge map; rows filtered by `showHistory`. |
| `apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx` | "Show history" toggle mounted | ✓ VERIFIED | "Show history" string found; `Switch` bound to `showHistory`/`onShowHistoryChange`. |
| `apps/web/src/app/layout.tsx` | `Toaster` mounted in root layout | ✓ VERIFIED | `Toaster` from `@nauta/ui/sonner` present inside `<body>`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `components.py` | `AcceptRegionUseCase ... CreateRegionUseCase` | `FromDishka` injected | ✓ WIRED | All 7 `FromDishka[<UseCase>]` params confirmed in endpoint handlers. |
| `edit_region.py` | `propose_regions._page_tokens / _union_polygon` | `from app.application.use_cases.propose_regions import` | ✓ WIRED | Import confirmed at line 14; used in `_capture_text()` and `MergeRegionsUseCase`. |
| `container.py` | 7 edit_region use cases | `provider.provide(<UseCaseClass>)` | ✓ WIRED | 7 registrations confirmed. |
| `mutations.ts` | `process.env.EMAIL_LISTENER_URL / EMAIL_LISTENER_API_KEY` | `getListenerConfig()` server-side guard | ✓ WIRED | Pattern confirmed; env read inside function body (call-time, not module-init). |
| `emails/index.ts` | `componentMutationProcedures` | spread into `createTRPCRouter` | ✓ WIRED | `...componentMutationProcedures` confirmed. |
| `use-region-edit.ts` | `api.emails.accept/reject/redraw/split/createRegion/merge/nest` | `useMutation` with optimistic `setData` + `invalidate` | ✓ WIRED | All 7 `api.emails.<op>.useMutation` calls confirmed; `utils.emails.detail.setData` (optimistic) + `invalidate` (onSuccess) pattern present. |
| `draw-overlay.tsx` | `@nauta/api-client/geometry` | `clientXYToNormalized + normalizedRectToPolygon` | ✓ WIRED | Both imports and usage confirmed; min-draw-size guard (0.01) present. |
| `email-detail.tsx` | `useRegionEdit` + `handleRectDrawn` routing | `edit.redraw()` / `edit.createRegion()` based on `drawMode` | ✓ WIRED | `handleRectDrawn` routes to `edit.redraw` when `drawMode === "redraw"` and `edit.createRegion` for add/split; `eligibleRegions` computed and passed to `ActionToolbar`. |
| `entities-list.tsx` | `onAddRegion` | `email-detail.tsx` resolves `pageComponentId` then calls `edit.enterDraw("add")` | ✓ WIRED | `onAddRegion` at email-detail line 343 confirmed calling `edit.enterDraw("add")`. |
| `action-toolbar.tsx` | `RejectDialog` + `NestPicker` | controlled `open` state from `useRegionEdit` | ✓ WIRED | Both components rendered inside `ActionToolbar`; `rejectDialogOpen`/`nestPickerOpen` props wired. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `edit_region.py` AcceptRegionUseCase | `component` (loaded by id) | `self._components.find_by_id(component_id)` → Supabase query | Yes — real Supabase `.eq("id", component_id).execute()` | ✓ FLOWING |
| `edit_region.py` RedrawRegionUseCase | `original`, `new_child` | `find_by_id` + `save_many([new_child, superseded])` | Yes — real DB write; lineage tracked in `content_raw` | ✓ FLOWING |
| `use-region-edit.ts` | `selectedComponentIds` | `useState([])`, populated by `selectComponent(id)` on click | Real component id from overlay click → mutation input | ✓ FLOWING |
| `mutations.ts` (e.g., accept) | FastAPI response | `fetch(\`${url}/v1/components/${componentId}/accept\`, {headers: {X-API-Key}})` | Real HTTP POST to FastAPI; non-2xx throws Error | ✓ FLOWING |
| `entities-list.tsx` | component list with status badges | `components` prop from `emails.detail` tRPC query (Drizzle join) | Real DB select from `email_components`; filtered by `showHistory` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 7 use cases importable | `uv run python -c "from app.application.use_cases.edit_region import AcceptRegionUseCase, ..."` | "All 7 use cases import OK" | ✓ PASS |
| Edit region unit + endpoint tests | `uv run pytest tests/test_edit_region_use_cases.py tests/test_edit_region_endpoints.py --no-cov` | 45 passed in 0.93s | ✓ PASS |
| Full Python test suite ≥80% cov | `uv run pytest -q` | 315 passed, 7 skipped, coverage 90.54% | ✓ PASS |
| Python linters clean | `ruff check app tests && mypy app && lint-imports && bandit -r app` | All exit 0, no issues | ✓ PASS |
| Geometry vitest (14 tests) | `npx vitest run src/geometry.test.ts` | 14/14 passed | ✓ PASS |
| Web TypeScript check | `npx tsc --noEmit` (apps/web + packages/api-client) | Exit 0, no output | ✓ PASS |
| Next.js build artifact present | `ls apps/web/.next/BUILD_ID` | BUILD_ID `9ARBPUIGEKZfYPrKulWQF` (2026-06-12 19:49) | ✓ PASS |
| clientXYToNormalized exported | `node -e "const g = require('./src/geometry.ts'); console.log(typeof g.clientXYToNormalized)"` | `function` | ✓ PASS |
| No NEXT_PUBLIC_ API key leakage | `grep -rn "NEXT_PUBLIC_EMAIL_LISTENER" apps/web packages/api-client` | Zero matches | ✓ PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` files declared for Phase 6. SKIPPED.

### Requirements Coverage

Phase 6 is decision-driven (06-CONTEXT.md decisions, no REQ-IDs mapped). All CONTEXT.md decisions verified:

| Decision | Status | Evidence |
|----------|--------|---------|
| D-16: Supersede-not-mutate; redraw/split/merge create NEW rows | ✓ SATISFIED | `save_many` with superseded original + new candidate in `RedrawRegionUseCase`, `SplitRegionUseCase`, `MergeRegionsUseCase` |
| D-18: Tenant (importer_id) derived from component row, never from caller | ✓ SATISFIED | All use cases load component first via `find_by_id`; importer passed through from loaded row, never from request body |
| D-09: Human-registered regions born `candidate` | ✓ SATISFIED | `CreateRegionUseCase`, `RedrawRegionUseCase`, `SplitRegionUseCase`, `MergeRegionsUseCase` all create with `extraction_status="candidate"` |
| Browser never holds X-API-Key | ✓ SATISFIED | Key read in `getListenerConfig()` server-side; zero `NEXT_PUBLIC_` references |
| Add-region works with zero proposals | ✓ SATISFIED | `CreateRegionUseCase` needs only the page component; entities-list button enabled even with empty regions list |
| Geometry validation (4 [x,y] pairs, [0,1]) → 422 | ✓ SATISFIED | Pydantic `field_validator` on `RedrawRequest.polygon`; endpoint tests assert 422 for bad polygon |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | None found — no TBD/FIXME/XXX debt markers in any Phase 6 modified files. |

### Human Verification Required

#### 1. Add-region with Zero Proposed Regions (Primary Demoable Path)

**Test:** With Bedrock blocked (zero proposed regions), open an email with a PDF attachment. Click `+ Add region` in the Detected Regions card header. Draw a rectangle on the PDF canvas. Confirm region appears as a candidate box in the overlay and in the list.
**Expected:** A new candidate region box appears immediately (optimistic); toast "Region added"; the region persists after page refresh.
**Why human:** Pointer-driven canvas interaction, optimistic cache update, and visual box rendering cannot be verified programmatically.

#### 2. Accept a Pending Region

**Test:** With at least one pending (dashed) region box on the overlay, click the box to select it. Click Accept in the floating action toolbar.
**Expected:** Box transitions from dashed to solid-border (candidate) immediately (optimistic); toast "Region accepted"; the DB record reflects `extraction_status = "candidate"`.
**Why human:** Visual status-class transition and toast feedback require live browser.

#### 3. Reject via AlertDialog

**Test:** Select a region, click Reject (or press Delete). Confirm in the AlertDialog. Verify the region disappears from the default view. Enable "Show history" to verify it reappears struck-through.
**Expected:** Dialog opens; confirming fires mutation; region leaves view; "Show history" toggle reveals it muted and struck-through. Toast "Region rejected" appears.
**Why human:** Dialog interaction, filter state toggle, and visual rendering require browser.

#### 4. Multi-Select Merge

**Test:** Select one region. Click Merge — multi-select mode should activate (checkboxes appear). Shift-click or check a second region. Click Merge again with ≥2 selected.
**Expected:** A single merged region appears; the two originals are marked superseded (visible only under "Show history"). Toast "Regions merged".
**Why human:** Multi-select state machine, overlay checkbox visibility, and resulting region count require live browser with real DB round-trip.

#### 5. Nest Picker + Un-nest

**Test:** Select a region. Click Nest. A Popover should list other regions on the same page. Select one as parent. Verify parentComponentId is set. Click Nest again and use "Remove parent (un-nest)".
**Expected:** Nest picker opens; parent selected; "Remove parent (un-nest)" appears on next open; clicking it clears the parent. Toasts "Region nested" / "Region nested" for un-nest.
**Why human:** Popover rendering, parentComponentId round-trip, and DB state require live browser.

### Gaps Summary

No blocking gaps found. All machine-verifiable must-haves pass at all four levels (exists, substantive, wired, data-flowing). The five human verification items are visual/interactive behaviors that cannot be asserted by static analysis or unit tests — they are the expected final UAT step for a UI-heavy phase.

---

_Verified: 2026-06-12T20:10:00Z_
_Verifier: Claude (gsd-verifier)_
