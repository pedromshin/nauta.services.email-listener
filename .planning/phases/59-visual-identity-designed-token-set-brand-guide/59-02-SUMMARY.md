---
phase: 59-visual-identity-designed-token-set-brand-guide
plan: 02
subsystem: ui
tags: [tailwind-v4, oklch, design-tokens, type-scale, next-font, vitest, css-custom-properties]

# Dependency graph
requires:
  - phase: 59-01
    provides: The D-58-01 identity ladder (12 tokens + 14 derived) live in globals.css for both :root and .dark, shadcn semantic mapping, token-contrast.test.ts's readTokenBlock/parseOklch/resolveTokenValue
  - phase: 58-visual-identity-sketch-pick-human-gate
    provides: D-58-01 (LOCKED) -- the three laws, the provenance-mark signature spec, direction-final.html as the measured reference
provides:
  - A 6-step designed --text-* scale (2xs/xs/sm/base/lg/xl, each with a paired --line-height) registered in the native @theme block, anchored on the sketch's own 14px/1.55 body -- replaces stock Tailwind text sizing
  - --font-serif (law 2's real token role) + --font-sans as the self-hosted Archivo-first stack (next/font/google, layout.tsx)
  - A tabular @utility for law 2's "tabular numerals everywhere"
  - 9 named --spacing-* density steps (control/control-sm/chip/row/panel x/y pairs) + --radius-card/--radius-frame
  - The provenance mark as reusable @utility declarations: pmark, pmark-confirmed, pmark-suggested (THE signature element, D-58-01)
  - The entity-type shape vocabulary as @utility declarations: tshape + tshape-supplier/person/amount/document/email (law 3)
  - colour-law.test.ts -- law 1's structural-enforcement gate (chrome ceiling, earned-hue floor, cross-theme hue+chroma invariance), proven able to fail twice
  - token-registration.test.ts extended to gate the type scale + serif + density + card/frame radii registration
affects: [60-total-ui-re-skin-part-1, 61-total-ui-re-skin-part-2, 62-total-ui-re-skin-part-3, 63-research-canvas-visual-surfaces, 59-03]

# Tech tracking
tech-stack:
  added:
    - "next/font/google (Archivo, 400/600) -- already inside the installed next package, no new dependency"
  patterns:
    - "dynamic colour-token discovery in colour-law.test.ts: resolve+parse every :root/.dark key as oklch, skip on parse failure -- gates any future colour token automatically, no hardcoded allowlist to maintain"
    - "@utility <name> { ... } for reusable design-system primitives (pmark/tshape/tabular) -- top-level, not @layer-wrapped, matching the file's existing container/animate-in convention"
    - "Archivo-first font stack with a literal fallback name plus a var(--font-archivo) self-hosted override -- correct build output whether or not the webfont fetch succeeds"

key-files:
  created:
    - apps/web/src/app/__tests__/colour-law.test.ts
  modified:
    - apps/web/src/app/globals.css
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/__tests__/token-registration.test.ts

key-decisions:
  - "Type scale clustered to 6 steps (2xs/xs/sm/base/lg/xl) from the sketch's 13 raw values, reusing Tailwind's own xs/sm/base/lg/xl names so this REPLACES stock sizing everywhere those classes are already used, per the plan's explicit instruction ('that is the point of criterion 2')"
  - "--text-lg anchored on .rp-body (15.5px/1.7) -- the serif reading-pane body, law 2's most significant 'evidence' text -- rather than the cluster's other member (.empty h5, 14.5px/600, a heading role)"
  - "Density steps registered as x/y pairs (control-x/control-y etc.) rather than shorthand values, since Tailwind spacing utilities are single-axis (p-*, gap-x-*, gap-y-*) -- a two-value CSS shorthand token would not be directly consumable as a utility"
  - "--radius-card/--radius-frame computed as calc(var(--radius) + Npx) rather than literal px, matching the file's own existing --radius-xl/--radius-2xl convention (both already do this from inside the same @theme block)"
  - "colour-law.test.ts's earned-hue FLOOR (>=0.06) does NOT include chart-1..5, even though interfaces §D lists chart-1..5 as part of the CEILING-exempt set -- verified during Task 3 that several chart chroma values (light chart-1=0.053, dark chart-3=0.057, chart-4=0.044) sit below 0.06, so applying the floor to them would make an always-red gate; chart-1..5 gets its own 'documented exemption' describe block instead (parses + logs chroma, asserts nothing)"
  - "layout.tsx is NOT listed in this plan's frontmatter files_modified, but IS explicitly named in Task 1's own <files> tag and is required by interfaces §B's decision rule (next/font/google must be invoked in a Server Component) -- treated as the task's own authority, documented here rather than skipped"

patterns-established:
  - "colourTokenNames()/tryParseColourToken() dynamic filter in colour-law.test.ts -- reusable pattern for any future gate that needs 'every colour token' without hand-maintaining a name list"

requirements-completed: [IDNT-03]

# Metrics
duration: ~30min
completed: 2026-07-15
---

# Phase 59 Plan 02: Type Scale + Density + Provenance Mark + Law-1 Gate Summary

**Built the rest of D-58-01's design system on top of 59-01's colour ladder: a 6-step type scale anchored on the sketch's own 14px body (replacing stock Tailwind sizing), the serif as a real token role, a 9-step density rhythm, the provenance mark and entity-type-shape utilities as reusable `@utility` primitives, and a new `colour-law.test.ts` gate that structurally enforces law 1 (chrome ceiling, earned-hue floor, cross-theme hue+chroma invariance) -- proven able to fail twice, not just proven able to pass.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-15T18:18:47Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- A `<=7`-step designed `--text-*` scale (2xs/xs/sm/base/lg/xl, each with a paired `--line-height`) is registered in the native `@theme` block, clustered from `direction-final.html`'s 13 measured font-size values and anchored on the sketch's own `14px/1.55` body -- not Tailwind's stock 16px base. Because the names reuse Tailwind's own `xs/sm/base/lg/xl` scale, this REPLACES stock sizing app-wide wherever those classes are already used, per the plan's explicit instruction.
- `--font-serif` (system stack, no webfont) is law 2's real token role -- "chrome speaks sans, evidence speaks serif" now has a name a surface can call (`font-serif`), documented with the rule that it applies only to the user's own material.
- `--font-sans` is the Archivo-first stack; Archivo (400/600 only) is self-hosted via `next/font/google` in `layout.tsx`, exposed as `--font-archivo` and consumed with a literal `"Archivo"` fallback that holds even if the import is ever dropped. **The webfont fetch succeeded** -- no fallback branch was needed (see "Archivo Outcome" below).
- A `tabular` `@utility` gives law 2's "tabular numerals everywhere" a name.
- 9 named `--spacing-*` density steps (control/control-sm/chip/row x/y pairs + panel) plus `--radius-card`/`--radius-frame` give Phases 60-63 a measured rhythm instead of ad-hoc px.
- THE signature element -- the provenance mark -- exists as `pmark`/`pmark-confirmed`/`pmark-suggested` `@utility` declarations, var()-referenced onto the 59-01 ladder. Solid border = confirmed, dashed border = suggested.
- The entity-type shape vocabulary (law 3) exists as `tshape` + 5 type variants, all hue-free (verified structurally, not just by eye).
- `colour-law.test.ts` is a new committed gate enforcing law 1 structurally: chrome ceiling (<=0.03), earned-hue floor (>=0.06), and cross-theme hue+chroma invariance for conf/sugg/bad. It dynamically discovers every colour token in `:root`/`.dark` (resolve + parse as oklch, skip on failure) rather than hand-maintaining a token-name list -- a future colour token addition is automatically gated.
- Both required negative proofs were run and reverted; the gate was confirmed able to fail on the EXACT regressions it exists to catch (see below).

## Task Commits

Each task was committed atomically:

1. **Task 1: Type scale + serif role + density scale** - `92489ef` (feat)
2. **Task 2: The provenance mark + entity-type shape utilities** - `f060115` (feat)
3. **Task 3: The law-1 gate (colour-law.test.ts) + token-registration extension** - `dd8b6e5` (feat)

## Files Created/Modified

- `apps/web/src/app/globals.css` - `--text-*` scale (6 steps + line-heights), `--font-serif`, `--font-sans` (Archivo-first), `tabular` utility, 9 `--spacing-*` steps, `--radius-card`/`--radius-frame`, `pmark`/`pmark-confirmed`/`pmark-suggested` utilities, `tshape` + 5 type-shape utilities
- `apps/web/src/app/layout.tsx` - `next/font/google` Archivo import (400/600, `variable: "--font-archivo"`), applied via `className={archivo.variable}` on `<html>`
- `apps/web/src/app/__tests__/colour-law.test.ts` - **NEW.** Law-1 structural-enforcement gate: chrome ceiling, earned-hue floor, cross-theme invariance, documented chart-1..5 exemption
- `apps/web/src/app/__tests__/token-registration.test.ts` - 2 new tests asserting the type scale/serif/density/card-frame-radii families are registered in the native `@theme` block

## The Derived Type Scale

Measured from `direction-final.html`'s 13 distinct font-size declarations (interfaces §A), clustered into 6 designed steps:

| Step | Size | Line-height | Sketch source values (cluster) | Primary sketch usage |
|------|------|-------------|--------------------------------|----------------------|
| `2xs` | 11px | 1.3 | 10.5, 11 | Micro labels: `.ct` chip type, `.cap` caption, `.paneh`, `.ent .et`, `.urlline` |
| `xs` | 12px | 1.4 | 11.5, 12 | Chip/badge text, `.chip .cv`, `.btn.sm` |
| `sm` | 13px | 1.45 | 12.5, 13 | Secondary/meta text: `.topbar .dir`, `.fitem`, `.sender`, `.swlabel` |
| `base` | 14px | 1.55 | 13.5, 14 | **Exact match** to the sketch's own `body{font:400 14px/1.55}` -- primary UI text |
| `lg` | 15.5px | 1.7 | 14.5, 15, 15.5 | Anchored on `.rp-body` (15.5px/1.7) -- the serif reading-pane body, law 2's evidence text |
| `xl` | 18.5px | 1.3 | 18, 19 | Headings: `.rp-head h2` (19/1.3), `.lawlede` (19/1.3), `.kd-head h3` (18) |

Excluded from clustering (per interfaces §A's own 13-value list, which already omits them): 9.5px (a decorative `" AA"` annotation on the sketch's own audit table) and 10px (`.nitem` nav-rail micro-label) -- both single-occurrence outliers, not part of the designed scale.

## Density / Spacing Steps

| Token | Value | Source |
|-------|-------|--------|
| `--spacing-control-y` / `--spacing-control-x` | 7px / 14px | `.btn` padding |
| `--spacing-control-sm-y` / `--spacing-control-sm-x` | 6px / 11px | `.btn.sm` padding |
| `--spacing-chip-y` / `--spacing-chip-x` | 4px / 7px | `.chip` padding |
| `--spacing-row-y` / `--spacing-row-x` | 12px / 16px | `.row` padding |
| `--spacing-panel` | 20px | `.entities`/`.kdetail` panel padding (sketch range 18-22px, midpoint) |
| `--radius-card` | `calc(var(--radius) + 2px)` = 10px | `--r-card` |
| `--radius-frame` | `calc(var(--radius) + 4px)` = 12px | `--r-frame` |

## Archivo Outcome

**The webfont landed -- no fallback was needed.** `next/font/google` fetched Archivo (400/600) successfully during `npm run build`; the webpack compile step ("Compiled successfully") completed cleanly with the font import in place, and the full production build exited 0 with all 20 routes generated. `--font-sans` is `var(--font-archivo), "Archivo", -apple-system, ...` -- the self-hosted variable resolves first at runtime, with the literal `"Archivo"` name (and the rest of the system stack) as the documented fallback chain that would still be correct if the import were ever removed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CSS block-comment premature termination via a literal `*/` inside comment prose**
- **Found during:** Task 1's first build verification
- **Issue:** A newly-authored comment describing the spacing system read `"...p-*/gap-*/m-* utility..."` -- the literal substring `*/` inside that prose closed the enclosing CSS block comment early, leaving the remaining comment text (and the `══...══ */` closer two lines later) parsed as raw CSS, which webpack's css-loader rejected as an "Unknown word" syntax error.
- **Fix:** Reworded the comment to `"p-, gap-, m- utility"`, removing the `*/`-forming character sequence. Then scanned the rest of my newly-added prose for the same `[^/]\*/[^ ]` pattern with a targeted grep and confirmed no other occurrences.
- **Files modified:** `apps/web/src/app/globals.css` (comment text only, no token values changed)
- **Verification:** `npm run build`'s webpack CSS compile step went from a hard syntax error to "Compiled successfully" after the fix.
- **Committed in:** `92489ef` (Task 1 commit -- fixed before Task 1 was committed, so no separate commit needed)

**2. [Plan inconsistency, not a scope violation] `layout.tsx` is not in the plan's top-level `files_modified` frontmatter**
- **Found during:** Task 1, pre-edit review of the plan's frontmatter vs. Task 1's own `<files>` tag
- **Issue:** The plan frontmatter's `files_modified` lists only `globals.css`, `colour-law.test.ts`, `token-registration.test.ts` -- omitting `layout.tsx`. Task 1's own `<files>` tag, and interfaces §B's decision rule (which requires invoking `next/font/google` inside a Server Component -- `layout.tsx` is the only root-level candidate), both explicitly name it.
- **Resolution:** Treated Task 1's own `<files>` declaration as authoritative (it is the more specific, task-scoped instruction) and edited `layout.tsx` as required to self-host Archivo. Documented here rather than silently working around it, and rather than skipping the Archivo self-hosting the plan explicitly asked for.
- **Files modified:** `apps/web/src/app/layout.tsx`
- **Committed in:** `92489ef` (Task 1)

---

**Total deviations:** 1 auto-fixed bug (comment-termination CSS syntax error), 1 documented plan-frontmatter inconsistency (resolved in favor of the task's own explicit instruction).
**Impact on plan:** Both were caught and resolved before their respective task commits; no scope creep beyond what Task 1 itself required.

## Negative Proofs (required acceptance criteria)

### NEGATIVE PROOF #1 (law 1 -- chrome ceiling)

Temporarily reverted `:root`'s `--primary` from `var(--ink)` to its pre-59 stock teal literal `oklch(38.9% 0.053 173.7)`, re-ran `colour-law.test.ts`:

```
 ❯ src/app/__tests__/colour-law.test.ts (187 tests | 2 failed | 177 skipped)
   × colour-law (D-58-01 law 1 structural-enforcement gate) > chrome ceiling -- light (:root) > --primary (chroma 0.053) stays at or below the 0.03 chrome ceiling -- law 1: colour is earned, never decorative
     → expected 0.053 to be less than or equal to 0.03
   × colour-law (D-58-01 law 1 structural-enforcement gate) > chrome ceiling -- light (:root) > --sidebar-primary (chroma 0.053) stays at or below the 0.03 chrome ceiling -- law 1: colour is earned, never decorative
     → expected 0.053 to be less than or equal to 0.03

 Test Files  1 failed (1)
      Tests  2 failed | 8 passed | 177 skipped (187)
```

The gate caught the regression on `--primary` by name (the exact scenario it exists to prevent), and -- as a bonus -- also caught `--sidebar-primary` (a `var()`-chain alias onto `--primary`), demonstrating the dynamic colour-token discovery correctly follows aliases rather than needing them hand-listed.

Reverted `--primary` back to `var(--ink)`, re-ran the full suite:

```
 ✓ src/app/__tests__/colour-law.test.ts (187 tests)
 Test Files  1 passed (1)
      Tests  187 passed (187)
```

### NEGATIVE PROOF #2 (cross-theme hue+chroma invariance)

Temporarily changed `.dark`'s `--conf` chroma from `0.068` to `0.07` (leaving `--conf-wash`/`--conf-line` untouched, isolating the drift to `--conf` alone), re-ran the invariance test:

```
 ❯ src/app/__tests__/colour-law.test.ts (187 tests | 1 failed | 184 skipped)
   × colour-law (D-58-01 law 1 structural-enforcement gate) > cross-theme hue+chroma invariance (D-58-01: only lightness moves) > --conf holds hue and chroma identical between :root and .dark
     → expected 0.07 to be 0.068 // Object.is equality

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed | 184 skipped (187)
```

Reverted `--conf` back to `0.068`, re-ran the whole suite together:

```
 ✓ src/app/__tests__/token-contrast.test.ts (44 tests)
 ✓ src/app/__tests__/token-registration.test.ts (51 tests)
 ✓ src/app/__tests__/colour-law.test.ts (187 tests)
 ✓ src/app/__tests__/palette-ban.test.ts (2 tests)

 Test Files  4 passed (4)
      Tests  284 passed (284)
```

`git diff --stat apps/web/src/app/globals.css` against the Task 3 commit confirmed empty after both reverts -- no negative-proof edit leaked into the committed state.

## Issues Encountered

- Same pre-existing environment gap 59-01-SUMMARY.md documented: `apps/web` has no `.env.local` (only the monorepo root does), so a bare `npm run build` fails at "Collecting page data" with `Missing/invalid auth environment variables`. Confirmed unrelated to this plan's changes by temporarily copying the root `.env.local` into `apps/web/` (gitignored at every level, removed immediately after each verification, `.next` cache cleared between runs to avoid a stale-cache `MODULE_NOT_FOUND` artifact from the prior failed build): the build then completed cleanly (exit 0, all 20 routes generated) both after Task 1+2 and again after Task 3. No code change was needed or made for this gap.

## User Setup Required

None -- Archivo self-hosted successfully; no external service configuration required.

## Next Phase Readiness

- Phases 60-63 can now consume `text-2xs`/`text-xs`/`text-sm`/`text-base`/`text-lg`/`text-xl`, `font-serif`, `tabular`, the `spacing-control-*`/`spacing-chip-*`/`spacing-row-*`/`spacing-panel` density steps, `radius-card`/`radius-frame`, `pmark pmark-confirmed`/`pmark pmark-suggested`, and `tshape tshape-supplier`/`tshape-person`/`tshape-amount`/`tshape-document`/`tshape-email` -- all Tailwind utilities generated directly from these `@theme`/`@utility` registrations, zero additional wiring needed.
- `colour-law.test.ts` will catch any future phase that lets a hue creep onto a chrome token, or desaturates a tier colour into the chrome band, or lets the two themes' semantic hues drift apart -- structurally, on every `vitest run`.
- 59-03 (brand guide's visual-identity section) can document this plan's scale/density/signature-element tables directly; the `--chart-1..5` exemption flag (noted in 59-01-SUMMARY.md as pending a user decision) remains open and unaddressed by this plan, as scoped.
- `.claude/skills/polytoken-design-system/SKILL.md` still documents the pre-59 token source (flagged by 59-01-SUMMARY.md for 59-03) -- untouched by this plan, out of Task 1-3 scope.

---
*Phase: 59-visual-identity-designed-token-set-brand-guide*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: apps/web/src/app/globals.css
- FOUND: apps/web/src/app/layout.tsx
- FOUND: apps/web/src/app/__tests__/colour-law.test.ts
- FOUND: apps/web/src/app/__tests__/token-registration.test.ts
- FOUND: commit 92489ef (Task 1)
- FOUND: commit f060115 (Task 2)
- FOUND: commit dd8b6e5 (Task 3)
