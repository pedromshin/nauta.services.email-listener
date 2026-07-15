---
phase: 60-surface-redesign-inbox-email-detail
plan: 06
subsystem: ui
tags: [law-1, law-2, law-3, role-as-hue, destructive-disposition, source-gate, ratchet, negative-proof, detail-frame]

# Dependency graph
requires:
  - phase: 60-04
    provides: region-vocabulary.ts (tierOf/REGION_TIER/REGION_ROLE_GEOMETRY/regionLabelFor) — the lookup surface four more panels now resolve against
  - phase: 60-05
    provides: REGION_TIER.badge/.swatch (the SANS chrome treatment) and getStatusBadge-through-tierOf — both consumed here; the badge-vs-chip finding directly shaped this plan's execution
  - phase: 59
    provides: the realized token ladder (ink/faded/pencil/rule/hair/shade/bright/conf/sugg/bad) + palette-ban.test.ts's walk idiom
  - phase: 58-visual-identity-sketch-pick-human-gate
    provides: D-58-01 (LOCKED) — the three laws; direction-final.html's .rp-head/.rp-meta as the header reference
provides:
  - role-hue-ban.test.ts — the committed, SCOPED, RATCHETING law-1/law-3 source gate for Phase 60's two surfaces, with an exported SCOPED_DIRS that Phases 61-63 extend
  - REGION_ROLE_SWATCH — the chrome miniature of a role's real box geometry, composed from REGION_ROLE_GEOMETRY (law 3 applied to chrome)
  - REGION_ROLE_LABEL — one role-label map, replacing two divergent copies
  - the email-detail frame on the identity: a serif data-evidence subject, an ink error, skeletons that predict the real frame
