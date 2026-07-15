---
phase: 60-surface-redesign-inbox-email-detail
plan: 03
subsystem: ui
tags: [four-pane-inbox, provenance-rail, serif-reading-pane, law-1-states, anti-re-token-gate]

# Dependency graph
requires:
  - phase: 60-02
    provides: fingerprintTree, inbox-pre-60.json baseline, inbox-structure.test.tsx (Legs 1-4), InboxRow's four-band registry shape, EntityChipEntry contract
  - phase: 59-visual-identity-designed-token-set-brand-guide
    provides: --text-lg (this pane's body), font-serif, tabular, spacing-panel/row-x/y, pmark/pmark-confirmed/pmark-suggested, bg-conf-wash/border-conf-line/text-conf + bg-sugg-wash/border-sugg-line/text-sugg
provides:
  - InboxThreePane's four-pane desktop shell (filters/threads/reading/entities, each data-pane marked) replacing the pre-60-03 three-pane shell
  - inbox-entities-rail.tsx's InboxEntitiesRail — the fourth pane, "What I found in this email," rendering each fact as a pmark provenance mark + tier badge + hue-free type word, no new query
  - ReadingPreview rebuilt as a document (serif subject/body at the reference's 56ch measure) instead of muted chrome
  - Law-1-clean error/empty/loading states on both the desktop and mobile trees (zero text-destructive/bg-primary\/10/bg-background\/95/border-border\/50 anywhere in the file)
  - data-tree="desktop"/"mobile" + data-pane="filters"/"threads"/"reading"/"entities" markers, consumed by inbox-structure.test.tsx's Legs 5-8
  - inbox-structure.test.tsx extended to 8 legs (Legs 5-8 new), re-proven able to fail over the FULL inbox component set including the brand-new entities-rail file
affects: [60-04-surface-redesign-inbox-email-detail, 61-total-ui-re-skin-part-2, 62-total-ui-re-skin-part-3, 63-research-canvas-visual-surfaces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "InboxEntitiesRail wired as a horizontal flex SIBLING inside the reading ResizablePanel (reading column flex-1 + fixed-width aside), not a fourth ResizablePanel -- avoids renegotiating the three existing desktop panel defaultSizes for a fixed-width 288px rail"
    - "Tier badge built from raw Tailwind utilities (bg-conf-wash/border-conf-line/text-conf, bg-sugg-wash/border-dashed border-sugg-line/text-sugg) rather than a new globals.css @utility -- no badge utility existed yet and this plan's file scope doesn't include globals.css; left as a candidate extraction if Plan 05/61-63 need the same badge shape elsewhere"
    - "data-tree/data-pane markers deliberately excluded from fingerprintTree's colour-blind walk (data-* is structurally ignored) -- they make the pane-level gate's assertions readable without being usable to game the anti-re-token shape check"

key-files:
  created:
    - apps/web/src/app/_components/inbox-entities-rail.tsx
  modified:
    - apps/web/src/app/_components/inbox-three-pane.tsx
    - apps/web/src/app/_components/__tests__/inbox-structure.test.tsx
    - apps/web/src/app/_components/__tests__/inbox-mobile-stack.test.tsx

key-decisions:
  - "Confirm/Dismiss buttons from the reference's .ent-actions are NOT built in the entities rail -- confirm/deny is an existing, canonical capability (ConfirmDenyControls, the components/{id}/confirm mutation) that lives on /emails/[id], the surface designed for it and the one 60-04/60-05 touch. Adding a second mutation path in the inbox would be new product behaviour, not a redesign of an existing interaction, and neither D-58-01 nor the ROADMAP criteria ask for it. A suggested fact instead links onward (\"Review in email ->\") to the detail view where the real control lives."
  - "The 1120px guard from the reference is realized as `hidden xl:flex` (1280px), not a custom 1120px breakpoint -- 1280 is the nearest registered Tailwind step to the reference's measured 1120px crush point; adding a one-off custom breakpoint for a single rail was judged not worth the vocabulary sprawl."
  - "Mobile chrome (Tabs restyle, pointer-coarse touch targets, serif detail-bar subject) was completed inside Task 1's edit, not deferred to Task 3 -- Task 1's own verify grep scans the WHOLE file for border-border/50, which the pre-60-03 mobile back bar carried, so the mobile chrome had to already be law-clean before Task 1's own gate could pass. Task 3's action items for the mobile feed were therefore already satisfied by the time Task 3 began; Task 3's real remaining work was the gate extension."
  - "inbox-mobile-stack.test.tsx's literal whole-tag source-string assertion (`<div className=\"hidden h-full md:block\">`) was rewritten to check the class-gating and the new data-tree marker as two independent substrings -- any additional JSX attribute on that div breaks a single-literal-substring match regardless of where the attribute is placed, and the plan explicitly requires data-tree on both top-level wrappers for Task 3's pane-scoping."

patterns-established:
  - "Pane-level gate scoping via [data-tree=\"desktop\"] -- since both the desktop and mobile trees render simultaneously in jsdom (no media-query evaluation), any future pane-count/pane-set assertion on this component must scope through this attribute the same way Legs 5/8 do, or it will double-count against the mobile tree's own (different) DOM."

requirements-completed: [SURF-01]

# Metrics
duration: ~55min
completed: 2026-07-15
---

# Phase 60 Plan 03: Four-Pane Inbox — Chrome, States, Reading Pane, Entities Rail Summary

**Rebuilt the inbox shell around Plan 02's rows: the reading pane now renders the email body as a serif document instead of muted chrome, a new fourth pane ("What I found in this email") names every extracted fact with its tier, all three states (error/empty/loading) on both the desktop and mobile trees are law-1 clean (zero madder, zero stray hue on chrome), and criterion 1's gate grew four new pane-level legs — proven able to fail over the complete inbox component set, including the brand-new entities-rail file that has no pre-Phase-60 analogue to check out.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-07-15
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified) — `inbox-mobile-stack.test.tsx` also touched as a required connectivity fix (see Deviations)

## Accomplishments

- **FiltersRail**: designed registry chrome — a `.paneh`-style section head, an ink-well active state (`bg-shade text-ink font-semibold`) replacing the pre-60-03 `bg-primary/10 text-primary` hue-on-chrome violation, and a `.fhint` footnote linking to the real `/settings/forwarding` page (no hardcoded fake address — the per-user forwarding address is semi-secret and fetched dynamically there).
- **List header**: sticky `bg-leaf` with `border-b border-hair`, a designed tabular count marker (`data-field="count"`) replacing the stock shadcn `Badge`.
- **Three states, both trees**: the pre-60-03 `text-destructive` error (madder on a non-irreversible state — a direct law-1 violation, since 58-IDENTITY.md says "Never errors, never warnings") is gone, replaced with `text-ink`/`text-faded` in a `border-rule` framed block with `role="alert"`. Empty states restyled onto `text-faded`, same copy. Loading skeletons reshaped to the new row's rhythm (short sender / longer subject / longest snippet lines) instead of uniform `h-16` slabs.
- **Ground vocabulary swapped file-wide**: `bg-background/95` → `bg-leaf`, `border-border/50` → `border-hair`, `bg-muted` hovers → `bg-shade`, everywhere in the file — including inside `ReadingPreview` and the mobile back bar, since Task 1's own verify grep scans the whole file.
- **ReadingPreview rebuilt as a document**: subject is now a serif `h2` (`font-serif text-xl text-ink`, `data-evidence`) — the pre-60-03 body rendered as `text-sm text-muted-foreground`, the exact inversion of law 2. Meta (From/To) sits sans under a ruled boundary. Body is `font-serif text-lg` (the `--text-lg` step Phase 59 anchored specifically on this pane) at the reference's `max-w-[56ch]` measure, `data-field="body"` `data-evidence`, with the existing 2000-char bound (T-60-04) and no-plain-text fallback preserved verbatim.
- **`InboxEntitiesRail`** (new file): the fourth pane. Each fact renders the same `pmark`/`pmark-confirmed`/`pmark-suggested` language the row chips use, a tier badge (the one thing law 3 lets earn colour — filled swatch for confirmed, dashed-outline swatch for suggested), and a hue-free type word with no entity-type-shape glyph (the reference's own "Chanel rule"). No new query — consumes `entitiesByEmailId.get(selectedEmailId)` straight from the three-pane's existing single batched `entitySummary` call (T-60-06). Wired as a horizontal-flex sibling inside the reading `ResizablePanel`, not a fourth `ResizablePanel`. Hidden below `xl` (1280px, nearest registered step to the reference's 1120px crush point).
- **Criterion 1's gate grew from 4 to 8 legs**: Leg 5 asserts the desktop tree names the exact SET `{filters, threads, reading, entities}` (a rename would change the set, not just shrink a count); Legs 6/7 mount `InboxEntitiesRail` directly and assert every fact carries a valid `data-tier` and an empty list renders no pane at all; Leg 8 asserts the reading body carries `font-serif` + the 56ch measure + `data-evidence`. Leg 4's source-scan extended to cover `inbox-entities-rail.tsx`.
- **Baseline-vs-current fingerprint deltas** (measured this session, temporarily instrumented then reverted — not committed): `elementCount` 81 → 105, `leafTextCount` 32 → 52. Both clear their respective legs' `toBeGreaterThan` thresholds with substantial room — the four-pane restructure roughly doubles Plan 02's own net structural growth (81→87 elementCount).

## Task Commits

1. **Task 1: Filters rail, list header, law-clean states** — `dc9008a` (feat)
2. **Task 2: Reading pane becomes a document + the provenance rail** — `9f8606c` (feat)
3. **Task 3: Pane-level gate extension + negative proof** — `e053d57` (test)

## THE NEGATIVE PROOF (verbatim)

Re-run over the COMPLETE inbox component set (`inbox-row.tsx`, `inbox-thread-group.tsx`, `entity-chips.tsx`, `inbox-three-pane.tsx`, `inbox-entities-rail.tsx`) per Task 3's instruction.

**Mechanic, adapted from 60-02's own precedent**: the plan's Task 3 text names `git stash push` as the mechanic, but by the time Task 3 runs every one of these five files is already committed (Tasks 1/2 of this plan, plus Plans 01/02) — a `git stash push` against fully-committed files is a silent no-op, exactly the problem 60-02-SUMMARY.md documented and worked around via `git checkout <pre-60-commit> -- <files>` + `git checkout HEAD -- <files>`. Applied the same proven mechanic here. `inbox-entities-rail.tsx` additionally never existed pre-Phase-60 at all (a wholly new pane, not a restyled one) — `git checkout 4e08122 -- inbox-entities-rail.tsx` would error on a nonexistent pathspec, so it was removed outright (`rm`) instead, then restored the same way as the other four files (`git checkout HEAD -- <path>`).

**1. Restore the pre-Phase-60 versions**, Phase 59's colour system left fully in place:

```
git checkout 4e08122 -- apps/web/src/app/_components/inbox-row.tsx apps/web/src/app/_components/inbox-thread-group.tsx apps/web/src/app/_components/entity-chips.tsx apps/web/src/app/_components/inbox-three-pane.tsx
rm apps/web/src/app/_components/inbox-entities-rail.tsx
```

**2. Run the suite. RED — a module-resolution failure, not merely an assertion failure:**

```
 ❯ src/app/_components/__tests__/inbox-structure.test.tsx (0 test)

 FAIL  src/app/_components/__tests__/inbox-structure.test.tsx [ src/app/_components/__tests__/inbox-structure.test.tsx ]
 Error: Failed to resolve import "../inbox-entities-rail" from "src/app/_components/__tests__/inbox-structure.test.tsx". Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
```

This is a render/prop-shape-class failure mode ("either a clean shape-equality assertion failure or a render/prop-shape error is acceptable evidence" — the plan's own acceptance language), and arguably the strongest possible proof available for this specific plan: the fourth pane cannot even exist without Phase 60's work, so the reverted state cannot even construct a DOM to compare against the baseline.

**3. Restore and confirm green + no leak:**

```
git checkout HEAD -- apps/web/src/app/_components/inbox-row.tsx apps/web/src/app/_components/inbox-thread-group.tsx apps/web/src/app/_components/entity-chips.tsx apps/web/src/app/_components/inbox-three-pane.tsx apps/web/src/app/_components/inbox-entities-rail.tsx
```

```
 ✓ src/app/_components/__tests__/inbox-structure.test.tsx (8 tests)
 ✓ src/app/_components/__tests__/inbox-mobile-stack.test.tsx (4 tests)
 Test Files  2 passed (2)
      Tests  12 passed (12)
```

`git diff --stat 9f8606c -- apps/web/src/app/_components/inbox-row.tsx apps/web/src/app/_components/inbox-thread-group.tsx apps/web/src/app/_components/entity-chips.tsx apps/web/src/app/_components/inbox-three-pane.tsx apps/web/src/app/_components/inbox-entities-rail.tsx` — **empty**. No proof edit leaked into the committed state.

## Files Created/Modified

- `apps/web/src/app/_components/inbox-entities-rail.tsx` — **NEW.** `InboxEntitiesRail`, the fourth pane.
- `apps/web/src/app/_components/inbox-three-pane.tsx` — `FiltersRail`/list-header/states rebuild (Task 1), `ReadingPreview` document rebuild + rail wiring (Task 2), `data-tree`/`data-pane` markers, mobile chrome (Tabs/back-bar) restyle.
- `apps/web/src/app/_components/__tests__/inbox-structure.test.tsx` — Extended from 4 to 8 legs (Task 3).
- `apps/web/src/app/_components/__tests__/inbox-mobile-stack.test.tsx` — One assertion rewritten (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `inbox-mobile-stack.test.tsx`'s literal whole-tag source assertion broke the instant `data-tree` was added**
- **Found during:** Task 1 verification
- **Issue:** The plan explicitly requires `data-tree="desktop"`/`"mobile"` markers on the two top-level tree wrappers (for Task 3's pane-scoping). `inbox-mobile-stack.test.tsx` (an existing, not-in-scope test file) asserted `SOURCE.toContain('<div className="hidden h-full md:block">')` — a literal whole-tag substring match that breaks the instant ANY additional JSX attribute is added to that div, regardless of where it's placed in the tag.
- **Fix:** Rewrote the assertion to check the class-gating and the `data-tree` marker as two independent, order-tolerant substrings instead of one brittle whole-tag literal.
- **Files modified:** `apps/web/src/app/_components/__tests__/inbox-mobile-stack.test.tsx`
- **Commit:** `dc9008a` (bundled with the Task 1 commit, since the gate that found it and the fix are tightly coupled)

**2. [Rule 3 - Blocking issue] `inbox-entities-rail.tsx`'s own doc comments initially self-matched Task 2's grep-based verify gate**
- **Found during:** Task 2 verification
- **Issue:** Two JSDoc/JSX block comments described the "no entity-type-shape glyph" rule using the literal `` `tshape` `` class-name substring. Task 2's verify command (`grep -c "tshape\|graph-"`) filters out `//` line comments but not `{/* */}`/`/** */` block comments — the same self-match class documented in 60-01-SUMMARY.md's deviation #2.
- **Fix:** Reworded both comments to describe the rule ("no entity-type-as-silhouette glyph") without the literal banned substring.
- **Files modified:** `apps/web/src/app/_components/inbox-entities-rail.tsx` (comment text only)
- **Commit:** `9f8606c`

### Documented Deviations (not auto-fixed, deliberately deferred)

**3. Negative-proof mechanic adapted from `git stash push` (as the plan's Task 3 text names it) to `git checkout <commit> -- <files>`**
- **Context:** identical situation to 60-02-SUMMARY.md's own documented deviation — by the time Task 3 runs, every file involved is already committed, so `git stash push` is a silent no-op against a clean working tree.
- **Resolution:** applied 60-02's own proven mechanic (`git checkout <pre-60-commit> -- <files>` then `git checkout HEAD -- <files>`), extended to handle `inbox-entities-rail.tsx`'s special case (never existed pre-Phase-60 — removed via plain `rm` rather than a nonexistent-pathspec checkout). See "THE NEGATIVE PROOF" above for the full mechanic and verbatim output.

## Known Stubs

None. The `entities.length`-as-`totalCount` stopgap documented in 60-01/60-02-SUMMARY.md (in `inbox-row.tsx`'s `EntityChips` call site) remains untouched by this plan — `inbox-three-pane.tsx`'s `entitiesByEmailId` map still does not carry the server's true per-email `totalCount`. Not this plan's scope (Task 2's interfaces §A explicitly scoped the rail to read from the existing map as-is); left for a future plan that touches the map's shape.

## Verification

```
cd apps/web && npx tsc --noEmit                                                    -> clean
cd apps/web && npx vitest run                                                       -> 67 files, 739 passed, 1 skipped
cd apps/web && npx vitest run src/app/_components/__tests__/inbox-structure.test.tsx
                              src/app/_components/__tests__/inbox-mobile-stack.test.tsx  -> 12/12 passed
cd apps/web && npm run build:local                                                  -> succeeds (20/20 static pages generated)
```

## Issues Encountered

None beyond the deviations documented above (all understood and resolved before their respective verify gates passed).

## User Setup Required

None.

## Next Phase Readiness

- Plan 04 (region-vocabulary.ts, region-overlay-box.tsx re-encoding, the 20-case role x status matrix gate) does not depend on any file this plan touched — it operates on `apps/web/src/app/emails/[id]/_components/`, a disjoint surface. No blockers.
- The tier-badge markup built inline in `inbox-entities-rail.tsx` (raw `bg-conf-wash`/`border-conf-line`/`text-conf` + `bg-sugg-wash`/`border-sugg-line`/`text-sugg` utilities, no dedicated `@utility badge-*` in `globals.css`) is a candidate for extraction into a shared utility if Plan 05 or 61-63 need the same badge shape on another surface — left inline here since this plan's file scope does not include `globals.css` and no second consumer exists yet.
- `inbox-structure.test.tsx` now has 8 legs and is the reference shape for any future pane-level gate on a dual-tree (desktop/mobile) component — scope every query through `[data-tree="desktop"]` or `[data-tree="mobile"]` as this plan's Legs 5/8 do, or risk double-counting against the sibling tree's simultaneous jsdom render.

---
*Phase: 60-surface-redesign-inbox-email-detail*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: apps/web/src/app/_components/inbox-entities-rail.tsx
- FOUND: commit dc9008a (Task 1)
- FOUND: commit 9f8606c (Task 2)
- FOUND: commit e053d57 (Task 3)
