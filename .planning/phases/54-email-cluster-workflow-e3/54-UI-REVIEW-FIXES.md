# Phase 54 — UI Review Fixes

**Closed:** 2026-07-12
**Source:** `54-UI-REVIEW.md`'s Top 3 Priority Fixes + the Pillar 6 Experience Design findings (Overall score 16/24)
**Scope:** all 5 findings the task specified — both BLOCKERs, the `bg-primary` WARNING, and the two Minor findings (trigger `focus:` vs `focus-visible:`, undeclared text sizes). No screenshots captured this run (local dev stack down, per the source review's own note) — fixes verified at the code/test level (vitest + typecheck + design-token gates).

---

## Finding #1 — `EmailThreadNode` error/empty body overflows the 148px shell budget, clipping Retry (BLOCKER)

**Problem:** The fixed `320x220` node shell leaves the body wrapper exactly 148px of height (220 − 36px header − 36px two-action footer). `EmptyState`'s `layout="centered" size="compact"` branch renders `absolute inset-0 ... p-8` with a `text-base` heading + `text-sm` body + `mt-6`-gapped default-variant `Button` — roughly 160px of content, nearly double what's available. The shell's `overflow-hidden` hard-clips the overflow, with the "Retry" button (last flex child) the most likely casualty — making a thread-load error functionally unrecoverable without removing/re-adding the card.

**Fix:** `email-thread-node.tsx`'s error and empty/not-found branches no longer render the shared `EmptyState` primitive at all. Both now render a compact inline recipe scoped to this file: a small `size-5` icon, a single `text-xs` message paragraph combining the heading+body copy into one line (wrapping naturally at this width — not two separate typographic registers), and — for the error branch only — a text-height "Retry" button. The stack measures ~90px, comfortably inside the 148px body budget with headroom to spare. `EmptyState` itself and the `320x220`/`h-9`/`h-9` shell dimensions are byte-for-byte unchanged — this was a call-site fix, not a primitive change.

**Copywriting Contract:** both exact strings ("Couldn't load this thread." / "Try again, or open it from your inbox." and "This thread is unavailable." / "It may have been removed or is no longer accessible.") are preserved verbatim, just concatenated into one paragraph rather than a separate heading+body pair.

---

## Finding #2 — `ThreadClusterIndicator`'s "Open thread →" popover link has no focus-visible styling or pending-data guard (BLOCKER)

**Problem:** The link's className was `"text-xs text-muted-foreground hover:text-accent-foreground"` — zero `focus`/`focus-visible` classes, violating the phase's unconditional "focus ring never dropped" rule. It also linked to `href="#"` while `threadCardQuery.data` was still pending, with no `aria-disabled`/`pointer-events-none`/`onClick preventDefault` guard, unlike `EmailThreadNode`'s equivalent footer link.

**Fix:** the link now mirrors `EmailThreadNode`'s sibling recipe (`email-thread-node.tsx:192-201`) exactly:
- `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1`
- a new `canOpenThread` guard (`threadCardQuery.data !== undefined && threadCardQuery.data !== null`, computed the same way as `EmailThreadNode`'s `canOpenThread`) drives `aria-disabled`, an `onClick` `preventDefault` while pending, and `pointer-events-none opacity-50` styling.

---

## Finding #3 — Retry action renders a filled `bg-primary` button (WARNING)

**Problem:** `EmptyState`'s `ActionButton` hardcodes `variant="default"` (`bg-primary text-primary-foreground`), so the Retry action nested inside `EmailThreadNode`'s error state was a second, undisclosed `--primary` consumer — contradicting the Color contract's "exactly one new consumer" claim and undercutting Judgment Call #2's stated restraint on primary usage.

**Fix:** resolved as a direct consequence of Finding #1 — Retry is now a plain `<button>` styled with the neutral-ghost `hover:bg-accent hover:text-accent-foreground` family (the same recipe as the footer's "Open thread" link), never routing through `EmptyState`/`ActionButton`. No `actionVariant` prop was added to `EmptyState` — the shared primitive is intentionally untouched, per this fix's constraints. `KnowledgePreviewMiniGraph`'s identical pre-existing `EmptyState`-Retry-through-`bg-primary` pattern is out of scope (not introduced by Phase 54).

---

## Finding #4 — `ThreadClusterIndicator` trigger uses `focus:` instead of `focus-visible:` (Minor)

**Problem:** the trigger button's ring classes were `focus:outline-none focus:ring-2 focus:ring-ring` (mouse-click-visible, not keyboard-only) and missing `ring-offset-1` — inconsistent with every other new interactive element in this phase.

**Fix:** switched to `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1`, matching the remove button / footer link recipe. `cost-meter.tsx:36`'s identical pre-existing pattern is left untouched, out of scope.

---

## Finding #5 — undeclared text sizes in the fixed error/empty branches (Minor)

**Problem:** `EmptyState`'s compact branch injected `text-base` (heading) and a second `text-sm` consumer (body) not accounted for in the phase's declared 2-size scale.

**Fix:** resolved as a consequence of Finding #1 — the compact inline replacement uses `text-xs` exclusively for both the icon-adjacent message and the Retry button label, so `EmailThreadNode`'s full state matrix (loading/error/empty/success) now sticks to the phase's declared scale with no new sizes introduced.

---

## Tests added

- `email-thread-node.test.tsx`:
  - error state: asserts the single compact `text-xs` message paragraph (never `text-base`/`text-sm`), and that the Retry button carries the neutral-ghost `hover:bg-accent` + `focus-visible:ring-ring` classes and never `bg-primary`.
  - empty state: asserts no "Retry" button renders (compact recipe has no action for the not-found branch).
- `thread-cluster-indicator.test.tsx`:
  - trigger: asserts `focus-visible:ring-ring` + `focus-visible:ring-offset-1` replace the old bare `focus:` recipe.
  - "Open thread" link: asserts focus-visible styling, `aria-disabled="true"` + `pointer-events-none` + `href="#"` while `threadCardQuery.data` is pending, and that the guard drops (`aria-disabled="false"`, real `href`) once the query settles.

## Verification

| Gate | Result |
|------|--------|
| `email-thread-node.test.tsx` + `thread-cluster-indicator.test.tsx` | 36/36 passing (was 32/32 before this change; +4 new) |
| Full `_canvas` suite | 29 test files / 233 tests passing, no regressions |
| `palette-ban.test.ts` | 2/2 passing |
| `token-contrast.test.ts` | 6/6 passing |
| `token-registration.test.ts` | 4/4 passing |
| `tsc --noEmit` (excluding pre-existing `apps/web/src/app/dev/design` errors, unrelated to this change) | clean |

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| `1a460b9` | fix | compact card-embedded error/empty state (`EmailThreadNode`) + link accessibility (`ThreadClusterIndicator`) |
| `8b70e16` | test | vitest coverage for the compact retry recipe + focus-visible/pending-guard link |
