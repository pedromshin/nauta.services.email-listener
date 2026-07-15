---
phase: 59-visual-identity-designed-token-set-brand-guide
plan: 01
subsystem: ui
tags: [tailwind-v4, oklch, css-custom-properties, wcag-aa, design-tokens, vitest]

# Dependency graph
requires:
  - phase: 58-visual-identity-sketch-pick-human-gate
    provides: D-58-01 (LOCKED) — the 12-token oklch ladder + shadcn semantic mapping contract
  - phase: 55-platform-migration-tailwind-v4-react-19
    provides: oklch-shaped globals.css, @theme inline / @theme blocks, the original token-contrast.test.ts / token-registration.test.ts gates
provides:
  - The D-58-01 identity ladder (12 tokens + 14 derived) live in apps/web/src/app/globals.css for both :root and .dark
  - Every existing shadcn semantic token (background/card/popover/primary/secondary/muted/accent/destructive/success/border/ring/tier-*/graph-*) resolved through the ladder via var()
  - Identity families (conf/sugg/bad/ink/faded/pencil/shelf/leaf/bright/shade/rule/hair/on-fill + washes/lines) registered in @theme inline for Tailwind utility generation
  - WCAG-AA contrast gate rewritten to resolve var() chains and gate the tier-on-wash pairs (compositeOver, resolveTokenValue)
  - Token-registration gate extended to cover the 17 identity families
