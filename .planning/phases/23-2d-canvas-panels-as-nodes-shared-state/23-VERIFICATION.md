---
phase: 23-2d-canvas-panels-as-nodes-shared-state
verified: 2026-07-05T02:15:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Panels on the same canvas read and write a shared per-chat state store, and data-carrying edges let one panel's output feed another panel's input (ROADMAP SC #5 / STATE-01 / STATE-02)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Drag a genui-panel node and the chat node around the canvas in a running browser; pan with the pointer; zoom with the scroll wheel/pinch and the Controls buttons"
    expected: "Smooth drag/pan/zoom with no visible jank; dragging never triggers a body re-render (GenuiPanelNodeBody/ChatNodeBody memoized on stable props per the code, but perceived smoothness needs a live check)"
    why_human: "Perceived responsiveness/frame-rate cannot be measured by static analysis or vitest/jsdom; this project has historically deferred real pointer/drag interaction to human verification"
  - test: "Send a message that produces a genui_spec (first-time turn) and a regenerate of an existing genui turn while the Canvas view is open, watching a live Bedrock-backed run"
    expected: "For a first-time turn, live text/partial content is visible in the ChatNode's embedded MessageList; the new genui-panel node fades in once the turn settles (no relayout of existing panels). For a regenerate, the existing panel's content updates live via the streamingByProvenance overlay without the nodes array changing identity."
    why_human: "Requires a live streaming run against the real chat backend (Bedrock) in a browser — cannot be exercised via vitest/jsdom; this project has historically deferred live-streaming visual verification to human verification"
  - test: "Drag from a genui-panel's source Handle to another panel's target Handle to open EdgeCreationPicker, and click an existing DataEdge's label pill to re-open it in edit mode"
    expected: "Popover opens anchored at the drop point / label pill; Select and Input controls behave per 23-UI-SPEC.md; 'Connect fields' only commits on confirm, 'Don't connect' and Escape create nothing. With the STATE-01 write path now wired (23-06), a real panel interaction (e.g. clicking a genui-spec button whose onClick is {type:'setState',...}) populates the store BEFORE this check, so the Source-field Select should show at least one real option in a live session — no manual store-seeding is needed anymore (this caveat from the prior verification is now closed)."
    why_human: "Real pointer drag-to-connect gesture and Popover-anchoring behavior cannot be exercised in vitest/jsdom"
  - test: "Verify apps/web/src/app/chat/_canvas/unknown-node-type-placeholder.tsx and the toggle/keyboard-hint banners visually match 23-UI-SPEC.md copy/colors exactly (font weights, muted/destructive tokens, icon choices)"
    expected: "Matches the UI-SPEC's exact copy and Tailwind token usage"
    why_human: "Visual/design-fidelity check against a spec is not reliably verifiable via static grep"
  - test: "Click a genui-spec button whose onClick is {type:'setState', key, value} in a real running app (not jsdom), then verify the EdgeCreationPicker's Source-field Select shows the new option and a committed edge live-updates the target panel"
    expected: "Identical to the now-passing unmocked jsdom test (panel-data-flow.test.tsx) — store write, non-empty field options, live edge resolution — but confirmed once in a real browser against the real chat backend to close out the jsdom-vs-browser gap"
    why_human: "The mechanism is now proven end-to-end in jsdom with zero mocks; a single live-browser confirmation is still prudent before fully trusting production behavior, per this project's convention of deferring live-interaction confirmation to human verification"
---

# Phase 23: 2D Canvas + Panels-as-Nodes + Shared State Verification Report

**Phase Goal:** Users can see and interact with a chat's genui outputs spatially — a persistent, responsive 2D infinite canvas where panels carry live-streaming content without lag, and panels share state and data across each other.
**Verified:** 2026-07-05T02:15:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (23-06)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view a chat's genui outputs as draggable/pannable panels-as-nodes on a 2D infinite canvas | ✓ VERIFIED (regression-checked) | `chat-canvas.test.ts` (7/7), `node-type-registry.test.ts` (14/14) still green; `chat-canvas.tsx`/`ChatNode`/`GenuiPanelNode` untouched by 23-06 (not in its `files_modified`); `next build` still compiles `/chat` (124kB, unchanged from prior verification). |
| 2 | Canvas layout persists per conversation and restores exactly on reload | ✓ VERIFIED (regression-checked) | `use-canvas-persistence.test.ts` (13/13) still green; `chat_canvas_layouts` schema/router untouched by 23-06. |
| 3 | New node types beyond genui-panel and chat can be added later via a versioned node-type registry without breaking existing canvases | ✓ VERIFIED (regression-checked) | `node-type-registry.test.ts` (14/14) still green; registry files untouched by 23-06. |
| 4 | Canvas stays responsive (no visible lag or full-canvas re-render) while panels stream live content | ✓ VERIFIED (re-checked directly) | `genui-panel-node.tsx` was modified by 23-06 (added `dispatch` + `usePanelActionRegistry`), so this was re-read in full: `GenuiPanelNodeBody` is still `memo`'d on the same stable props (`panelId`, `provenance`, `turnIndex`); the new `dispatch`/`actions` values are derived from `usePanelData`/`usePanelActionRegistry`, not new re-render triggers from React Flow's per-drag-tick position props. No `setNodes` call site added. |
| 5 | Panels on the same canvas read and write a shared per-chat state store, and data-carrying edges let one panel's output feed another panel's input | ✓ **VERIFIED (gap closed by 23-06)** | See "Gap Closure Verification" below — independently re-derived from the codebase, not from SUMMARY.md claims. |

**Score:** 5/5 truths verified

### Gap Closure Verification (Truth #5 / STATE-01 / STATE-02)

The prior verification (2026-07-05T01:31:35Z) found the WRITE half of the canvas store (`usePanelData().dispatch` / store `mutate`) had zero production call sites, making `EdgeCreationPicker`'s source-field list permanently empty in real use. Plan 23-06 closed this with a two-half bridge. Each claim was independently checked against the codebase (not SUMMARY.md text):

| # | Claim | Verification method | Result |
|---|-------|---------------------|--------|
| 1 | `ButtonComponent` in `manifest.ts` fires `onClick`/`action` through `ActionRegistryContext` | Read `packages/genui/src/catalog/manifest.ts` lines 251-294 directly | ✓ CONFIRMED — `React.useContext(ActionRegistryContext)`, `handleClick` calls `registry[onClick.type]?.(onClick)` (onClick takes precedence) or `registry[action]?.()`, wrapped in try/catch; wired into `Button`'s `onClick` prop. Mirrors `form-component.tsx`'s existing pattern exactly. |
| 2 | New `panel-action-bridge.ts` routes setState into the bounded 5-mutation grammar (literal `"set"` only) | Read the full file | ✓ CONFIRMED — `buildPanelActionRegistry` returns `Object.freeze({ setState })`; the handler narrows the payload, routes `shared.`-prefixed keys to `deps.mutateShared("set", key, value)`, all other keys to `deps.dispatchPanel("set", key, value)` — mutation argument is the literal string `"set"` in both branches, hardcoded, not passed through from the caller. |
| 3 | Registry threaded via additive `actions` prop through `genui-part-boundary.tsx` → `genui-panel-node.tsx` | Read both files; `grep -c "actions={actions}"` on `genui-part-boundary.tsx` | ✓ CONFIRMED — returns `3` (all 3 `SpecRenderer` call sites: finalized, streaming-full-parse, streaming-partial-tree); `genui-panel-node.tsx`'s `GenuiPanelNodeBody` destructures `dispatch` (previously discarded) and calls `usePanelActionRegistry(dispatch)`, passing the result as `actions={actions}` into `GenuiPartBoundary`. |
| 4 | Unmocked jsdom end-to-end test proves click → store write → non-empty field options → live edge resolution | Read `panel-data-flow.test.tsx` in full; ran it | ✓ CONFIRMED — one real `createCanvasStore()`, real `CanvasStoreProvider`/`usePanelData`/`usePanelActionRegistry`/`GenuiPartBoundary`/`SpecRenderer`/`ButtonComponent`, zero mocks. Test asserts, in order: baseline `panelFieldOptions(...) === []`; click "Pick B7" → `store.getState().read("panels.panel-a.choice") === "B7"`; `panelFieldOptions(...) === ["panels.panel-a.choice"]`; target panel's live-subscribed span reads `"B7"`; a second click ("Pick C2") re-resolves the SAME span to `"C2"` with no remount. **Ran independently: `1 test passed`.** |
| 5 | `spec-renderer.tsx` remains UNMODIFIED (last commit still Phase 19's ecc7a46) | `git log --oneline -1 -- packages/genui/src/renderer/spec-renderer.tsx` AND `git status --porcelain` on the same path | ✓ CONFIRMED — last touching commit is `ecc7a46` (feat(19): declarative zero-eval form node); working tree clean (empty status output). The file already supported an `actions` prop and `ActionRegistryContext.Provider` wrapping since Phase 13 — the bridge reuses that pre-existing seam without modification. |
| 6 | Two latent bug fixes in `canvas-store-context.tsx` (missing React import; useSyncExternalStore snapshot-stability via useShallow) | Read the file in full | ✓ CONFIRMED — `import * as React from "react";` present (line 26, with an explanatory comment); `usePanelData`'s selector is wrapped in `useShallow(...)` (zustand/react/shallow) and a module-level `EMPTY_PANEL_DATA` constant avoids allocating a fresh `{}` per call for the never-written case. Both are genuine, plausible fixes (an unstable `useSyncExternalStore` snapshot getter does infinite-loop, and JSX under vitest's esbuild transform without a React import does throw `ReferenceError`). |
| 7 | Gates: genui 472/472, apps/web chat 95/95, tsc clean both, next build compiles, no-eval grep clean | Ran every gate independently (not trusting SUMMARY numbers) | ✓ CONFIRMED — `packages/genui`: `24 test files, 472 tests passed`. `apps/web` `src/app/chat`: `11 test files, 95 tests passed`. `packages/genui && npx tsc --noEmit`: clean (exit 0). `apps/web && npx tsc --noEmit`: clean (exit 0). `apps/web && npx next build`: compiles, `/chat` route unchanged at 124 kB / 330 kB First Load JS. `grep -rnE "eval\(|new Function" apps/web/src/app/chat/_canvas` (excl. `__tests__`): 0 matches. |

**Independent production-call-site check** (re-running the original failing verifier probe): `grep -rn "mutate(" apps/web/src/app/chat/_canvas --include=*.ts --include=*.tsx | grep -v __tests__ | grep -v canvas-store.ts | grep -v canvas-store-context.tsx` now returns a genuine hit: `panel-action-bridge.ts:90` (`store.getState().mutate(mutation, path, value)`). Additionally, `usePanelActionRegistry` is consumed in `genui-panel-node.tsx:64` (production code, not a test file), fed by `dispatch` destructured from `usePanelData` at line 63. **The original gap's core symptom — zero production call sites for the store's write path — is closed and independently re-confirmed, not merely claimed.**

**Requirement lineage note:** all 7 claimed commits (`76bc886`, `d054b78`, `935e3ed`, `4c5165f`, `cd7b299`, `a0a50f7`, `aeecb2d`) are present in `git log --oneline --all` with the correct RED-test-before-GREEN-feat ordering for each of the 3 TDD tasks.

**Residual observation (non-blocking):** the wiring/mechanism is now proven end-to-end with a real click. Whether a Bedrock-generated genui spec commonly *emits* a button with a `{type:"setState",...}` onClick binding in ordinary conversation flow is a separate, downstream prompt-engineering concern that 23-05-SUMMARY.md already flagged as future work — it does not gate this phase's success criterion, which is about the mechanism existing and being observably wired, not about LLM authoring habits.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/schema/chat-canvas-layouts.ts` | ChatCanvasLayouts Drizzle table | ✓ VERIFIED (unchanged, not re-checked live) | Untouched by 23-06; prior verification confirmed live in Postgres |
| `packages/api-client/src/router/chat/canvas.ts` | chatCanvasProcedures | ✓ VERIFIED (unchanged) | Untouched by 23-06 |
| `apps/web/.../node-type-registry.ts` | NODE_TYPE_REGISTRY | ✓ VERIFIED (regression-checked) | 14/14 tests still pass |
| `apps/web/.../genui-panel-node.tsx` | GenuiPanelNode via unmodified SpecRenderer | ✓ VERIFIED (re-checked, modified by 23-06) | `dispatch`/`usePanelActionRegistry` added; memo split and drag-handle chrome unchanged |
| `apps/web/.../chat-canvas.tsx` + island + toggle | ChatCanvas surface | ✓ VERIFIED (unchanged) | Untouched by 23-06 |
| `apps/web/.../use-canvas-persistence.ts` | restore + debounced save | ✓ VERIFIED (regression-checked) | 13/13 tests still pass |
| `apps/web/.../canvas-store.ts` + `canvas-store-context.tsx` | Zustand store, 5-mutation grammar, usePanelData | ✓ **VERIFIED (write path now reachable)** | `canvas-store-context.tsx` modified (React import + useShallow fix); `usePanelData().dispatch` now has a real production consumer |
| `apps/web/.../panel-action-bridge.ts` | buildPanelActionRegistry + usePanelActionRegistry | ✓ VERIFIED | New file; exports exactly the two named functions + `PanelActionBridgeDeps`; 10 unit tests green; consumed in production by `genui-panel-node.tsx` |
| `packages/genui/src/catalog/manifest.ts` | ButtonComponent wired to ActionRegistryContext | ✓ VERIFIED | Read directly; `useContext(ActionRegistryContext)` present; no import from `spec-renderer.tsx` (`grep -c` = 0, avoiding the manifest↔renderer cycle) |
| `apps/web/.../edge-payload-schema.ts` + `data-edge.tsx` + `edge-creation-picker.tsx` | Data-carrying edges | ✓ **VERIFIED (now practically usable)** | `panelFieldOptions`/`sharedFieldOptions` exported (2-line additive change, confirmed via `git diff`-equivalent direct read); populated correctly once a panel writes, proven by the unmocked end-to-end test |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `manifest.ts` (ButtonComponent) | `action-registry-context.ts` | `React.useContext(ActionRegistryContext)` | ✓ WIRED | Confirmed via direct read; standalone module import (no manifest↔renderer cycle) |
| `genui-panel-node.tsx` | `panel-action-bridge.ts` | `usePanelActionRegistry(dispatch)` | ✓ WIRED | Confirmed via direct read and grep; production call site, not test-only |
| `panel-action-bridge.ts` | `canvas-store.ts` (via `canvas-store-context.tsx`) | `dispatchPanel`/`mutateShared` → `mutate("set", ...)` | ✓ WIRED | `mutate(` production call site confirmed at `panel-action-bridge.ts:90`; mutation argument is always the literal `"set"` |
| `genui-part-boundary.tsx` | `spec-renderer.tsx` (UNMODIFIED) | `actions={actions}` (existing SpecRenderer prop) | ✓ WIRED | `grep -c "actions={actions}"` = 3 (all call sites); `spec-renderer.tsx` confirmed byte-identical since Phase 19 |
| `usePanelData().dispatch` | production UI trigger | button click → ActionRegistry → bridge → dispatch | ✓ **WIRED (was NOT WIRED in prior verification)** | Full chain read end-to-end and proven by an unmocked jsdom test; this is the exact link the prior verification flagged as broken |
| `edge-creation-picker.tsx` (`panelFieldOptions`) | live store `values` | direct read, now populated after a real write | ✓ WIRED (in practice) | Prior verification flagged this as "DISCONNECTED in practice" since nothing ever wrote to the store; now genuinely populated once a panel interaction occurs, proven by test |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `GenuiPanelNodeBody` `panelData` (fed to SpecRenderer's `data`) | `usePanelData(panelId, incomingEdges)` | `canvas-store` `values.panels.{id}` | **Yes — now populated by a real click-through-registry-to-mutate chain**, proven unmocked | ✓ **FLOWING (was STATIC/EMPTY)** |
| `EdgeCreationPicker` `sourceFieldOptions` | live store `values` via `panelFieldOptions` | Same canvas-store, now genuinely written to | **Yes — proven non-empty after one interaction** | ✓ **FLOWING (was DISCONNECTED in practice)** |
| Target panel's incoming-edge overlay | `resolveCanvasPath(state.values, edge.sourcePath)` in `usePanelData`'s selector | Same store, live-subscribed via `useShallow` | Yes — proven to re-resolve across TWO successive writes (B7 → C2) with the same DOM node, no remount | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full `packages/genui` vitest suite | `cd packages/genui && npx vitest run` | 24 files, 472 tests passed | ✓ PASS |
| `packages/genui` typecheck | `cd packages/genui && npx tsc --noEmit` | clean (exit 0) | ✓ PASS |
| Full `apps/web` chat vitest suite | `cd apps/web && npx vitest run src/app/chat` | 11 files, 95 tests passed | ✓ PASS |
| `apps/web` typecheck | `cd apps/web && npx tsc --noEmit` | clean (exit 0) | ✓ PASS |
| `apps/web` production build | `cd apps/web && npx next build` | compiles; `/chat` route 124 kB / 330 kB First Load JS (unchanged) | ✓ PASS |
| no-eval grep on `_canvas` render files (excl. tests) | `grep -rnE "eval\(\|new Function" apps/web/src/app/chat/_canvas` | 0 matches | ✓ PASS |
| `spec-renderer.tsx` unmodified since Phase 23 started | `git log --oneline -1 -- packages/genui/src/renderer/spec-renderer.tsx` + `git status --porcelain` | last commit `ecc7a46` (Phase 19); working tree clean | ✓ PASS |
| `mutate(`/`usePanelActionRegistry` production call site (the original failing probe) | `grep -rn "mutate(" apps/web/src/app/chat/_canvas ... \| grep -v __tests__ \| grep -v canvas-store\*` | `panel-action-bridge.ts:90` genuine hit; `usePanelActionRegistry` consumed in `genui-panel-node.tsx:64` (production) | ✓ **PASS (was FAIL in prior verification)** |
| `panel-data-flow.test.tsx` end-to-end proof, run in isolation | `cd apps/web && npx vitest run src/app/chat/_canvas/__tests__/panel-data-flow.test.tsx` | 1 test passed (within the full-suite run above) | ✓ PASS |
| ALLOWED_MUTATIONS still empty (SEAM-02 untouched) | direct read of `packages/genui/src/schema/action-schema.ts` | `export const ALLOWED_MUTATIONS = [] as const;` | ✓ PASS |
| Locked files (`action-schema.ts`, `use-declared-state.ts`, `action-handlers.ts`) untouched | `git status --porcelain` on all three | empty (no diffs) | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared in any Phase 23 PLAN/SUMMARY and none found under `scripts/`. Skipped — not applicable to this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| CANVAS-01 | 23-03 | View toggle + draggable/pannable/zoomable canvas | ✓ SATISFIED | See Truth #1 (regression-checked) |
| CANVAS-02 | 23-01, 23-04 | Canvas layout persists per conversation | ✓ SATISFIED | See Truth #2 (regression-checked) |
| CANVAS-03 | 23-02 | Versioned node-type registry, degrade gracefully | ✓ SATISFIED | See Truth #3 (regression-checked) |
| CANVAS-04 | 23-04 | Responsive under streaming | ✓ SATISFIED | See Truth #4 (re-checked directly) |
| STATE-01 | 23-05, **23-06** | Panels read/write shared per-chat state store | ✓ **SATISFIED (was BLOCKED)** | See Gap Closure Verification above |
| STATE-02 | 23-05, **23-06** | Data-carrying edges feed one panel's output to another | ✓ **SATISFIED (was BLOCKED)** | See Gap Closure Verification above |

No orphaned requirements — REQUIREMENTS.md maps exactly CANVAS-01..04 + STATE-01/02 to Phase 23, and all 6 appear in the `requirements:` frontmatter across the 6 plans (23-01 through 23-06). REQUIREMENTS.md's existing `[x]` / "Complete" markers for STATE-01/STATE-02 are now substantively accurate (they were premature at the time of the prior verification, before this gap-closure plan ran).

### Anti-Patterns Found

None. `grep -n -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` across all files touched by 23-06 (`manifest.ts`, `panel-action-bridge.ts`, `genui-panel-node.tsx`, `genui-part-boundary.tsx`, `canvas-store-context.tsx`, `edge-creation-picker.tsx`) returns 0 matches. No debt markers, no stub returns, no hardcoded-empty props flowing to rendering.

### Human Verification Required

See frontmatter `human_verification` — 5 items: live drag/pan/zoom feel, live Bedrock-streaming visual behavior (first-turn + regenerate), live drag-to-connect/edge-edit interaction (STATE-01 blocking caveat now removed — mechanism is proven, only the pointer gesture itself needs a human check), visual/copy fidelity against 23-UI-SPEC.md, and a single live-browser confirmation of the now-proven click→store→edge chain (jsdom-vs-real-browser sanity check, lower priority since the mechanism is unmocked-test-proven).

### Gaps Summary

**No gaps remain.** All 5 ROADMAP success criteria (CANVAS-01..04, STATE-01/02) are now genuinely, substantively implemented and independently re-verified against the actual codebase (not SUMMARY.md claims):

- Truths 1-4 (CANVAS-01..04) were regression-checked: their supporting test files (`chat-canvas.test.ts`, `use-canvas-persistence.test.ts`, `node-type-registry.test.ts`) still pass, and the one file among them touched by 23-06 (`genui-panel-node.tsx`) was re-read in full to confirm the CANVAS-04 memoization contract still holds.
- Truth 5 (STATE-01/STATE-02) — previously FAILED because `usePanelData().dispatch`/store `mutate` had zero production call sites — was re-derived from first principles: `ButtonComponent`'s new `ActionRegistryContext` consumption was read directly, `panel-action-bridge.ts`'s routing logic was read directly, the additive `actions` prop's 3 call sites were grep-counted, `spec-renderer.tsx`'s git history/working-tree state was checked directly (not via SUMMARY.md's git-log claim), and the new unmocked end-to-end test (`panel-data-flow.test.tsx`) was read in full and RUN independently, passing with the exact 4-behavior chain (baseline-empty → click writes store → picker discovers field → live edge re-resolves across two writes) the prior verification's `missing:` list demanded.

Every gate the plan claimed (472/472 genui, 95/95 apps/web chat, both `tsc --noEmit` clean, `next build` compiles, no-eval grep clean, `spec-renderer.tsx` untouched) was re-run independently in this verification session and matched the SUMMARY.md's claimed numbers exactly.

**Status is `human_needed`, not `passed`,** solely because 5 human-verification items remain (live drag/pan/zoom feel, live Bedrock streaming, live drag-to-connect gesture, visual/copy fidelity, and one live-browser sanity confirmation of the now-proven write path) — none of these are new gaps; they are pre-existing categories of check this project has consistently deferred to human verification throughout Phase 23, now joined by one additional (lower-priority) item recommending a single live-browser click-through confirmation of the newly-wired mechanism.

---

*Verified: 2026-07-05T02:15:00Z*
*Verifier: Claude (gsd-verifier)*
