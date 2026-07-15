---
phase: 60-surface-redesign-inbox-email-detail
plan: 04
subsystem: ui
tags: [region-vocabulary, provenance-mark, tier-colour-role-structure, law-1, law-3, tdd, negative-proof]

# Dependency graph
requires:
  - phase: 60-01
    provides: EntityChipEntry contract, the pmark/pmark-confirmed/pmark-suggested provenance-mark language (consumed identically here — "one mark language everywhere")
  - phase: 58-visual-identity-sketch-pick-human-gate
    provides: D-58-01 (LOCKED) — the three laws (tier=colour, chrome=sans/evidence=serif, entity-type=shape-never-hue), the tier truth table (§C)
  - phase: 59-visual-identity-designed-token-set-brand-guide
    provides: bg-conf-wash/border-conf-line/text-conf + bg-sugg-wash/border-sugg-line/text-sugg utilities, --color-ink registration (ring-ink), pmark/pmark-confirmed/pmark-suggested
provides:
  - region-vocabulary.ts's tierOf/REGION_TIER/REGION_ROLE_GEOMETRY/regionLabelFor — the single tier/role vocabulary the whole email-detail surface resolves against (Plan 05 wires six more panels onto these exports)
  - region-overlay-box.tsx re-encoded so tier ALWAYS composes with role (the pre-60-04 role-replaces-tier inversion is fixed) — the region overlays are now provenance marks consistent with the inbox chip's "one mark language everywhere"
  - region-overlay-law.test.tsx — the 20-case role x status matrix gate, proven able to fail on both possible regressions (a hue creeping onto role; role collapsing into indistinguishability)