affects: [60-total-ui-re-skin-part-1, 61-total-ui-re-skin-part-2, 62-total-ui-re-skin-part-3, 63-research-canvas-visual-surfaces, 59-02, 59-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "var()-chain resolution in test-time CSS parsing (resolveTokenValue) — lets gates assert on semantic tokens that are indirections onto a ladder, not literals"
    - "gamma-encoded sRGB source-over compositing for translucent-wash contrast (compositeOver) — encode/blend/decode, not linear-space blending"
    - "identity ladder as single source of truth: shadcn semantic tokens are var() references, never duplicate literals"

key-files:
  created: []
  modified:
    - apps/web/src/app/globals.css
    - apps/web/src/app/__tests__/token-contrast.test.ts
    - apps/web/src/app/__tests__/token-registration.test.ts

key-decisions:
  - "--muted-foreground maps to --faded, not --pencil (name-match trap) — --shade+--pencil computes to 4.23 light / 4.02 dark, below the 4.5 AA floor"
  - "--elevation-1/2/3 flattened to hairline-ring-only values (--hair/--rule/--rule-hi), no drop shadow, no color-mix tint, per D-58-01's 'zero shadow anywhere'"
  - "--chart-1..5 left byte-identical — not in D-58-01's ladder contract, same exemption category as packages/genui/src/theme/packs.ts"
  - "--graph-email maps to --pencil in both themes (previously had independent light/dark literals) — Law 3 demotes entity type to ink weight, not a graph-specific palette"

patterns-established:
  - "resolveTokenValue: fail-loud var()-chain resolver with cycle detection, used everywhere a gate needs a token's literal value"
  - "compositeOver: gamma-encoded sRGB alpha compositing for wash-over-ground contrast math, verified against 58-IDENTITY.md's published numbers exactly"

requirements-completed: [IDNT-03]

# Metrics
duration: ~35min
completed: 2026-07-15
---

# Phase 59 Plan 01: Identity Ladder Port + Shadcn Mapping + Gate Rewrites Summary

**Ported D-58-01's locked 12-token oklch identity ladder into globals.css for both themes, remapped every shadcn semantic token onto it (--primary/--ring now carry no hue), and rewrote both committed gates (WCAG-AA contrast + token-registration) to gate the new system with a var()-resolving parser and gamma-encoded wash compositing — both gates re-proven able to fail.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-15T17:50:46Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- The locked ladder (`--conf`/`--sugg`/`--bad`/`--ink`/`--faded`/`--pencil`/`--shelf`/`--leaf`/`--bright`/`--shade`/`--rule`/`--hair` + 14 derived tokens) is live in both `:root` and `.dark`, with the AA-corrected `--sugg` 50.5% / `--pencil` 51.0% values ported byte-for-byte from 58-IDENTITY.md.
- All ~50 components consuming `bg-background`/`text-muted-foreground`/`bg-primary`/etc. now inherit the identity with zero component-level edits — every shadcn semantic token is a `var()` reference onto the ladder.
- Law 1 (colour is earned) is structurally enforced: `--primary: var(--ink)` and `--ring: var(--ink)` — a branded action colour is no longer expressible through these tokens.
- Law 3 (entity type is shape, not hue) is structurally enforced: `--graph-entity`/`--graph-email-component`/`--graph-email` now resolve to `--ink`/`--faded`/`--pencil` instead of five arbitrary hues.
- The WCAG-AA gate now resolves `var()` chains (`resolveTokenValue`) and gates the tier-on-wash "honest worst case" via gamma-encoded sRGB compositing (`compositeOver`) — the light-theme conf/sugg wash ratios computed by the gate (4.59/4.52) match 58-IDENTITY.md's published numbers exactly.
- The registration gate now covers all 17 identity families registered in `@theme inline`.
- Both gates were re-proven able to fail (negative proof), not just proven able to pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Port the identity ladder and map every shadcn semantic token onto it** - `d82dd06` (feat)
2. **Task 2: Rewrite the WCAG-AA gate to resolve var() chains and gate the tier-on-wash pair** - `771248c` (feat)
3. **Task 3: Update the token-registration gate for the identity families** - `247b487` (feat)

## Files Created/Modified

- `apps/web/src/app/globals.css` - The 12-token identity ladder (both themes) + 14 derived tokens + the full shadcn semantic mapping (§B) + 17 identity families registered in `@theme inline` + flattened elevation
- `apps/web/src/app/__tests__/token-contrast.test.ts` - `resolveTokenValue` (var()-chain resolver), `parseOklch` extended to return alpha, `compositeOver` (gamma-encoded sRGB compositing), SEMANTIC_PAIRS/GROUND_TEXT_PAIRS/WASH_PAIRS replacing NEUTRAL_PAIRS
- `apps/web/src/app/__tests__/token-registration.test.ts` - New test asserting all 17 identity-ladder families are registered in `@theme inline`

## Decisions Made

- `--muted-foreground` maps to `--faded`, not `--pencil`, per the plan's flagged gotcha (`--shade`+`--pencil` = 4.23 light / 4.02 dark, below AA). `--pencil` remains legal on `--background`/`--card`/`--popover` — enforced by the new `GROUND_TEXT_PAIRS` gate.
- `--elevation-1/2/3` flattened to a monotonic hairline-ring scale (`--hair` -> `--rule` -> `--rule-hi`), replacing the old `color-mix`+drop-shadow values, per D-58-01's "zero shadow anywhere."
- `--graph-email` now maps to `--pencil` in both themes rather than carrying independent light/dark literals — Law 3 means entity type carries ink weight, not its own palette.
- `--chart-1..5` left byte-identical, per the plan's explicit scope note (out of D-58-01's ladder; same exemption category as `packages/genui/src/theme/packs.ts`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment text collided with `readTokenBlock`'s naive regex parser**
- **Found during:** Task 2 (first gate run after Task 1)
- **Issue:** The `--muted-foreground` mapping comment in `globals.css` read `"NOT --pencil: --shade + --pencil computes to..."` — the literal substring `--pencil:` inside the comment matched `readTokenBlock`'s `/--([\w-]+):\s*([^;]+);/g` pattern (which is comment-unaware by design, per gotcha 3/4 and the plan's explicit instruction to keep `readTokenBlock` unchanged). This caused the regex to capture everything from that false match through the *next* real semicolon (the end of the actual `--muted-foreground: var(--faded);` declaration) as a single bogus value, silently swallowing the real `--muted-foreground` entry and corrupting `tokens["pencil"]`.
- **Fix:** Reworded the comment to remove the colliding `--pencil:` colon pattern (changed to `"NOT --pencil. --shade plus --pencil computes to..."`). Ran a comprehensive scan (scratch script) across all four gate-parsed blocks (`:root`, `.dark`, `@theme inline`, `@theme`) confirming no other collisions exist.
- **Files modified:** `apps/web/src/app/globals.css` (comment text only, no token values changed)
- **Verification:** `npx vitest run src/app/__tests__/token-contrast.test.ts` went from 5 failing / 39 passing to 44/44 passing after the fix.
- **Committed in:** `d82dd06` (Task 1 commit — fixed before Task 1 was committed, so no separate commit needed)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was comment-text-only (no token values or gate logic changed) and was caught immediately by the very gate rewrite this plan required — no scope creep.

