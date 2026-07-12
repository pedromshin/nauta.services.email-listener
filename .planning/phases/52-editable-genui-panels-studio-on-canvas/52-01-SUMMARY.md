---
phase: 52-editable-genui-panels-studio-on-canvas
plan: 01
subsystem: ui
tags: [zod, zustand, react, genui, canvas, theming, style-packs]

# Dependency graph
requires:
  - phase: 48-token-system-extensions
    provides: STYLE_PACK_IDS/DEFAULT_PACK_ID/getStylePack registry (6 packs) + ThemedRoot precedent
  - phase: 23-canvas-panels-as-nodes
    provides: canvas-store.ts (bounded 5-mutation grammar, resolveCanvasPath), use-canvas-persistence.ts (scheduleSave/sharedState), chat-canvas.tsx provider tree
provides:
  - PanelOverlaySchema/PanelVersionSchema + 6 pure helpers (resolveActivePanel, setPack, appendVersion, restoreVersion, listPriorVersions, parseOverlay) — the overlay data model every editable-panel feature reads/writes
  - PanelThemeScope — app-owned pack+bounded-token-override theming wrapper
  - usePanelOverlay(panelId) read/write hook + CanvasPersistenceProvider (scheduleSave + conversationId reachable from any panel)
  - usePanelActionLock + PanelActionId/PanelActionControlProps — shared per-panel mutual-exclusion contract for the 4 toolbar controls
