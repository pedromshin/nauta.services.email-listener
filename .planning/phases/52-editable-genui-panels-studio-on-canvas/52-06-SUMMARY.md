---
phase: 52-editable-genui-panels-studio-on-canvas
plan: 06
subsystem: ui
tags: [react, trpc, genui, canvas, theming, style-packs, tdd]

# Dependency graph
requires:
  - phase: 52-05
    provides: "genui.resolveRetheme tRPC procedure (a `.query()` boundary) resolving a NL instruction to `{ stylePackId, tokenOverrides }`, gated by the authoritative RethemeResolutionSchema web-boundary belt"
  - phase: 52-02
    provides: "PanelActionsToolbar/PanelActionControlProps contract, RethemeControl interface-first skeleton, usePanelOverlay/appendVersion wiring, PanelThemeScope"
  - phase: 52-01
    provides: "panel-overlay.ts (appendVersion/resolveActivePanel, supersede-never-mutate version chain), PanelThemeScope's tokenOverrides application"
provides:
  - "apps/web/.../controls/retheme-control.tsx — NL Re-theme Popover (52-UI-SPEC Component 5), replacing Plan 52-02's inert skeleton; PANL-04 client delivered end-to-end"
  - "apps/web/.../__tests__/retheme-apply-integration.test.tsx — proves resolveActivePanel -> PanelThemeScope applies a stored retheme version's pack + tokenOverrides to a real rendered panel"
  - "PANL-04 marked Complete (client + server, Plans 52-05+52-06 together close it)"
  - "Consolidated Phase-52 live-canvas UAT entry in MORNING-CHECKLIST.md SS G (all five PANL actions + screenshot-diff)"
affects: [panel-toolbar, phase-52-uat-burndown]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-06 manual-trigger idiom reused a third time for a .query() procedure: api.genui.resolveRetheme.useQuery({instruction, currentStylePackId}, {enabled:false}) + refetch() on Apply click — same shape as generate.ts's regenerate-control.tsx precedent, since resolveRetheme is also a .query() (not .mutation())"
    - "Client-side maxLength defense-in-depth: the Textarea's HTML maxLength attribute only constrains real keystroke/paste input, not a programmatic value assignment — handleInstructionChange additionally slices to 280 chars so the client-held state never exceeds the tRPC input schema's own z.string().max(280) bound regardless of how the value was set"

key-files:
  created:
    - apps/web/src/app/chat/_canvas/__tests__/retheme-control.test.tsx
    - apps/web/src/app/chat/_canvas/__tests__/retheme-apply-integration.test.tsx
  modified:
    - apps/web/src/app/chat/_canvas/controls/retheme-control.tsx
    - apps/web/src/app/chat/_canvas/__tests__/genui-panel-node-toolbar.test.tsx
    - .planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md

key-decisions:
  - "MORNING-CHECKLIST.md's real path is .planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md, not the plan frontmatter's literal .planning/MORNING-CHECKLIST.md — confirmed by filesystem search and by every prior 52-0x SUMMARY's own reference to that same path; edited the real file (SS G) and ran the plan's verify grep against it (Rule 3 auto-fix, missing-file-at-stated-path)"
  - "appendVersion's specJson carries activeSpecJson VERBATIM (the panel's current active content, unchanged) — re-theme changes stylePackId/tokenOverrides only, per PANL-04's own content-preservation contract"
  - "tokenOverrides passed straight through from the resolveRetheme result (already validated by 52-05's two-belt gate: Python key-allow-list + tRPC's authoritative RethemeResolutionSchema/.strict() TokenOverridesSchema) — PanelThemeScope trusts its already-validated input, exactly as its own file-header contract states"
  - "Integration test isolates the READ side only (resolveActivePanel -> PanelThemeScope) rather than driving the RethemeControl UI end-to-end through a real popover interaction — the WRITE side (Apply -> appendVersion) is already covered by retheme-control.test.tsx; seeding the overlay directly keeps this test focused on the theme-application proof the plan actually asks for"

patterns-established: []

requirements-completed: [PANL-04]

# Metrics
duration: ~29min
completed: 2026-07-12
---

# Phase 52 Plan 06: NL Re-theme Client + Theme-Application Integration Proof Summary