affects: [61-total-ui-re-skin-part-2, 62-total-ui-re-skin-part-3, 63-research-canvas-visual-surfaces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A source gate is SCOPED + EXPORTED + ASSERTED-ON so it becomes a ratchet: the banned area only ever grows, and narrowing it is a visible test-breaking act rather than a one-word diff. A global ban on a token that is still legitimately in use elsewhere is red on arrival and gets allowlisted into meaninglessness."
    - "A gate must assert its own scope is non-vacuous (roots exist AND walk to >0 files) — a gate that inspects nothing passes everything."
    - "The madder rule encoded as a proxy: a destructive FILL/VARIANT is an action (allowed); destructive TEXT/BORDER is a state talking (banned). Documented in the gate as a proxy, NOT a proof, with its blind spot named in both directions — and a real instance of that blind spot was found by reading, not by grep."
    - "A role stated in chrome renders the MINIATURE of its real on-document geometry, not a colour key — the picker then teaches the document's own vocabulary instead of a parallel one that dies in greyscale."

key-files:
  created:
    - apps/web/src/app/__tests__/role-hue-ban.test.ts
  modified:
    - apps/web/src/app/emails/[id]/_components/region-vocabulary.ts
    - apps/web/src/app/emails/[id]/_components/role-picker.tsx
    - apps/web/src/app/emails/[id]/_components/active-parent-banner.tsx
    - apps/web/src/app/emails/[id]/_components/inspector-panel.tsx
    - apps/web/src/app/emails/[id]/_components/fields-panel.tsx
    - apps/web/src/app/emails/[id]/_components/email-detail.tsx
    - apps/web/src/app/_components/forwarding-address-card.tsx
    - apps/web/src/app/emails/[id]/_components/attachments-card.tsx
    - apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx
    - apps/web/src/app/emails/[id]/_components/metadata-card.tsx

key-decisions:
  - "`parseStatus` is NOT routed through REGION_TIER, against the plan's first-choice instruction ('parsed is a quiet confirmed-tier marker ... route it through REGION_TIER if it maps cleanly'). It does not map cleanly, two ways: (a) tierOf('parsed') returns 'suggested' — its deliberate unknown-status default — so the tier vocabulary would paint a SUCCEEDED parse pencil-amber; (b) verdigris means exactly one thing, 'a human verified this fact', and a parse succeeding is a MACHINE fact nobody confirmed. Spending the confirmed hue on it would make verdigris mean two things, which is the one thing law 1 cannot survive. Took the plan's own escape hatch ('otherwise a plain text-faded marker'). parseStatus is a different DOMAIN from extractionStatus — the fact that both are called 'status' is the trap."
  - "The active-parent banner renders NO tier badge. The plan makes it conditional ('may appear ... if the banner has the status to hand; if it does not, do not fetch it') and the component is handed a label and a callback, nothing else. Wiring it would need a new prop plus promoting TIER_WORD/TierBadge out of a Plan-05 file — a refactor chain for an explicitly optional element on a MODE indicator whose job is 'next drawn boxes become fields', not adjudicating tier. The armed entity's tier is already stated by its box, its Layers row, and the extraction registry, all three in view. Where this plan DOES state a tier in chrome (fields-panel's Confirmed badge) it uses 60-05's `badge`/`swatch`, never `chip` — the carry-forward correction applied."
  - "The gate's scope was designed as a RATCHET rather than a cleanup: SCOPED_DIRS is exported, documented, and pinned by a test. graph-* remains legitimately in use across knowledge/, entities/ and chat/ (10 files, 62 occurrences at plan time) which Phases 61-63 own — a global ban would have been RED on arrival, and a gate that is red on arrival gets deleted or allowlisted into meaninglessness within a week. Each of 61-63 appends its root as it sweeps; the pinning test means shrinking the scope to make a violation pass breaks a test instead of passing silently."
  - "The madder ban is TEXT+BORDER only, and the gate says out loud that this is a proxy, not a proof. It cannot read intent. Its blind spot was not hypothetical: pdf-preview-pane.tsx rendered `<Badge variant=\"destructive\">Preview failed</Badge>` — a STATUS talking through the door the gate deliberately leaves open for genuine reject/deny buttons. Found by reading, not by grep, and fixed. Recorded in the gate's own comment as the named counterexample so no one mistakes the gate for the law."
  - "metadata-card.tsx (UNREFERENCED dead code) had its `parseStatusVariant` prop type narrowed rather than left alone. It carried the exact signature Task 2 deleted — madder-for-failed and all — so reviving the component would have revived the violation. Type narrowed, file NOT deleted: deletion is a call for a phase that owns the surface. Direct precedent: 60-05's status-badge.ts return-type fix."

patterns-established:
  - "When a comment inside a gated root cites a banned literal, the gate goes RED on its own documentation — it reads LINES, not prose. Describe retired tokens ('the retired entity node-TYPE hue'), never name them. 60-05 flagged this hazard for Plans 06+; it fired four times here and cost a rework each time."
  - "A scoped gate's pattern must require the colour-utility PREFIX, not the bare family name: the walk covers the __tests__ dirs inside the scoped roots, where sibling gates legitimately assert on the banned family by name. Prefix-matching is what stops a gate from executing its own siblings."

requirements-completed: [SURF-04]

# Metrics
duration: ~65min
completed: 2026-07-15
---

# Phase 60 Plan 06: The Sweep Becomes Permanent Summary

**Finished Phase 60's law-1 sweep — the role picker stopped teaching a colour key and started showing the actual box geometry the user will meet on the page, the detail header now reads the subject as the document's own words in serif, a failed email load is ink on a rule instead of madder — and then made it permanent with `role-hue-ban.test.ts`: a SCOPED, exported, ratcheting source gate whose blind spot is documented rather than hidden, proven RED twice and deliberately GREEN once.**

## Performance

- **Duration:** ~65 min
- **Completed:** 2026-07-15
- **Tasks:** 3 (4 commits)
- **Files:** 11 (1 created, 10 modified)

## Task Commits

1. **Task 1 — four role-coding panels onto the vocabulary** — `7417a59` (feat)
2. **Task 2 — the detail frame: a serif subject, an error that isn't madder** — `a4997d1` (feat)
3. **Task 3a — the madder-on-a-state uses the plan's survey missed** — `e9ddf76` (fix)
4. **Task 3b — role-hue-ban, the sweep becomes permanent** — `53afd82` (test)

Task 3 is two commits on purpose: the gate cannot be committed green while
violations remain, so the sweep that makes it green lands first and separately.
That ordering is also the honest one — it shows the gate's green as *earned*,
not as an artifact of the same commit that wrote it.

## THE THREE NEGATIVE PROOFS (verbatim)

All three run against the committed gate. Two RED, one GREEN **on purpose**.

### Proof 1 — a role hue reintroduced into `region-overlay-box.tsx` → MUST go RED

`const hoverClass = " hover:border-ink bg-graph-entity/10";`

```
 ❯ src/app/__tests__/role-hue-ban.test.ts (5 tests | 1 failed) 33ms
   × role-hue-ban (SURF-04 — law 1 + law 3 on Phase 60's surfaces) > bans role-as-hue: no retired node-type colour utility on either Phase-60 surface (law 3) 16ms
     → Found 1 role-as-hue violation(s) on a swept Phase-60 surface:
  emails/[id]/_components/region-overlay-box.tsx:173 -> "bg-graph-entity"
Law 3: entity type and region role are carried by SHAPE, never by hue — they must survive greyscale. Take role from REGION_ROLE_GEOMETRY/REGION_ROLE_SWATCH and tier from REGION_TIER via tierOf (region-vocabulary.ts). These tokens remain valid on the canvas/knowledge surfaces, which Phases 61-63 have not swept yet — but not here.

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
```

**RED**, naming the exact file and line. Reverted.

### Proof 2 — madder text reintroduced into `email-detail.tsx`'s error branch → MUST go RED

`<p className="text-sm font-semibold text-destructive">Failed to load email</p>`

```
 ❯ src/app/__tests__/role-hue-ban.test.ts (5 tests | 1 failed) 39ms
   × role-hue-ban (SURF-04 — law 1 + law 3 on Phase 60's surfaces) > bans madder on a state: no madder text or border on either Phase-60 surface (law 1) 15ms
     → Found 1 madder-on-a-state violation(s) on a swept Phase-60 surface:
  emails/[id]/_components/email-detail.tsx:377 -> "text-destructive"
Law 1: madder means "irreversible — this cannot be undone". Never errors, never warnings, never statuses. An error is ink on a rule; a warning is ink weight; an uncertain read is pencil. If this IS an irreversible control, build it as a fill (the madder variant and the madder background are allowed, and are how the deny and reject buttons on this surface are already built) rather than allowlisting it.

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
```

**RED.** Reverted.

### Proof 3 — a `variant="destructive"` button added to `role-picker.tsx` → MUST stay GREEN

```tsx
<Button type="button" variant="destructive" size="sm">
  Delete region forever
</Button>
```

```
 ✓ src/app/__tests__/role-hue-ban.test.ts (5 tests) 27ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

**GREEN — the point of the exercise.** The gate distinguishes an *irreversible
action* from a *state*, rather than crudely banning a token. Had this gone red,
the gate would have been forcing the deny/reject buttons — the one place law 1
genuinely earns madder — to be allowlisted, which is how a gate teaches people
to ignore it. Reverted.

### Residue check

```
$ git diff --stat a4997d1 -- region-overlay-box.tsx email-detail.tsx role-picker.tsx
(empty)
```

Empty against the **Task 2 commit** for all three proof-target files — none of
which were touched by the Task 3a sweep, so `a4997d1` is the correct
comparison point for each. Full suite re-run green afterwards (72 files, 806
passed).

## The `destructive` disposition (§D), judged occurrence by occurrence

§D: **madder is CORRECT on a control that performs an irreversible action; WRONG
on an error, a status, or a warning.** Not blanket-removed — each judged alone.
The plan's §B listed 4 occurrences; the file-by-file survey found **12**.

| # | Occurrence | Verdict | Why |
|---|---|---|---|
| 1 | `email-detail.tsx:49` — `parseStatusVariant`, `"failed"` → madder | **REMOVED** | A STATUS, and the most reversible thing on the page: the same header renders the Reprocess button that undoes it. §D names this one by name. |
| 2 | `inspector-panel.tsx:290` — low-confidence % | **REMOVED** | A WARNING. It told the user an uncertain *guess* was a *dangerous* one; it is neither — it is a machine read a human is about to confirm or correct, which is this panel's whole job. Now ink WEIGHT vs `text-pencil` (the ladder's own word for "uncertain"). |
| 3 | `fields-panel.tsx:133` — required `*` (confirmed phase) | **REMOVED** | A form RULE, stated before anything has gone wrong. Nothing is failing. `aria-label` already carried "required", so meaning never depended on hue. |
| 4 | `fields-panel.tsx:214` — required `*` (reviewing phase) | **REMOVED** | Same marker, same verdict. |
| 5 | `fields-panel.tsx:146` — field confidence < 0.5 (confirmed) | **REMOVED** | A WARNING. Same as #2. |
| 6 | `fields-panel.tsx:233` — field confidence < 0.5 (reviewing) | **REMOVED** | Same. |
| 7 | `forwarding-address-card.tsx:72` — failed load message | **REMOVED** | An ERROR. *Not in the plan's §B* — found by survey; blocked the gate from going green. |
| 8 | `attachments-card.tsx:134` — attachment fetch error | **REMOVED** | An ERROR, and retryable. *Not in §B.* |
| 9 | `pdf-preview-pane.tsx:455` — `<Badge variant="destructive">Preview failed</Badge>` | **REMOVED** | A STATUS, and reversible — the button directly below opens the file that failed to preview. *Not in §B.* **The gate does NOT catch this one** — see "the proxy's blind spot" below. |
| 10 | `metadata-card.tsx:23` — `"destructive"` in a prop type union | **REMOVED** | Dead-code landmine: an UNREFERENCED component carrying the exact `parseStatusVariant` signature Task 2 deleted. Reviving the component would revive the violation. Type narrowed; file not deleted. Precedent: 60-05's `status-badge.ts` return type. |
| 11 | `action-toolbar.tsx:194` — **Reject Region** button | **KEPT** | An irreversible ACTION. Exactly what law 1 earns madder for. |
| 12 | `reject-dialog.tsx:46` — the Reject **confirm** action | **KEPT** | Same: the confirm step of an irreversible action. |

Plus the two 60-05 already adjudicated and this plan did not revisit:
`confirm-deny-controls.tsx:82` and `layers-tree-row.tsx:201` (the deny buttons)
— both **KEPT**, both built as a madder FILL + its paired foreground, which is
precisely the shape the gate's rule protects.

**Calibration check:** 60-05 kept 2 and removed 1. This plan kept 2 and removed
10 — a much wider sweep, because it met the four editor panels where the
status/warning uses had accumulated. The kept:removed ratio is not the signal;
the discriminator is, and it held: *every* kept one is a button that performs an
action, *every* removed one is a state describing itself.

### The proxy's blind spot, found live

`pdf-preview-pane.tsx`'s "Preview failed" badge passed the gate and still
violated law 1 — it used `variant="destructive"`, which the gate **allows on
purpose** so genuine deny/reject buttons need no allowlist. A status talked
through the door left open for actions.

This is exactly what "the closest a source-level gate can get" means, and it is
recorded in the gate's own comment as a named counterexample rather than left as
a comfortable claim. A human read that line; grep could not. **Phases 61-63:
the gate makes the cheap regression expensive — it does not replace the read.**

## `region-vocabulary.ts` additions

Both are lookups from closed maps keyed by the `RegionRole` union (T-60-02), and
both exist because two files needed the same treatment — the "fifth local role
map" the plan warns is how this debt accumulated in the first place.

| Export | Why |
|---|---|
| `REGION_ROLE_LABEL` | `role-picker.tsx` and `inspector-panel.tsx` each carried a private copy of the same role→word map. Same one-mapping-not-two hazard T-60-08 names for tier: two maps of one fact drift, and the drift reads as the picker and the inspector disagreeing about what the user just clicked. Includes `none: "Unclassified"` for the inspector's roleless region. |
| `REGION_ROLE_SWATCH` | The chrome miniature of a role's real box geometry, composed **from `REGION_ROLE_GEOMETRY` at module load**, so it cannot drift from the boxes it advertises. Base is `border-ink` — a swatch in a picker has no tier to claim, and tier colour belongs only to a box with a real extraction status behind it. |

`REGION_TIER` was **not** extended — 60-05's `badge`/`swatch` already covered the
one place this plan states a tier in chrome.

**The carry-forward applied:** the plan told `active-parent-banner.tsx` to show a
tier badge "via `REGION_TIER[tier].chip`". `chip` is `pmark`, and `pmark` sets
`font-family: var(--font-serif)` — serif on chrome, smuggled *past* the
class-string-reading gates. Wherever this plan states a tier in chrome
(`fields-panel.tsx`'s Confirmed badge) it uses `badge` + `swatch`. The banner
renders no tier badge at all (see key-decisions).

## Accomplishments

- **`role-picker.tsx` — the most literal role-as-hue on the surface is gone.**
  It painted a coloured swatch per role: a colour key that existed *nowhere on
  the document*, died in greyscale (law 3), and spent hue on chrome (law 1).
  Each option now carries a **miniature of the real box treatment** — entity is
  the `border-2` square, field the 1px square, unrelated the dotted faded one.
  Strictly better than a legend: the picker teaches the document's own
  vocabulary instead of a parallel one. Selected state is ink (`bg-shade
  border-ink`), per law 1's "selected states carry NO hue". Option `value`s and
  order are untouched — they are mutation wiring, not presentation (T-60-08).
- **`active-parent-banner.tsx`** — an armed parent is a MODE, so it reads as a
  well pressed into the page (`bg-shade` + `border-rule` + `text-ink`), not an
  entity-tinted wash. `onClear`, `role="status"`, `aria-live`, and the exact
  Copywriting Contract string preserved.
- **`inspector-panel.tsx`** — the three-hue role map deleted; role now states
  itself with the same swatch the picker uses, over a hue-free chrome fill, with
  tier stated separately through `tierOf`. The candidate and confirmed values
  render as `font-serif` + `tabular` + `data-evidence` — **even inside an
  `<Input>`**: provenance is about where the text came from, not which element
  it lives in. No `onSet*` handler's arguments touched.
- **`fields-panel.tsx`** — verified it consumes `getStatusBadge`'s new return
  shape with **no local tier re-derivation** (T-60-08: one mapping, not two);
  it passes `variant` straight through, so 60-05's narrowing needed no change
  here. Its extracted values became serif evidence and its labels quiet sans —
  the same law-2 inversion 60-05 fixed one panel over.
- **`email-detail.tsx`** — the h1 is the user's own mail: `font-serif text-xl
  text-ink data-evidence`, mirroring the reference's `.rp-head` (serif, 19px,
  600). `h1Ref`/`tabIndex={-1}`/`outline-none`/mount-focus all intact — it is
  the page's a11y entry point. The status marker adopts the inbox header's
  `.count` shape so the two surfaces state a small fact identically. Error and
  not-found are ink on a `border-rule` frame with `role="alert"` kept and copy
  **generic and un-enriched** (T-60-10). Skeletons now predict the real frame —
  a header bar, then the canvas zone — instead of three `h-28 rounded-xl` slabs
  that resembled nothing which ever arrives; `aria-busy`/`aria-label` kept.
- **§C honoured exactly.** Verified against the diff, not by assertion: no
  hunk touches anything between the derivations and the return. `useCanvasState`,
  `useRoleMutations`, `useAutofillFields`, `getCandidateValue`,
  `isAutoDetectedOrigin`, the signed-URL cache, `layersComponents`,
  `parentOptions`, `candidateFieldIds`, `handleSelectRow`, `handleRectDrawn`,
  `handleConfirmSplit` and the mount-focus effect — **none appear in the diff**.
- **The gate.** 5 tests: the two bans, the SCOPED_DIRS pin, a non-vacuity
  assertion (every root exists AND walks to >0 files — 51 files today), and the
  `dev/**` exclusion. Empty allowlist documenting that an entry is an amendment
  to D-58-01 (LOCKED), not a preference.

## The SCOPED_DIRS ratchet — for Phases 61-63

`SCOPED_DIRS = ["_components", "emails/[id]"]`, resolved against
`apps/web/src/app`, exported and pinned by a test.

**Why scoped and not global.** `graph-*` is not dead: still registered in
`globals.css`, still autocompletes, and still legitimately in use across
`knowledge/` (3 files), `entities/` (2), and `chat/` (2) — **62 occurrences in
10 files** at plan time. A global ban would have been RED on arrival, and a gate
that is red on arrival is deleted or allowlisted into meaninglessness within a
week.

**How to extend it.** When your phase sweeps its surface, **append your root**:

```ts
export const SCOPED_DIRS: readonly string[] = [
  "_components",
  "emails/[id]",
  "knowledge",   // ← Phase 61/63, when swept
];
```

The banned area only ever grows. The pinning test means **narrowing** the scope
to make a violation pass breaks a test and forces the conversation, instead of
passing as a one-word diff nobody reviews.

**Two traps that will cost you a rework if you do not know them:**

1. **The gate reads LINES, not prose.** A comment citing a banned literal turns
   the gate RED on its own documentation. It fired **four times** in this plan.
   Describe retired tokens ("the retired entity node-TYPE hue"), never name
   them. 60-05 flagged this for Plans 06+; it is real.
2. **The pattern requires a colour-utility PREFIX, and must keep doing so.** The
   walk covers the `__tests__` dirs *inside* the scoped roots, where
   `region-vocabulary.test.ts`, `region-overlay-law.test.tsx` and
   `extraction-summary-structure.test.tsx` legitimately assert on the banned
   family **by name**. They survive only because a bare mention is not matched.
   Widen the pattern to a bare family match and **this gate will execute its own
   siblings.**

Note also: this gate's own file sits *outside* `SCOPED_DIRS`, so — unlike
`palette-ban.test.ts` — it does not currently walk itself. That immunity is an
accident of location, not a design guarantee; patterns are still assembled from
parts, and should stay that way as the scope grows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical work] The plan's §B destructive survey was incomplete (4 listed, 12 found)**
- **Found during:** Task 3, surveying the scoped roots before writing the gate
- **Issue:** `forwarding-address-card.tsx:72`, `attachments-card.tsx:134`,
  `pdf-preview-pane.tsx:455` and `metadata-card.tsx:23` all carried madder on a
  state. The gate is the plan's deliverable and **cannot be committed green**
  with them live — an un-green gate is not a gate.
- **Fix:** All four judged by §D and fixed; committed separately (`e9ddf76`)
  *before* the gate, so the gate's green is earned rather than co-committed.
- **Verification:** `grep -rn "text-destructive\|border-destructive"` across both
  scoped roots (excluding `-foreground`) → **none**. The four legitimate madder
  uses survive.

**2. [Rule 1 - Plan instruction is wrong on the facts] `parseStatus` is not a `REGION_TIER` tier**
- **Found during:** Task 2
- **Issue:** The plan's first choice — "parsed is a quiet confirmed-tier marker
  ... route it through `REGION_TIER` if it maps cleanly" — does not hold.
  `tierOf("parsed")` returns **"suggested"** (its deliberate unknown-status
  default), so routing would paint a *succeeded* parse pencil-amber. And
  verdigris means precisely "a human verified this fact"; a parse succeeding is
  a machine fact nobody confirmed, so spending the confirmed hue on it would
  make verdigris mean two things — the one thing law 1 cannot survive.
- **Fix:** Took the plan's own escape hatch ("otherwise a plain `text-faded`
  marker"). `parseStatus` and `extractionStatus` are different domains; that
  both are called "status" is the trap.

**3. [Rule 1 - Self-invalidating documentation] Four comments cited banned literals**
- **Found during:** Task 1 (three) and Task 3 (one)
- **Issue:** The exact hazard 60-05's summary flagged for Plans 06+. My own
  file-header comments explaining *what was removed* named the retired classes,
  which (a) failed Task 1's verify grep and (b) would have turned the new gate
  RED on its own documentation.
- **Fix:** Rephrased to describe rather than name ("the retired entity node-TYPE
  hue"), with an in-file note explaining why — and noting the trade is correct:
  a commented-out violation is one paste from live.
- **Verification:** `grep -c "graph-"` on all four Task-1 files → **0**, comments
  included. `grep -c "destructive"` on `email-detail.tsx` → **0**.

**4. [Rule 2 - Landmine] `metadata-card.tsx` is dead code carrying the killed signature**
- **Found during:** Task 3 survey
- **Issue:** Unreferenced by anything, yet still declaring
  `parseStatusVariant: (status) => "default" | "secondary" | "destructive"` —
  the exact function Task 2 deleted. Reviving the component revives the bug.
- **Fix:** Prop type narrowed (safe: `Badge`'s own union is wider). File **not**
  deleted — that is a call for a phase that owns the surface, and this plan is a
  law-1 sweep. Flagged below for whoever does.

### Judgement calls (not deviations, but worth naming)

**5. The active-parent banner renders no tier badge** — the plan's "may ... if
the banner has the status to hand" resolved to *no*. Reasoning in key-decisions.

**6. `fields-panel.tsx`'s Confirmed badge went through the vocabulary** — it
hardcoded `bg-primary text-primary-foreground`. Since `--primary` aliases to
`--ink`, it was not a *hue* violation; but a badge whose word **is** "Confirmed"
stating that claim in chrome ink, while every other surface states it in
verdigris through `tierOf`, is the same divergent-second-mapping problem 60-05
fixed in `status-badge.ts`. Routed through `REGION_TIER.confirmed.badge` +
`swatch` — one lookup, four surfaces, no drift.

## Known Stubs

None.

## Threat Flags

None. Rendering-only: no new network endpoint, auth path, file access pattern,
or schema change.

- **T-60-02** (XSS): the subject remains a plain React text node in the `h1`; no
  `dangerouslySetInnerHTML`; nothing attacker-authored is interpolated into a
  class or a style. Every class added is a lookup from a closed map keyed by a
  narrowed union.
- **T-60-08** (Repudiation): no mutation's identity or arguments changed.
  `RolePicker`'s option `value`s and order, every `onSet*`/`onConfirm*` handler,
  and `fields-panel`'s `onConfirm`/`onDiscard` are untouched; `REGION_ROLE_LABEL`
  removed a *second* copy of a mapping rather than adding one.
- **T-60-10** (Info disclosure): the error and not-found branches were restyled,
  **not enriched** — copy is unchanged and the underlying error object is not
  interpolated. `role="alert"` retained.

## Verification

```
cd apps/web && npx tsc --noEmit                        -> clean
cd apps/web && npx vitest run                          -> 72 files, 806 passed, 2 skipped
cd apps/web && npx vitest run .../role-hue-ban.test.ts -> 5/5 passed
cd apps/web && npm run build:local                     -> succeeds (/emails/[id] 125 kB)
Task 1 grep gate (graph- across the four, comments excluded) -> 0 (and 0 including comments)
Task 2 grep gate (destructive|parseStatusVariant)            -> 0 (and 0 including comments)
Task 2 greps: font-serif / role="alert" / h1Ref present      -> all present
§C diff check (no hook/derivation/handler name in the diff)  -> none
```

Suite moved **71 files / 801 passed** (60-05's close) → **72 / 806**: exactly the
one file and five tests this plan adds.

## Issues Encountered

- **Pre-existing, explicitly not this plan's** (named per the brief, neither
  surfaced by `apps/web`'s suite): the `packages/genui` `artifacts.test.ts` hash
  drift (different package, never collected here) and the sidebar
  pointer-events E2E bug (backlog 999.21 — no browser test was run; per the
  brief, Playwright would corrupt the running dev server's `.next`, and this
  plan needs no browser).
- **`npm run build -w @polytoken/web` fails on missing env** — pre-existing and
  expected; `npm run build:local` is the correct script and succeeds.
- **60-04's Deviation 4 (terminal+field opacity nuance) remains open.** Not
  touched; still a visual-QA item.

## User Setup Required

None.

## Next Phase Readiness

- **The ratchet is the handoff.** Append your root to `SCOPED_DIRS` as you
  sweep; read the two traps above first (line-reading comments; prefix-matching)
  — each cost a rework here.
- **The gate is a floor, not a ceiling.** Its madder rule is a proxy that cannot
  read intent, and its blind spot is not theoretical — a status badge slipped
  through the allowed `variant` door on this very surface. Read the diffs.
- **`REGION_ROLE_SWATCH`/`REGION_ROLE_LABEL` are ready for reuse** by any surface
  that must state a role in chrome. Reach for `REGION_TIER[tier].badge`/`.swatch`
  to state a tier in chrome and `.chip` **only** for the document's own words —
  60-05's warning stands and this plan re-confirmed it: `chip` looks like the
  obvious "tier colour" export but drags `pmark`'s serif onto chrome, where a
  className-based law-2 gate structurally cannot see it.
- **`metadata-card.tsx` is unreferenced dead code.** Its landmine is defused, but
  the file is still there. A phase that owns the detail surface should decide
  whether it is deleted or revived.
- **Phase 60's two surfaces are now fully swept** and enforced. `graph-*` lives on
  in `knowledge/`, `entities/`, and `chat/` — 62 occurrences, 10 files, all
  Phases 61-63's.

---
*Phase: 60-surface-redesign-inbox-email-detail*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: apps/web/src/app/__tests__/role-hue-ban.test.ts (contains `SCOPED_DIRS`)
- FOUND: apps/web/src/app/emails/[id]/_components/region-vocabulary.ts
- FOUND: apps/web/src/app/emails/[id]/_components/role-picker.tsx
- FOUND: apps/web/src/app/emails/[id]/_components/active-parent-banner.tsx
- FOUND: apps/web/src/app/emails/[id]/_components/inspector-panel.tsx
- FOUND: apps/web/src/app/emails/[id]/_components/fields-panel.tsx
- FOUND: apps/web/src/app/emails/[id]/_components/email-detail.tsx
- FOUND: apps/web/src/app/_components/forwarding-address-card.tsx
- FOUND: apps/web/src/app/emails/[id]/_components/attachments-card.tsx
- FOUND: apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx
- FOUND: apps/web/src/app/emails/[id]/_components/metadata-card.tsx
- FOUND: commit 7417a59 (Task 1 — the four panels)
- FOUND: commit a4997d1 (Task 2 — the detail frame)
- FOUND: commit e9ddf76 (Task 3a — the completion sweep)
- FOUND: commit 53afd82 (Task 3b — the gate)
- VERIFIED ORDER: `git log --reverse 7417a59~1..53afd82` confirms the sweep
  (`e9ddf76`) precedes the gate (`53afd82`) — the gate's green is earned, not
  co-committed with the fixes that produce it.
- VERIFIED NON-VACUOUS: the gate walks 51 files across both scoped roots, and
  asserts that count is > 0 for each root on every run.