## Negative Proofs (required acceptance criterion)

### Task 2 — WCAG-AA contrast gate (`token-contrast.test.ts`)

Reverted `--sugg`'s light value to its pre-correction `54.7%` (58-IDENTITY.md: "Two of Direction A's original values failed WCAG-AA... `--sugg`: `54.7%` -> `50.5%`"), re-ran the gate:

```
✗ tier-on-wash pairs (58-IDENTITY.md's honest worst case) -- light (:root) > sugg text on sugg-wash over card clears 4.5:1
  AssertionError: expected 3.780036140915599 to be greater than or equal to 4.5
Tests  1 failed | 43 passed (44)
```

Reverted `--sugg` back to `50.5%`, re-ran:

```
✓ src/app/__tests__/token-contrast.test.ts (44 tests) 9ms
Tests  44 passed (44)
```

### Task 3 — Token-registration gate (`token-registration.test.ts`)

Deleted the `--color-conf: var(--conf);` line from `@theme inline`, re-ran:

```
✗ token family registration ... > registers the identity ladder families (D-58-01, 59-01-PLAN.md Task 1)
  Error: Expected globals.css's @theme block to register "--color-conf" -- not found. A declared
  token family with no @theme mapping line reproduces the unregistered-utility bug class this
  gate exists to catch.
Tests  1 failed | 48 passed (49)
```

Restored the line, re-ran the whole suite together:

```
✓ src/app/__tests__/token-contrast.test.ts (44 tests)
✓ src/app/__tests__/token-registration.test.ts (49 tests)
✓ src/app/__tests__/palette-ban.test.ts (2 tests)
Test Files  3 passed (3)
     Tests  95 passed (95)
```

## Wash-Pair Contrast — Port Fidelity Evidence

The gate's `console.info` output for the tier-on-wash pairs (printed during every run, not hardcoded assertions):

```
[wash] light (:root) conf-on-conf-wash-over-card = 4.59
[wash] light (:root) sugg-on-sugg-wash-over-card = 4.52
[wash] dark (.dark) conf-on-conf-wash-over-card = 6.72
[wash] dark (.dark) sugg-on-sugg-wash-over-card = 6.59
```

Matches 58-IDENTITY.md's published "Measured contrast" section exactly: *"conf **4.59 | 6.72**, sugg **4.52 | 6.59**"* — confirming the gamma-encoded `compositeOver` compositing model reproduces the contract's numbers precisely, not approximately.

## Issues Encountered

- `npm run build` initially failed with `Missing/invalid auth environment variables` while collecting page data for `/api/knowledge/edges/[edgeId]/promote` — a pre-existing environment gap (`apps/web` has no `.env.local`; only the monorepo root does) unrelated to this plan's CSS/token changes. Confirmed unrelated by temporarily copying the root `.env.local` into `apps/web/` (gitignored at every level, removed immediately after verification): the build then completed cleanly (exit 0, all 20 routes generated). No code change was needed or made; this is an environment-setup gap outside this plan's scope, not a defect introduced here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The identity ladder + shadcn mapping is the foundation Phases 60-62 (per-surface redesign) and 63 (research-canvas visual surfaces) will consume via existing Tailwind utility classes (`bg-background`, `text-muted-foreground`, `bg-primary`, etc.) plus the newly registered `bg-conf`/`text-sugg-wash`/`border-hair`/etc. identity utilities.
- 59-02 (type scale, spacing/density, signature-element utilities) and 59-03 (brand guide's visual-identity section, `--chart-1..5` exemption flag for user decision) build directly on this plan's ladder and mapping — no blockers.
- `.claude/skills/polytoken-design-system/SKILL.md` still documents the pre-59 token source per 59-CONTEXT.md's code-context note — flagged for 59-03 to update, not addressed in this plan (out of Task 1-3 scope).

---
*Phase: 59-visual-identity-designed-token-set-brand-guide*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: apps/web/src/app/globals.css
- FOUND: apps/web/src/app/__tests__/token-contrast.test.ts
- FOUND: apps/web/src/app/__tests__/token-registration.test.ts
- FOUND: commit d82dd06 (Task 1)
- FOUND: commit 771248c (Task 2)
- FOUND: commit 247b487 (Task 3)