affects: [52-02-parameter-editor, 52-03-regenerate-history, 52-04-nl-retheme, panel-toolbar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supersede-never-mutate version chain (entity-resolution stance, PANL-03): appendVersion/restoreVersion always APPEND a new PanelVersion, never rewrite an existing one"
    - "Overlay lives under shared.panelOverlays.{panelId} (never panels.{panelId}) — the ONLY namespace toCanvasStoreSeed rehydrates on reload"
    - "useShallow-stable raw store slice + useMemo(parseOverlay, [raw]) to keep useSyncExternalStore from looping on a freshly-parsed (shallow-unequal) object"
    - "Degrade-not-throw at every untrusted-read boundary (parseOverlay safeParses, resolveActivePanel/readBaseSpecPackId wrap JSON.parse in try/catch)"

key-files:
  created:
    - apps/web/src/app/chat/_canvas/panel-overlay.ts
    - apps/web/src/app/chat/_canvas/__tests__/panel-overlay.test.ts
    - apps/web/src/app/chat/_canvas/panel-theme-scope.tsx
    - apps/web/src/app/chat/_canvas/__tests__/panel-theme-scope.test.tsx
    - apps/web/src/app/chat/_canvas/panel-overlay-context.tsx
    - apps/web/src/app/chat/_canvas/__tests__/panel-overlay-context.test.tsx
  modified:
    - apps/web/src/app/chat/_canvas/chat-canvas.tsx

key-decisions:
  - "INITIAL_VERSION_SENTINEL exported as a plain string constant (not a 4th generatedBy enum value) — the base spec is never itself a stored PanelVersion; Plan 02/03's history UI uses the sentinel only for the oldest-row display label"
  - "isStylePackId() narrows packages/genui/schema's deliberately-widened `string` style_pack_id back to the theme module's literal StylePackId union, re-validated against the SAME STYLE_PACK_IDS source array so the two never drift"
  - "50-version / 60k-char-per-spec caps documented in a header comment as the sharedState budget bound, not runtime-enforced by the pure helpers — matches the plan's explicit 'no migration tonight' scoping"

patterns-established:
  - "Pattern: pure resolution function (resolveActivePanel) as the ONE read path every panel-rendering consumer uses — streaming always wins over an overlay, overlay pack override always wins over a version's own pack"
  - "Pattern: CanvasPersistenceProvider mirrors CanvasStoreProvider's exact context shape (throws a clear canvas-wiring error, not a silent degrade, when a panel renders outside chat-canvas.tsx's tree)"

requirements-completed: [PANL-01]

# Metrics
duration: 20min
completed: 2026-07-11
---

# Phase 52 Plan 01: Editable Panel Overlay Substrate Summary

**Zod-validated per-panel overlay data model (pack override + supersede-never-mutate version chain) with pure resolution helpers, an app-owned pack+token-override CSS-variable theming wrapper, and a read/write/persist hook wired into the canvas's existing `sharedState` — zero DB migration.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-11T21:00:00-03:00 (approx, first context read)
- **Completed:** 2026-07-11T21:17:07-03:00
- **Tasks:** 3 completed
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments
- Overlay data model (`PanelOverlaySchema`/`PanelVersionSchema`, both `.strict()`) with six pure, immutable helpers covering base-fallback resolution, pack-override precedence, streaming-forces-base, supersede-never-mutate versioning, and degrade-not-throw parsing — 23 unit tests, all green
- `PanelThemeScope` — an app-owned CSS-variable theming wrapper (pack + bounded token overrides), zero raw hex/palette classes, keeps `palette-ban.test.ts`/`token-contrast.test.ts`/`token-registration.test.ts` green
- `usePanelOverlay(panelId)` read/write hook + `CanvasPersistenceProvider` wired into `chat-canvas.tsx`'s existing provider tree — every panel can now read its overlay and every write schedules a persist through the EXISTING `chat.saveCanvasLayout` debounce, no new save path
- `usePanelActionLock` + `PanelActionId`/`PanelActionControlProps` — the shared mutual-exclusion contract Plan 02/03/04's toolbar controls will implement against

## Task Commits

Each task was committed atomically (TDD tasks show RED then GREEN commits):

1. **Task 1: Overlay data model + pure resolution/mutation helpers (TDD)**
   - `788f389` test: add failing test for panel overlay data model + pure helpers (RED)
   - `1f62196` feat: implement panel overlay data model + pure helpers (GREEN)
2. **Task 2: PanelThemeScope — pack + bounded token-override theming wrapper (TDD)**
   - `01c8159` test: add failing test for PanelThemeScope (RED)
   - `d4678f5` feat: implement PanelThemeScope pack+override theming wrapper (GREEN)
3. **Task 3: usePanelOverlay read/write hook + CanvasPersistenceProvider wiring**
   - `75ee5f2` feat: usePanelOverlay read/write hook + CanvasPersistenceProvider wiring

**Plan metadata:** (this commit) docs: complete plan

_TDD tasks (1, 2) each have a RED test(...) commit followed by a GREEN feat(...) commit, verified via a temporary implementation-file removal/restore cycle before committing (see Issues Encountered)._

## Files Created/Modified
- `apps/web/src/app/chat/_canvas/panel-overlay.ts` - `PanelOverlaySchema`/`PanelVersionSchema` + `resolveActivePanel`/`setPack`/`appendVersion`/`restoreVersion`/`listPriorVersions`/`parseOverlay`
- `apps/web/src/app/chat/_canvas/__tests__/panel-overlay.test.ts` - 23 tests covering resolution precedence, immutability, supersede-never-mutate, degrade-not-throw
- `apps/web/src/app/chat/_canvas/panel-theme-scope.tsx` - `PanelThemeScope` CSS-var theming wrapper (pack + overrides)
- `apps/web/src/app/chat/_canvas/__tests__/panel-theme-scope.test.tsx` - 4 tests covering pack resolution, override precedence, unknown-pack fallback
- `apps/web/src/app/chat/_canvas/panel-overlay-context.tsx` - `CanvasPersistenceProvider`/`useCanvasPersistenceContext`, `usePanelOverlay`, `usePanelActionLock` + shared action-control types
- `apps/web/src/app/chat/_canvas/__tests__/panel-overlay-context.test.tsx` - 4 tests covering write-then-read round-trip, scheduleSave call count, disjoint-panel isolation, wiring-error throw
- `apps/web/src/app/chat/_canvas/chat-canvas.tsx` - wraps the provider tree with `CanvasPersistenceProvider` (scheduleSave bound to `canvasStore` + `conversationId`), placed just inside `CanvasStoreProvider`; no existing save call site changed

## Decisions Made
- `INITIAL_VERSION_SENTINEL` kept as a plain exported string constant rather than widening `PanelVersionSchema.generatedBy`'s enum to 4 values — the base spec is never itself a stored version, so a 4th enum member would be a schema lie; Plan 02/03's history UI consumes the sentinel purely for display
- Added `isStylePackId()` narrowing helper: `packages/genui/schema`'s `StylePackIdSchema` is deliberately type-annotated as `z.ZodEnum<[string, ...string[]]>` (so the schema module never depends on the theme module's literal types), which meant `SpecRootSchema`'s inferred `style_pack_id` was plain `string`, not the theme module's `StylePackId` literal union needed by `resolveActivePanel`'s return type — resolved by re-validating against the SAME `STYLE_PACK_IDS` source array rather than an unsafe cast
- Documented the 50-version/60k-char-per-version budget bound in a header comment only (not runtime-enforced by the pure helpers) — matches the plan's explicit "a future dedicated versions table is deferred, no migration tonight" scoping; over-budget saves already fail gracefully via `buildSnapshot`'s existing try/catch