**RethemeControl (52-UI-SPEC Component 5) applies genui.resolveRetheme's output as a `retheme` overlay version via appendVersion, one-shot with no-partial-apply on failure, plus a dedicated test proving the resolved pack/overrides actually re-theme a rendered panel through PanelThemeScope.**

## Performance

- **Duration:** ~29 min
- **Started:** ~2026-07-12T02:30:00Z (approx, first context read)
- **Completed:** 2026-07-12T02:59:03Z
- **Tasks:** 2 completed
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `RethemeControl` replaces Plan 52-02's inert skeleton with the full 52-UI-SPEC Component 5 popover: heading "Describe a new look", `Textarea` (rows=3, maxLength=280) + right-aligned `{n}/280` counter, "Apply look"/"Discard" CTAs, inline error banner using the `border-destructive/30 bg-destructive/5` token recipe.
- Apply calls `api.genui.resolveRetheme.useQuery({instruction, currentStylePackId: resolvedPackId}, {enabled:false})` + manual `refetch()` (the same D-06 idiom `regenerate-control.tsx` established for `genui.generate` — both are `.query()` procedures, not mutations). On `{ok:true}` it appends a `retheme` version via `appendVersion` carrying the resolved `stylePackId` + `tokenOverrides` and the panel's UNCHANGED `activeSpecJson`, closes the popover, and fires `toast.success("Panel re-themed")`.
- On `{ok:false}` or a transport failure, the inline banner renders with the exact copy "Couldn't apply that look — try describing it differently.", `writeOverlay` is never called, and the typed instruction stays in the (still-open) Textarea — no partial or silent apply, matching the threat register's T-52-06-03 mitigation.
- PANL-04 is now closed end-to-end: Plan 52-05's server-side resolution (validated by a two-belt gate) feeds Plan 52-06's client popover, which writes through Plan 52-01's supersede-never-mutate overlay model into Plan 52-01/52-02's `PanelThemeScope` render path.
- `retheme-apply-integration.test.tsx` proves the theme-application boundary directly: a canvas store seeded with a `retheme` VERSION (pack `playful-rounded` + a `primary` token override) mounts the real `GenuiPanelNode`, and the rendered wrapper's inline `--primary` CSS var equals the OVERRIDE value, not `playful-rounded`'s own base `262 83% 58%` — `resolveActivePanel -> PanelThemeScope` is confirmed load-bearing, not just plumbing.
- Phase-52's five "queued to SS G" per-plan notes (52-02 through 52-05) are consolidated into ONE runsheet entry in `MORNING-CHECKLIST.md` SS G, naming all five PANL actions plus the screenshot-diff step against the Phase-51 baseline, and explicitly confirming zero Phase-52 Playwright specs were authored this session (unit/component vitest coverage only).

## Task Commits

Each task was committed atomically:

1. **Task 1: NL Re-theme Popover (retheme-control.tsx)** — `1925425` feat
2. **Task 2: Retheme->theme integration proof + queue live-canvas UAT to MORNING SS G** — `d85487e` test

**Plan metadata:** (this commit) docs: complete plan

## Files Created/Modified

