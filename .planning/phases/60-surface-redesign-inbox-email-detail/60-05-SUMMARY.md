---
phase: 60-surface-redesign-inbox-email-detail
plan: 05
subsystem: ui
tags: [extraction-summary, tier-vocabulary, law-1, law-2, law-3, structural-gate, negative-proof, destructive-disposition]

# Dependency graph
requires:
  - phase: 60-04
    provides: region-vocabulary.ts (tierOf/REGION_TIER/REGION_ROLE_GEOMETRY/regionLabelFor) — consumed here as lookups by four more files, exactly as 60-04 anticipated
  - phase: 60-01
    provides: structural-fingerprint.ts (the colour-blind fingerprint this plan's baseline + gate are built on) and the pmark provenance-mark language
  - phase: 58-visual-identity-sketch-pick-human-gate
    provides: D-58-01 (LOCKED) — the three laws; direction-final.html's `.ent`/`.kd-rows`/`.badge` bands as the rendered reference
provides:
  - extraction-summary-panel.tsx rebuilt on the tier vocabulary with law 2 inverted back (the extracted VALUE now reads as evidence, the property label as chrome)
  - REGION_TIER's `badge`/`swatch` treatment — the SANS way to state a tier in chrome, the counterpart to `chip`'s serif evidence mark (consumed by the extraction panel, status-badge.ts, and layers-tree-row.tsx)
  - getStatusBadge resolving through tierOf — a candidate no longer outranks a confirmed fact
  - extraction-summary-structure.test.tsx — the extraction surface's shape gate, proven able to fail on the exact CONTEXT-flagged regression
  - __baselines__/extraction-summary-pre-60.json — the frozen pre-60 extraction structure
affects: [61-total-ui-re-skin-part-2, 62-total-ui-re-skin-part-3, 63-research-canvas-visual-surfaces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "REGION_TIER now carries BOTH an evidence treatment (`chip`, serif via pmark) and a chrome treatment (`badge`/`swatch`, sans) -- because law 2 makes 'state a tier in colour' and 'render the document's words' two different jobs that cannot share one class string"
    - "shared support/ modules for the fixture AND the render, so a baseline-vs-current structural comparison cannot drift apart into an unfair (and therefore falsely green) comparison"
    - "a status word, a tier word, and a property label are all CHROME (sans); only candidateValue/contentText are EVIDENCE (serif) -- the discriminator is provenance, not element type"

key-files:
  created:
    - apps/web/src/app/emails/[id]/_components/__tests__/__baselines__/extraction-summary-pre-60.json
    - apps/web/src/app/emails/[id]/_components/__tests__/capture-extraction-baseline.test.tsx
    - apps/web/src/app/emails/[id]/_components/__tests__/extraction-summary-structure.test.tsx
    - apps/web/src/app/emails/[id]/_components/__tests__/support/extraction-fixture.ts
    - apps/web/src/app/emails/[id]/_components/__tests__/support/render-extraction-panel.tsx
  modified:
    - apps/web/src/app/emails/[id]/_components/extraction-summary-panel.tsx
    - apps/web/src/app/emails/[id]/_components/region-vocabulary.ts
    - apps/web/src/app/emails/[id]/_components/status-badge.ts
    - apps/web/src/app/emails/[id]/_components/confirm-deny-controls.tsx
    - apps/web/src/app/emails/[id]/_components/layers-tree-row.tsx

key-decisions:
  - "REGION_TIER grew `badge`/`swatch` rather than the plan's literal 'colour the tier badge via REGION_TIER[tier].chip'. The plan asks for two mutually exclusive things in one sentence: a badge 'on the reference's .badge.c/.badge.s pattern' (the sketch's `.badge` is SANS) coloured via `chip` (which is `pmark ...`, and `pmark` sets font-family: var(--font-serif)). A tier WORD is polytoken's vocabulary, not the document's, so serif on it violates law 2 -- and the gate this same task specifies ('no element carries font-serif without data-evidence') reads class strings, so it structurally CANNOT see that violation: `pmark` would have smuggled the serif past my own gate. The sketch itself draws the distinction (`.pm` serif vs `.badge` sans). Task 2's own rule -- 'if a genuinely new shape is needed, add it to region-vocabulary.ts -- not to this file' -- is the sanctioned path, so the system grew. Same reasoning applied to status-badge.ts, which renders the raw status word."
  - "EvidenceValue omits the plan's literal `text-ink`. The plan says the value is 'font-serif text-sm text-ink, wrapped in the pmark language tinted by the field's OWN tier' -- but pmark-confirmed/pmark-suggested each set `color`, so `text-ink` alongside them is two colour utilities on one element resolved by Tailwind's cascade order rather than by intent (the same class of nuance 60-04 flagged for its opacity pair). The tint IS the point ('tinted by the field's OWN tier'), and the reference's own entity value is `.pm.c.ev` -- tinted, not ink. Kept the tint, dropped the ink."
  - "The entity header gained the entity's OWN detected words as an evidence line. This is what actually earns the leafTextCount delta, and the plan's stated arithmetic for that leg is factually wrong: it claims growth because 'the tier word is now rendered text rather than an sr-only whisper', but fingerprintTree is class-blind and ALREADY counted the sr-only word as a rendered fact -- the badge swap is net-zero on that metric (verified empirically). Rather than pad the DOM to make a number move, the honest fix was to render a fact the panel was missing: pre-60 it could say 'Supplier' but never WHICH supplier, which is the one question a 'what did we pull out of this document' registry exists to answer. Traceable to the reference's `.ent`/`.ev` band (sketch lines 963-986), which the task's own read_first cites as 'the registry band this mirrors'."
  - "layers-tree-row.tsx's property-label/value hierarchy was inverted too (label was text-sm font-semibold, value was muted). The plan only explicitly mandates serif+data-evidence on document-derived text there, but leaving the label louder than the value would have reproduced, one panel over, the exact law-2 inversion this plan exists to fix."

patterns-established:
  - "When a surface needs to state a tier in CHROME, use REGION_TIER[tier].badge + .swatch; when it renders the DOCUMENT's words, use .chip. Reaching for .chip on chrome is the mistake this plan had to catch in its own draft -- it silently drags pmark's serif onto a sans surface, and a className-based law-2 gate cannot see it."

requirements-completed: [SURF-04]

# Metrics
duration: ~50min
completed: 2026-07-15
---

# Phase 60 Plan 05: Extraction Surface On The Tier Vocabulary Summary

**Turned law 2 the right way up on the extraction surface — the extracted VALUE, which is the document's own words and the entire product, now renders as serif evidence in its own tier's provenance mark instead of as `text-muted-foreground` beneath a bolded property label — killed the node-TYPE-hue-as-TIER violation 60-CONTEXT named by routing four more files through one `tierOf`, gave the tier a visible WORD instead of a 2x2 dot with an `sr-only` whisper, and proved the restructuring with a colour-blind shape gate (elements 64→67, leafText 22→24) that was demonstrated RED against the exact violation it polices.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-07-15
- **Tasks:** 3
- **Files modified:** 10 (5 created, 5 modified)

## Task Commits

1. **Task 1 STEP 1 — freeze the pre-60 structure (before any edit)** — `a8dfb5b` (test)
2. **Task 1 STEP 2 — rebuild the extraction registry on the vocabulary** — `1e4a6d3` (feat)
3. **Task 2 — the tier-bearing trio onto one vocabulary** — `81a60d1` (feat)
4. **Task 3 — the shape gate + negative proof** — `da6892c` (test)

## Baseline vs. Current — the structural delta

The baseline was captured from `extraction-summary-panel.tsx` **as it shipped pre-Phase-60**
(Plans 01-04 never touched the file) and committed in `a8dfb5b` **before** the Task 2 rewrite in
`1e4a6d3`. Order verified: `a8dfb5b` contains the baseline JSON and an import-only diff to the
component; the rewrite lands one commit later.

| Metric | Pre-60 baseline | Post-60 current | Delta |
|---|---|---|---|
| `shape` | `div(div(div(h2#tp#t)div(style#tdiv(div(div(section(header(p#tspan(span[aria-hidden]span#t))…` | differs | **≠** |
| `elementCount` | 64 | 67 | **+3** |
| `leafTextCount` | 22 | 24 | **+2** |
| `maxDepth` | 11 | 11 | 0 |

`fingerprintTree` reads **no className, no style, and no `data-*`** — so none of this plan's
recolouring (the candidate's hue moving from a node-type grey to pencil-amber, every token swap)
can move `shape` by one character. Only genuine restructuring can. What moved it:

- the tier **badge** (swatch + real word) replacing the dot + `sr-only` label;
- the **label-over-value band** replacing the `justify-between` label/value/dot row;
- the entity header's new **evidence line**.

**An honest note on the `leafTextCount` leg.** The plan predicts growth because "the tier word is
now rendered text rather than an `sr-only` whisper". That reasoning does not hold:
`fingerprintTree` is class-blind, so it *already counted* the pre-60 `sr-only` word as a rendered
fact — the badge swap is **net-zero** on this metric (verified empirically before relying on it).
The +2 comes entirely from the two entity headers each gaining the entity's own detected words.
Rather than pad the DOM to make a number move, the growth is a fact the panel genuinely lacked:
pre-60 it could tell you "Supplier" but never *which* supplier.

## THE NEGATIVE PROOF (verbatim)

Temporarily reintroduced the exact violation 60-CONTEXT.md names by name — a tone map whose
`candidate` entry is the node-TYPE hue — into the panel's tier badge:

```tsx
const TONE_DOT: Record<string, string> = {
  candidate: "bg-graph-email-component",
};

function TierBadge({ status }: { status: string }) {
  const tier = tierOf(status);
  const { badge, swatch } = REGION_TIER[tier];
  const toneClass = TONE_DOT[status] ?? badge;   // <- the violation
  ...
```

Ran the gate scoped to `-t "Leg 5"`. **RED:**

```
 ❯ src/app/emails/[id]/_components/__tests__/extraction-summary-structure.test.tsx (6 tests | 1 failed | 5 skipped) 71ms
   × extraction-summary-structure (SURF-04 — the extraction surface's shape gate) > Leg 5: a candidate is pencil-amber — never a node-type hue (the CONTEXT-flagged regression) 70ms
     → a suggested tier must wear the sugg token — this is the tier's whole claim: expected 'inline-flex shrink-0 items-center gap…' to contain 'sugg'

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/app/emails/[id]/_components/__tests__/extraction-summary-structure.test.tsx > extraction-summary-structure (SURF-04 — the extraction surface's shape gate) > Leg 5: a candidate is pencil-amber — never a node-type hue (the CONTEXT-flagged regression)
AssertionError: a suggested tier must wear the sugg token — this is the tier's whole claim: expected 'inline-flex shrink-0 items-center gap…' to contain 'sugg'
Expected: "sugg"
Received: "inline-flex shrink-0 items-center gap-1.5 rounded-[4px] px-1.5 py-0.5 text-2xs font-semibold whitespace-nowrap bg-graph-email-component"
 ❯ src/app/emails/[id]/_components/__tests__/extraction-summary-structure.test.tsx:181:9

 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
```

The `Received` line shows the violating hue verbatim on the candidate's badge — the gate catches
the regression at its first assertion (the tier's own token claim), before it even reaches the
`graph-`-specific assertion. Unambiguous.

Reverted via `git checkout -- apps/web/src/app/emails/[id]/_components/extraction-summary-panel.tsx`.
`git diff --stat 81a60d1 -- <that file>` — **empty**. `grep -c "TONE_DOT\|graph-"` on the file —
**0**. Full suite re-run green (71 files, 801 passed).

## The `destructive` disposition (§D), judged occurrence by occurrence

§D's rule: **madder is CORRECT on a control that performs an irreversible action; WRONG on an
error, a status, or a warning.** Not blanket-removed — each judged on its own.

| # | Occurrence | Verdict | Why |
|---|---|---|---|
| 1 | `confirm-deny-controls.tsx:82` — the ✗ **DENY button** | **KEPT** | Performs an irreversible action: server-side soft-reject of the region, or clearing the extracted value. This is exactly what law 1 earns madder for. Removing it would break law 1 *from the other side*, leaving the one genuinely destructive control indistinguishable from the benign ✓ sitting 4px to its left. Disposition recorded in the file's own header so a future edit cannot mistake it for an oversight. |
| 2 | `layers-tree-row.tsx:201` — the ✗ **deny button** (tree-row twin of #1) | **KEPT** | Same control, same irreversible action, same verdict. |
| 3 | `status-badge.ts` — `destructive` in the **return type** | **REMOVED** | A *status* is not an action. It was never returned, so removing it changes no pixel — but leaving it in the type was a standing invitation for a future edit to paint a status madder, which law 1 forbids by name. Both callers (`fields-panel.tsx`, `entities-list.tsx`) compile unchanged: they pass `variant` straight to `Badge`, whose own prop union still accepts the narrower type. |

**One nuance worth naming, not silently resolving:** deny on an *auto-detected* box shows a 3000ms
Undo toast, so that path is arguably not strictly irreversible. The plan's §D adjudicates deny as
irreversible and I kept it — the undo is a client-side grace period on an action the server has
already performed, not a reversal guarantee, and the user-drawn path has no undo at all. Flagged
here rather than quietly re-litigated.

## Accomplishments

- **`extraction-summary-panel.tsx` rebuilt.** `statusTone`/`TONE_DOT`/`TONE_LABEL` deleted; tier
  routes through `tierOf` + `REGION_TIER` only (T-60-08 — no second, divergent mapping). The
  CONTEXT-flagged `candidate: "bg-graph-email-component"` is gone: a candidate **is** `suggested`
  and wears pencil-amber. `confirmed: "bg-success"` was right *by accident* (`--success` aliases
  `--conf`) and is now right *on purpose*, via an explicit lookup that cannot drift.
- **Law 2 inverted back.** The property label (polytoken's word for a slot) is now `text-2xs
  text-pencil` sans chrome; the extracted value (the document's own words) is `font-serif` +
  `tabular` + the `pmark` mark tinted by **its own** tier — never its parent entity's, since a
  suggested field under a confirmed entity is still only suggested. The "no value" case stays a
  muted italic sans note: an absence is not evidence, so it earns no serif.
- **Tier is a word.** `StatusDot` → `TierBadge`: a swatch **plus** the visible word, `data-field="tier-badge"
  data-tier={tier}`. Pre-60 the word was `sr-only` — sighted users got a 2x2 dot and nothing else,
  the exact "tier meter" concern 58-IDENTITY rejected in Direction C. A `pending` field now reads
  **"Suggested"** instead of the old meaningless **"—"**.
- **The entity section is a frame, not a wash.** `border-graph-entity/30 bg-graph-entity/10` +
  `text-graph-entity` (role-as-hue) → `rounded-card border border-rule bg-leaf`. Its tier colours
  the badge only — tinting the whole section would flood the panel and drown the individual field
  marks.
- **`status-badge.ts`:** `candidate → variant "default"` painted a candidate in full `--primary`
  ink, **louder than a confirmed fact** — the ladder upside down; `confirmed` had no case at all
  and fell through to `secondary`, so the surface's strongest claim was its quietest badge. Now a
  `tierOf` lookup. `rejected` keeps `line-through` and `superseded` keeps `opacity-60` — both
  structural, hue-free, and making no tier claim, so both correct as-is.
- **`layers-tree-row.tsx`:** the three role-as-hue chips deleted (law 3); role now carries
  structure via `REGION_ROLE_GEOMETRY` (heavy/light/dotted border) over a hue-free chrome fill,
  mirroring the reference's `.badge.type`. Post-59 those three hues had collapsed into
  near-identical greys anyway — they had stopped distinguishing anything. Its unclassified row's
  three-way `??` label fallback now routes through `regionLabelFor`, so **only** the
  content-snippet case (the document's own words) earns the serif, with B1's precedence preserved
  exactly.
- **Behaviour preserved exactly.** `HIDDEN_STATUSES`, `isMeaningfulField`, `fieldsByParent`,
  `orphanFields`, `isEmpty`, the confirm affordance + Loader2 spinner, the panel head, the counts
  line, the `ScrollArea`, and the empty-state copy are behaviourally untouched. The fixture
  deliberately includes rejected/superseded/non-meaningful/non-region rows so those filters are
  *exercised* by the gate's render, not merely asserted. No `dangerouslySetInnerHTML`; every tier
  class is a lookup from a closed map keyed by the `tierOf` union (T-60-02).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `extraction-summary-panel.tsx` could not be mounted at all**
- **Found during:** Task 1 Step 1, the very first capture run
- **Issue:** `ReferenceError: React is not defined` — `tsconfig.json` sets `jsx: "preserve"`, so
  vitest's classic JSX runtime needs React in scope; the file had no React import, having never
  been mounted directly. The exact issue 60-04 hit with `region-overlay-box.tsx`.
- **Fix:** Added `import * as React from "react";` and **nothing else** — the diff was verified
  import-only before committing, and an import statement cannot move rendered DOM, so the baseline
  remains a true pre-60 capture. Landed in the freeze commit (`a8dfb5b`) because the capture
  cannot run without it.
- **Verification:** `git diff` of that commit shows a single added import line.

**2. [Rule 1 - Internal inconsistency] The plan asks for a badge that is both sans and serif**
- **Found during:** Task 1 Step 2
- **Issue:** "a tier BADGE **on the reference's `.badge.c`/`.badge.s` pattern**" (the sketch's
  `.badge` is sans) "**coloured via `REGION_TIER[tier].chip`**" (`chip` is `pmark pmark-*`, and
  `pmark` sets `font-family: var(--font-serif)`). Mutually exclusive. Worse, the same task's gate
  ("no element carries `font-serif` without `data-evidence`") matches **class strings**, so
  `pmark` would have smuggled the serif onto chrome *past my own gate* — a violation the gate
  structurally cannot see.
- **Fix:** Grew the system, per Task 2's own explicit rule ("if a genuinely new shape is needed,
  add it to `region-vocabulary.ts` — not to this file"): `REGION_TIER` gained `badge` (sans
  border+fill+text colour, from the sketch's `.badge.c`/`.badge.s`) and `swatch` (solid for
  confirmed, hollow-dashed for suggested — restating tier in shape, not colour alone). `chip`
  keeps its meaning as the **evidence** treatment. Same fix applied in `status-badge.ts`, which
  renders the raw status word.
- **Files modified:** `region-vocabulary.ts` (not in the plan's `files_modified`)
- **Verification:** 60-04's `region-vocabulary.test.ts` (17 tests) and `region-overlay-law.test.tsx`
  (38 tests) both still green — the additions are new keys, and those suites iterate
  `Object.values` without pinning the key set.

**3. [Rule 1 - Undefined precedence] `text-ink` stacked on a `pmark-*` tint**
- **Found during:** Task 1 Step 2
- **Issue:** The plan specifies the value as `font-serif text-sm text-ink` **and** "wrapped in the
  `pmark` language tinted by the field's OWN tier". `pmark-confirmed`/`pmark-suggested` each set
  `color`, so `text-ink` alongside them puts two colour utilities on one element, resolved by
  Tailwind's cascade order rather than by intent (the same class of nuance 60-04 flagged for its
  opacity pair).
- **Fix:** Kept the tier tint (which the plan calls the point, and which the reference's own
  `.pm.c.ev` entity value uses), dropped `text-ink`.

**4. [Rule 2 - Gate correctness] Shared fixture + render support modules**
- **Found during:** Task 1 Step 1 / Task 3
- **Issue:** The gate's entire claim is a delta against a frozen artifact, which is honest only if
  both sides render identical input — and the **props** matter as much as the fixture
  (`onConfirmEntity` decides whether the confirm button exists at all). Two inline copies, the
  inbox pair's convention, make that a copy-paste hope; a later edit to one side would surface as
  a **false** delta, i.e. the gate passing for the wrong reason.
- **Fix:** `support/extraction-fixture.ts` + `support/render-extraction-panel.tsx`, imported by
  both. The inbox pair duplicates theirs only because each needs its own hoisted
  `vi.mock("~/trpc/react")` factory with a *different* shape; `ExtractionSummaryPanel` is pure
  presentational and needs no mock, so that constraint does not apply.

**5. [Judgment] The entity header's evidence line, and the leafTextCount arithmetic**
- Documented in full under "Baseline vs. Current" above and in `key-decisions`. Summary: the
  plan's stated reason for `leafTextCount` growth is factually wrong (the class-blind fingerprint
  already counted the `sr-only` word), so the leg needed a real fact to measure. Added the
  entity's own detected words — reference-traceable to `.ent`/`.ev`, and the answer to a question
  the registry could not previously answer — rather than padding the DOM to move a number.

**6. [Consistency] `layers-tree-row.tsx`'s label/value hierarchy inverted too**
- The plan mandates only serif + `data-evidence` on document-derived text there. But its property
  label was `text-sm font-semibold` and its value `text-muted-foreground font-normal` — the exact
  law-2 inversion this plan exists to fix, one panel over. Inverted it: quiet sans label, serif
  evidence value in its own tier's mark.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access pattern, or schema change — this plan is
rendering-only. T-60-02/T-60-08 are actively mitigated (values stay React text nodes; every tier
decision is a single `tierOf` lookup) and asserted by the gate's Legs 5-6.

## Verification

```
cd apps/web && npx tsc --noEmit                                   -> clean
cd apps/web && npx vitest run                                     -> 71 files, 801 passed, 2 skipped
cd apps/web && npx vitest run .../extraction-summary-structure.test.tsx -> 6/6 passed
cd apps/web && npm run build:local                                -> succeeds
Task 1 grep gate (graph-/bg-success/text-success/statusTone/TONE_DOT, comments excluded) -> 0
Task 2 grep gate (graph-/bg-success/text-success across the trio, comments excluded)     -> 0
```

Suite count moved 69 files / 794 passed / 1 skipped (60-04's close) → **71 / 801 / 2**: exactly the
two files and seven tests this plan adds (6 gate legs + 1 always-on artifact check; the capture
describe is the second skip).

## Issues Encountered

- **Pre-existing, explicitly not this plan's** (named per 60-CONTEXT, and neither surfaced in
  `apps/web`'s suite): the `packages/genui` `artifacts.test.ts` hash drift (different package,
  never collected by this run) and the sidebar pointer-events E2E interception bug (backlog
  999.21 — no browser test was run; this plan needs none).
- **A hazard worth flagging for Plans 06+:** Task 1/2's verify greps filter only `^\s*//` lines,
  so a block-comment line (` * ...`) mentioning `graph-`/`bg-success`/`text-success` would
  self-invalidate the gate. 60-01/60-03 hit this; 60-04 designed around it; this plan's file
  headers were phrased around the literals from the start (e.g. "node-TYPE hue"). The gate would
  fail loudly rather than falsely pass, but it costs a rework.
- **60-04's Deviation 4 (the terminal+field opacity nuance) remains open** and was not touched
  here. It stays a visual-QA item: this plan's panel filters terminal rows out entirely
  (`HIDDEN_STATUSES` == exactly the terminal statuses), so it gives no new live surface for that
  combination.

## User Setup Required

None.

## Next Phase Readiness

- Plan 06 (`fields-panel.tsx` / `entities-list.tsx` — `getStatusBadge`'s two callers, whose own
  redesign this plan explicitly deferred) inherits a `getStatusBadge` that already returns the
  correct tier vocabulary, so those panels need layout/hierarchy work, not tier work.
- **Reach for `REGION_TIER[tier].badge`/`.swatch` when stating a tier in chrome and `.chip` only
  for the document's own words.** This is the single easiest mistake to make on this surface:
  `chip` looks like the obvious "tier colour" export, but it drags `pmark`'s serif with it, and a
  className-based law-2 gate cannot see the resulting violation.
- The pattern for a shape gate on a restructured surface is now established twice (inbox, here):
  freeze **before** editing, share the fixture *and* the render, and prove the gate RED against
  the specific regression it exists to catch.

---
*Phase: 60-surface-redesign-inbox-email-detail*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: apps/web/src/app/emails/[id]/_components/__tests__/__baselines__/extraction-summary-pre-60.json
- FOUND: apps/web/src/app/emails/[id]/_components/__tests__/capture-extraction-baseline.test.tsx
- FOUND: apps/web/src/app/emails/[id]/_components/__tests__/extraction-summary-structure.test.tsx
- FOUND: apps/web/src/app/emails/[id]/_components/__tests__/support/extraction-fixture.ts
- FOUND: apps/web/src/app/emails/[id]/_components/__tests__/support/render-extraction-panel.tsx
- FOUND: commit a8dfb5b (Task 1 Step 1 — the freeze)
- FOUND: commit 1e4a6d3 (Task 1 Step 2 — the rebuild)
- FOUND: commit 81a60d1 (Task 2)
- FOUND: commit da6892c (Task 3)
- VERIFIED ORDER: `git log --reverse a8dfb5b~1..da6892c` confirms the baseline freeze (`a8dfb5b`)
  precedes the component rewrite (`1e4a6d3`) — the Task 3 gate is therefore non-vacuous.