## Deviations from Plan

None - plan executed exactly as written. The `isStylePackId()` helper above is an implementation detail needed to satisfy the plan's own stated return type (`ResolvedPanel.packId: StylePackId`), not a scope change.

## Issues Encountered
- TDD RED verification: since the test and implementation files were authored together, RED was verified mechanically by temporarily renaming `panel-overlay.ts` to `.bak`, confirming the test suite failed on the missing import, then restoring the file and confirming GREEN — before creating the two separate `test(...)`/`feat(...)` commits. Same TDD flow used for `panel-theme-scope.tsx`.
- `panel-overlay-context.tsx`'s test initially failed with `ReferenceError: React is not defined` when mounting `<CanvasPersistenceContext.Provider>` under vitest's esbuild classic-JSX-runtime transform — a known, already-documented gotcha in `canvas-store-context.tsx` (SWC automatic runtime vs. vitest's classic runtime). Fixed by adding an explicit `import * as React from "react"` alongside the named hook imports, mirroring that file's exact precedent comment.
- A first-pass typecheck surfaced `Type 'string | undefined' is not assignable to type 'StylePackId | undefined'` in `readBaseSpecPackId` — root-caused to `packages/genui/schema`'s `StylePackIdSchema` intentionally widening its `z.infer` to `string` (see Decisions Made). Fixed via the `isStylePackId()` narrowing helper.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (Parameter Editor), Plan 03 (Regenerate/Version History), and Plan 04 (NL Re-theme) can now build directly against `resolveActivePanel`/`appendVersion`/`restoreVersion`/`listPriorVersions`, `PanelThemeScope`, and `usePanelOverlay`/`usePanelActionLock` without re-deriving any canvas-store or persistence plumbing.
- No blockers. Live-canvas visual confirmation of the toolbar + popovers (52-UI-SPEC.md's own note) is explicitly deferred to `.planning/MORNING-CHECKLIST.md` §G per 52-CONTEXT.md's environment-constrained posture (Docker/WSL down this session) — this plan shipped zero UI chrome, only the substrate, so there is nothing visual to confirm yet.

---
*Phase: 52-editable-genui-panels-studio-on-canvas*
*Completed: 2026-07-11*

## Self-Check: PASSED

All 7 files created/modified confirmed present on disk; all 5 task commit hashes
(`788f389`, `1f62196`, `01c8159`, `d4678f5`, `75ee5f2`) confirmed present in `git log`.