affects: [60-05-surface-redesign-inbox-email-detail, 61-total-ui-re-skin-part-2, 62-total-ui-re-skin-part-3, 63-research-canvas-visual-surfaces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "region-vocabulary.ts as the single resolution point for tier+role classes on the detail surface -- generalizes extraction-summary-panel.tsx's statusTone precedent one level up into a shared module, so future panels become lookups instead of independent re-derivations of the same law"
    - "role geometry deliberately differentiated even where the plan's own literal per-role description text would have collided (field='border' vs none='border') -- opacity-80 added to field specifically to keep all four roles structurally distinct, since the plan's own Task 3 gate requires it"
    - "tier and role compose unconditionally (no isTerminal branch) -- REGION_TIER.terminal's own hue-free ghost treatment (opacity-40/bg-shade/border-rule/border-dashed) is sufficient; role geometry no longer needs suppressing since it was never colour to begin with"

key-files:
  created:
    - apps/web/src/app/emails/[id]/_components/region-vocabulary.ts
    - apps/web/src/app/emails/[id]/_components/__tests__/region-vocabulary.test.ts
    - apps/web/src/app/emails/[id]/_components/__tests__/region-overlay-law.test.tsx
  modified:
    - apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx

key-decisions:
  - "field's geometry is `border opacity-80`, not the plan's literal one-line `border` -- without the opacity nuance, field and none (unclassified) would both resolve to the identical string \"border\", making the two roles structurally INDISTINGUISHABLE at a fixed tier. This directly conflicts with Task 3's own explicit requirement (\"ROLE IS LEGIBLE: for a FIXED status, all four roles produce DISTINCT class strings\") and would have made the matrix gate's own positive-path assertion fail by the plan's own literal spec. Fixed forward (Rule 1 -- internal-consistency bug) rather than silently building a gate that can't pass."
  - "The tier-vs-role opacity interaction (a terminal FIELD box carries both tier.terminal's opacity-40 AND role.field's opacity-80 simultaneously) is a known, unresolved cosmetic nuance -- Tailwind's cascade order for two same-property utility classes present together is not something this plan's tests assert on (they check class STRING presence, not resolved computed style), and jsdom does not evaluate CSS. Left as-is; flagged here for Plan 05 or a future visual-QA pass to confirm the actual rendered opacity for that specific (terminal, field) combination reads correctly."
  - "region-overlay-box.tsx required an explicit `import * as React from \"react\"` (first-ever direct test mount of this component) -- vitest's classic JSX runtime throws \"React is not defined\" without it, unlike Next.js's SWC automatic runtime. Same class of fix already documented in inbox-three-pane.tsx et al. (53-03-PLAN.md Task 1); bundled into the Task 3 commit since Task 3's own test is what surfaced it."

patterns-established:
  - "regionLabelFor's discriminated { kind: 'type' | 'text' | 'status', text } result -- any future detail-surface panel needing law-2-correct labelling (Plan 05's six panels) should consume this directly rather than re-deriving entityTypeLabel ?? contentSnippet ?? status inline."

requirements-completed: [SURF-04]

# Metrics
duration: ~50min
completed: 2026-07-15
---

# Phase 60 Plan 04: Region Vocabulary — Tier Is Colour, Role Is Structure Summary

**Re-encoded the region overlays into the provenance marks they always were: a shared `region-vocabulary.ts` makes tier the ONLY source of colour (solid+conf=confirmed, dashed+sugg=suggested, hue-free=terminal) and role purely structural (border weight/style/opacity, zero colour utilities anywhere) — inverting the pre-60-04 composition rule where a classified role REPLACED the tier signal entirely — then proved the result with a 20-case role x status matrix gate that goes red on both possible regressions: a hue creeping back onto role, and role collapsing into indistinguishability (the exact Phase 59 defect this plan exists to repair).**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-07-15
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- **`region-vocabulary.ts`** (TDD, RED then GREEN, 17/17 tests): exports `tierOf(status)` mapping `extractionStatus` to `confirmed | suggested | terminal`, defaulting ANY unrecognized status to `"suggested"` — never `"confirmed"` (T-60-08: tier is a claim about a human's action, so an unknown status can never silently inherit a confirmation the user never gave). `REGION_TIER` carries the ONLY colour on the surface: confirmed is `conf`-toned + solid, suggested is `sugg`-toned + dashed, terminal is hue-free (a rejected/superseded region makes no tier claim, so it earns no colour — a ghost, not a "weakly confirmed" wash). Every tier's selection ring is `ring-ink` (law 1: selection carries no hue, identical across tiers by design). `REGION_ROLE_GEOMETRY` carries border weight/style/opacity only — zero colour utilities, zero `border-dashed` (tier already owns solid-vs-dashed). `regionLabelFor` preserves the pre-60-04 `entityTypeLabel ?? contentSnippet ?? status` precedence exactly, now returned as a discriminated `{ kind: "type" | "text" | "status", text }` so law 2 (chrome=sans, evidence=serif) can be enforced structurally.
- **`region-overlay-box.tsx`** rewritten: all five pre-60-04 class maps (`ROLE_BORDER`/`ROLE_SELECTED_RING`/`ROLE_HOVER`/`ROLE_CHIP` + the inline `statusClasses` ternary) deleted — each encoded role-as-hue or tier-as-nothing. Tier and role now ALWAYS compose (the inversion this plan fixes: the pre-60-04 `roleClass ?? statusClasses` meant a classified region lost its tier signal completely the moment it got a role). Hover/active/selected/active-parent rings are all ink now, for every role (the `isActive && role === null` guard is gone — obsolete once role no longer holds a hue). The label chip is the same mark language as the inbox chip: colour from `REGION_TIER[tier].chip` only, serif only when `regionLabelFor()` resolves to `{ kind: "text" }` (the document's own words). `data-tier` added alongside `data-role`.
- **`region-overlay-law.test.tsx`**: the 20-case (4 roles x 5 statuses) matrix gate. Asserts TIER IS COLOUR (data-tier matches `tierOf`, conf/sugg tokens and solid/dashed follow tier alone), ROLE IS NOT COLOUR (the class-string difference between any two roles at a fixed status carries no conf/sugg/graph- token), ROLE IS LEGIBLE (all four roles render distinct class strings at a fixed status — the assertion that would have caught Phase 59's three-role-hues-collapsed-to-three-near-identical-greys defect), LAW 1 ON CHROME (zero `graph-` anywhere; every ring is ink-based), and LAW 2 (serif+data-evidence ONLY on a content-text-fallback label). The empty-polygon guard (T-60-07) re-confirmed to still return null.
- **Both required negative proofs executed and RED** (verbatim below) — the gate is proven able to fail, not just proven able to pass.

## Task Commits

1. **Task 1 RED: failing vocabulary tests** — `690bb5c` (test)
2. **Task 1 GREEN: the region vocabulary** — `8324d89` (feat)
3. **Task 2: overlay box says tier in colour, role in structure** — `faa89f7` (feat)
4. **Task 3: the role x status matrix gate + negative proofs** — `64fa160` (test)

## TDD Gate Compliance

Task 1 (`tdd="true"`) followed the full RED/GREEN cycle as two separate commits, unlike 60-01's documented single-commit deviation: `690bb5c` is a pure test-only commit (module-resolution failure confirmed — `region-vocabulary.ts` did not exist yet, 0 tests collected, 1 suite failed), and `8324d89` is the pure implementation commit that turned all 17 tests green with zero test-file changes.

## THE FIRST NEGATIVE PROOF (verbatim)

Temporarily reintroduced a role hue on `REGION_ROLE_GEOMETRY.entity`:

```ts
entity: "border-2 border-conf-line",   // was: "border-2"
```

Ran `region-overlay-law.test.tsx` scoped to `-t "ROLE IS NOT COLOUR"`. RED on 4 of 5 status cases:

```
 ❯ ROLE IS NOT COLOUR — for a fixed status, no two roles' class strings differ by a colour token
   × status=candidate: the class-string DIFFERENCE between any two roles contains no conf/sugg/graph- token
     → role-only class difference "border-conf-line" (between entity and field at status=candidate)
       must not carry a tier/graph token: expected 'border-conf-line' not to match /conf|sugg|graph-/
   × status=pending   — same failure
   × status=rejected  — same failure
   × status=superseded — same failure
   ✓ status=confirmed — did NOT fail (see note below)

 Test Files  1 failed (1)
      Tests  4 failed | 1 passed | 33 skipped (38)
```

**Why status=confirmed alone did not trip:** at that one status, `REGION_TIER.confirmed.box` (`"border-conf-line bg-conf-wash"`) already contains `border-conf-line` for EVERY role (tier's own colour, not role's), so the class already exists in all four roles' sets and the injected duplicate on `entity` produces no NEW symmetric-set difference at that specific status. The other 4 of 5 statuses caught the corruption cleanly and unambiguously — satisfying the "either/or, not every case" RED bar established by 60-02/60-03's own negative-proof precedent.

Reverted via `git checkout -- apps/web/src/app/emails/[id]/_components/region-vocabulary.ts`. `git diff --stat` on that file — empty.

## THE SECOND NEGATIVE PROOF (verbatim)

Temporarily collapsed `REGION_ROLE_GEOMETRY.field` onto `entity`'s exact value:

```ts
entity: "border-2",
field: "border-2",   // was: "border opacity-80"
```

Ran `region-overlay-law.test.tsx` scoped to `-t "ROLE IS LEGIBLE"`. RED on all 5 of 5 status cases:

```
 ❯ ROLE IS LEGIBLE — for a fixed status, all four roles produce DISTINCT class strings
   × status=confirmed: entity/field/unrelated/null all render distinguishably
     → expected 3 to be 4 // Object.is equality
   × status=candidate  — same failure (3 to be 4)
   × status=pending    — same failure (3 to be 4)
   × status=rejected   — same failure (3 to be 4)
   × status=superseded — same failure (3 to be 4)

 Test Files  1 failed (1)
      Tests  5 failed | 33 skipped (38)
```

This is exactly the regression the gate exists to catch: role collapsing into indistinguishability, the mirror image of Phase 59's three role hues resolving to three near-identical greys.

Reverted via `git checkout -- apps/web/src/app/emails/[id]/_components/region-vocabulary.ts`. `git diff --stat` on that file — empty. Full `region-overlay-law.test.tsx` suite re-run clean afterward (38/38 green).

## Files Created/Modified

- `apps/web/src/app/emails/[id]/_components/region-vocabulary.ts` — **NEW.** `tierOf`, `REGION_TIER`, `REGION_ROLE_GEOMETRY`, `regionLabelFor`.
- `apps/web/src/app/emails/[id]/_components/__tests__/region-vocabulary.test.ts` — **NEW.** 17 tests, RED-then-GREEN.
- `apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx` — Full class-map rewrite onto the vocabulary; explicit React import added (deviation, see below).
- `apps/web/src/app/emails/[id]/_components/__tests__/region-overlay-law.test.tsx` — **NEW.** 38 tests: the 20-case matrix + supporting law-1/law-2/guard assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/internal-consistency] `field`'s literal geometry ("border") would have collided with `none`'s ("border")**
- **Found during:** Task 1, drafting `REGION_ROLE_GEOMETRY`
- **Issue:** The plan's own per-role description text literally specifies `field: border (1px)` and `none: border` — identical strings. Task 3's own required assertion ("ROLE IS LEGIBLE: all four roles produce DISTINCT class strings") would then be UNSATISFIABLE by the plan's own literal spec for the (field, none) pair.
- **Fix:** Added `opacity-80` to `field`'s value (`"border opacity-80"`), keeping it honestly "subordinate" (per the plan's own word for that role) while leaving `none` as the plain, unmodified `"border"` its truly-unclassified status implies. Documented inline in `region-vocabulary.ts` and confirmed by the "all four roles structurally distinct" unit test.
- **Files modified:** `apps/web/src/app/emails/[id]/_components/region-vocabulary.ts`
- **Verification:** Task 1's own `region-vocabulary.test.ts` test ("all four roles are structurally distinct") and Task 3's "ROLE IS LEGIBLE" matrix legs both pass; negative proof 2 above confirms the test correctly detects the collision if reintroduced.

**2. [Rule 3 - Blocking issue] Doc comments literally matched Task 1's own grep-based verify pattern**
- **Found during:** N/A this plan — no self-match occurred in `region-vocabulary.ts` this time (learned from 60-01/60-03's precedent, comments were phrased to avoid the literal `graph-`/`tshape` substrings from the start). Noted here only because the risk was actively designed around, not because it recurred.

**3. [Rule 3 - Blocking issue] `region-overlay-box.tsx` needed an explicit React import**
- **Found during:** Task 3 verification (first direct test mount of `RegionOverlayBox`)
- **Issue:** `region-overlay-box.tsx` compiled fine under Next.js's SWC automatic JSX runtime but threw `ReferenceError: React is not defined` under vitest's classic-runtime esbuild transform, since no prior test mounted it directly.
- **Fix:** Added `import * as React from "react";`, mirroring the exact convention already documented in `inbox-three-pane.tsx`/`entity-chips.tsx`/etc. (53-03-PLAN.md Task 1's original finding).
- **Files modified:** `apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx`
- **Commit:** `64fa160` (bundled with the Task 3 commit that surfaced it)

### Documented, Not Auto-fixed

**4. Tier/role opacity interaction on a (terminal, field) or (terminal, unrelated) box is unresolved**
- **Context:** `REGION_TIER.terminal.box` carries `opacity-40`; `REGION_ROLE_GEOMETRY.field` carries `opacity-80` and `.unrelated` carries `opacity-60`. When both compose (a terminal FIELD or terminal UNRELATED box), the rendered class list contains two `opacity-*` utilities for the same CSS property, and Tailwind's cascade order for two same-layer utilities present simultaneously determines which wins — not something this plan's tests assert on (they check class-string presence, not resolved computed style; jsdom does not evaluate CSS).
- **Resolution:** Left as-is. Flagged for Plan 05 or a future visual-QA pass to confirm the actual rendered opacity for that specific combination reads correctly on screen.

## Known Stubs

None.

## Verification

```
cd apps/web && npx tsc --noEmit                                                              -> clean
cd apps/web && npx vitest run                                                                  -> 69 files, 794 passed, 1 skipped
cd apps/web && npx vitest run src/app/emails/[id]/_components/__tests__/region-overlay-law.test.tsx  -> 38/38 passed
cd apps/web && npm run build:local                                                             -> succeeds (20/20 static pages generated)
```

## Issues Encountered

None beyond the deviations documented above (all understood and resolved before their respective verify gates passed).

## User Setup Required

None.

## Next Phase Readiness

- Plan 05 (six more detail-surface panels wired onto tier/role) can consume `region-vocabulary.ts`'s four exports directly — `tierOf`, `REGION_TIER`, `REGION_ROLE_GEOMETRY`, `regionLabelFor` — as lookups rather than re-deriving the same law per panel. Verbatim export shapes are recorded above under "provides" and in the vocabulary's own doc comments.
- The tier/role opacity-composition nuance (Deviation 4) should be visually spot-checked once Plan 05's panels give a live surface with real terminal+field/unrelated data — not blocking, but worth a look before that surface ships.
- `region-overlay-box.tsx` now requires an explicit React import for any FUTURE test that mounts it directly, alongside `overlay-layer.tsx` if a future plan tests that file directly too (it has the same automatic-vs-classic-runtime exposure, just never yet triggered by a direct test).

---
*Phase: 60-surface-redesign-inbox-email-detail*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: apps/web/src/app/emails/[id]/_components/region-vocabulary.ts
- FOUND: apps/web/src/app/emails/[id]/_components/__tests__/region-vocabulary.test.ts
- FOUND: apps/web/src/app/emails/[id]/_components/__tests__/region-overlay-law.test.tsx
- FOUND: commit 690bb5c (Task 1 RED)
- FOUND: commit 8324d89 (Task 1 GREEN)
- FOUND: commit faa89f7 (Task 2)
- FOUND: commit 64fa160 (Task 3)