- `apps/web/src/app/chat/_canvas/controls/retheme-control.tsx` — `RethemeControl`: full PANL-04 implementation (replaces Plan 52-02's inert skeleton)
- `apps/web/src/app/chat/_canvas/__tests__/retheme-control.test.tsx` — 4 tests: char-cap + counter, successful apply (writeOverlay + toast), failed apply (banner + preserved instruction, no writeOverlay), isLocked disables the trigger
- `apps/web/src/app/chat/_canvas/__tests__/retheme-apply-integration.test.tsx` — 1 test: a seeded retheme version's pack + tokenOverrides re-theme a real-mounted `GenuiPanelNode`
- `apps/web/src/app/chat/_canvas/__tests__/genui-panel-node-toolbar.test.tsx` — extended `~/trpc/react` mock with `genui.resolveRetheme.useQuery` stub (RethemeControl now mounts for real inside the toolbar this suite renders)
- `.planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md` — appended SS G item 5: consolidated Phase-52 live-canvas confirmation runsheet entry

## Decisions Made

See `key-decisions` in frontmatter above (MORNING-CHECKLIST.md's real path vs. the plan's stated path, unchanged-specJson content preservation, trusting the already-validated resolveRetheme output, and scoping the integration test to the READ/theming side only).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `.planning/MORNING-CHECKLIST.md` does not exist at that literal path**
- **Found during:** Task 2
- **Issue:** The plan's own frontmatter `files_modified` lists `.planning/MORNING-CHECKLIST.md`, and its own verify command greps that exact path — but no such file exists at the repo root. The real, actively-maintained checklist (with the existing SS G structure referenced by Plans 52-02/52-03/52-04/52-05's own SUMMARYs) lives at `.planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md`.
- **Fix:** Edited the real file's existing SS G section (appended item 5, did not rewrite anything), and ran the plan's `grep -n "Phase-52"` verify command against that actual path instead of the nonexistent one.
- **Files modified:** `.planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md`
- **Verification:** `grep -n "Phase-52" .planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md` returns the new entry.
- **Committed in:** `d85487e` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Client-side instruction length cap independent of the Textarea's HTML `maxLength`**
- **Found during:** Task 1
- **Issue:** `maxLength` on a `<textarea>` only constrains real keystroke/IME/paste input in a browser; it does not clamp a value assigned programmatically (e.g. controlled-component state set from a source other than a native input event). Relying on it alone leaves a theoretical gap between the client's held `instruction` state and the tRPC input schema's own authoritative `z.string().min(1).max(280)` bound.
- **Fix:** `handleInstructionChange` explicitly slices the incoming value to 280 characters before committing it to state, so the app-level bound holds regardless of how the value arrived — defense-in-depth alongside (not instead of) the `maxLength` attribute.
- **Files modified:** `apps/web/src/app/chat/_canvas/controls/retheme-control.tsx`
- **Verification:** `retheme-control.test.tsx`'s Test 1 sets a 300-char value and asserts the Textarea's committed value is exactly 280 chars with the counter reading `280/280`.
- **Committed in:** `1925425` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking, 1 Rule 2 missing-critical)
**Impact on plan:** Both were necessary — the first for the plan's own MORNING-CHECKLIST verify step to succeed against a real file, the second for a genuine (if narrow) input-hygiene gap. No scope creep; no files outside the plan's stated intent were touched (the MORNING-CHECKLIST edit is the plan's own Task 2 deliverable, just at its real path).

## Issues Encountered

None beyond the deviations above. One self-correction during test authoring: an initial `retheme-apply-integration.test.tsx` assertion asserted the WHOLE inline `style` string excluded `playful-rounded`'s base `--primary` value (`262 83% 58%`) — this failed because the pack's OTHER vars (`--ring`, `--shadow-base`) legitimately still carry that same literal string (the pack's own design uses primary consistently across those vars). Fixed by isolating and asserting only the `--primary:` declaration specifically, which is the actually-correct proof of what PANL-04's override targets.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **PANL-04 is complete end-to-end** (server: Plan 52-05, client: this plan). All four Phase-52 requirements (PANL-01..04) are now delivered at the code/unit-test level.
- **Phase 52 is now 6/6 plans complete** (52-01 through 52-06 all have a SUMMARY.md).
- **Live-canvas confirmation for the WHOLE phase remains DEFERRED** to `MORNING-CHECKLIST.md` SS G's new consolidated item 5 (Docker/FastAPI/Bedrock were not concurrently available this session) — this is an honest queue, not a faked pass. No Playwright E2E specs exist for Phase 52 yet; the live-canvas pass will be the first real-browser exercise of PANL-01..04.
- No blockers for closing Phase 52 at the planning/tracking level; the only remaining work is the user-gated live verification already queued.

## Self-Check: PASSED

- FOUND: `apps/web/src/app/chat/_canvas/controls/retheme-control.tsx`
- FOUND: `apps/web/src/app/chat/_canvas/__tests__/retheme-control.test.tsx`
- FOUND: `apps/web/src/app/chat/_canvas/__tests__/retheme-apply-integration.test.tsx`
- FOUND: `apps/web/src/app/chat/_canvas/__tests__/genui-panel-node-toolbar.test.tsx`
- FOUND: `.planning/phases/49-live-loop-gate-deploy-oauth-real-email/MORNING-CHECKLIST.md`
- FOUND: commit `1925425`
- FOUND: commit `d85487e`

---
*Phase: 52-editable-genui-panels-studio-on-canvas*
*Completed: 2026-07-12*
