---
phase: 61-surface-redesign-chat-canvas-mobile-panel-chrome
plan: 02
subsystem: design-system
tags: [vocabulary, tier, canvas, law-1, law-3, SURF-02]
requires:
  - "apps/web/src/app/emails/[id]/_components/region-vocabulary.ts (Phase 60 — the module promoted FROM)"
  - "58-IDENTITY.md D-58-01 (laws 1/2/3, LOCKED)"
  - "sketches/direction-final.html (.e-neutral/.e-conf/.e-sugg/.card)"
provides:
  - "apps/web/src/app/_vocabulary/tier.ts — THE tier truth: Tier, tierOf, TIER_HUE_FAMILY, TIER_IS_DASHED"
  - "apps/web/src/app/chat/_canvas/canvas-vocabulary.ts — CANVAS_EDGE_TIER, CanvasNodeKind, canvasNodeKindOf, CANVAS_NODE_KIND_GEOMETRY, CANVAS_NODE_KIND_LABEL"
  - "the edge-tier x node-kind matrix gate (53 tests)"
affects:
  - "61-04 (edges/background/controls wiring), 61-05 (node shells), 62 (/knowledge tier edges), 63 (provenance edges)"
tech-stack:
  added: []
  patterns:
    - "shared module holds FACTS; each surface holds LITERAL classes; a gate asserts agreement"
    - "null-prototype closed lookup for untrusted persisted keys"
key-files:
  created:
    - apps/web/src/app/_vocabulary/tier.ts
    - apps/web/src/app/_vocabulary/__tests__/tier.test.ts
    - apps/web/src/app/chat/_canvas/canvas-vocabulary.ts
    - apps/web/src/app/chat/_canvas/__tests__/canvas-vocabulary.test.ts
  modified:
    - apps/web/src/app/emails/[id]/_components/region-vocabulary.ts
decisions:
  - "D-61-02-A: tier truth promoted to app/_vocabulary/tier.ts and RE-EXPORTED from region-vocabulary.ts — Phase 60's surface compiles byte-unchanged"
  - "D-61-02-B: shared module holds facts (TIER_HUE_FAMILY/TIER_IS_DASHED), never class strings — Tailwind v4 purges composed classes silently"
  - "D-61-02-C: canvas node kind = left-rule WEIGHT (how much of the user's own material) + DOTTED (a view/guess), all ink"
  - "D-61-02-D: the `!` specificity override is NOT baked into CANVAS_EDGE_TIER — it belongs to the consumer's context (61-04)"
metrics:
  duration: ~35 min
  completed: 2026-07-15
  tasks: 3
  commits: 3
  tests_added: 68
---

# Phase 61 Plan 02: Canvas & Shared Tier Vocabulary Summary

Promoted the tier truth to `app/_vocabulary/tier.ts` (facts, never classes) and grew the canvas's
own `canvas-vocabulary.ts` from it — edges carry tier, nodes carry kind as geometry — behind a
53-test matrix gate that proves the two surfaces cannot drift apart on what a tier looks like.

## What Shipped

| Task | Commit | What |
|------|--------|------|
| 1 | `6e1ad9e` | `_vocabulary/tier.ts` + 15 tests; `region-vocabulary.ts` re-exports |
| 2 | `79b5ea6` | `canvas-vocabulary.ts` + 17 tests |
| 3 | `1a81b32` | matrix gate extension (+36 tests → 53 in file) |

## Per-File Changes

**`apps/web/src/app/_vocabulary/tier.ts` (NEW, 112 lines)** — the shared truth. `tierOf`'s body moved
VERBATIM including its T-60-08 comment. Exports exactly three values (pinned by a test):

```ts
export type Tier = "confirmed" | "suggested" | "terminal";

export function tierOf(status: string): Tier {
  if (status === "confirmed") return "confirmed";
  if (status === "rejected" || status === "superseded") return "terminal";
  return "suggested";
}

export const TIER_HUE_FAMILY: Record<Tier, "conf" | "sugg" | null> = {
  confirmed: "conf",
  suggested: "sugg",
  terminal: null,      // no tier claim, so no colour is earned (law 1)
};

export const TIER_IS_DASHED: Record<Tier, boolean> = {
  confirmed: false,    // solid mark = confirmed
  suggested: true,     // dashed mark = suggested
  terminal: true,
};
```

**`apps/web/src/app/emails/[id]/_components/region-vocabulary.ts` (MODIFIED, +26/-17)** — the only
file touched on Phase 60's surface. `tierOf`'s body and the `RegionTier` union were replaced by:

```ts
import { tierOf, type Tier } from "../../../_vocabulary/tier";
export type RegionTier = Tier;
export { tierOf };
```

`REGION_TIER`, `REGION_ROLE_*` and `regionLabelFor` stayed put — they are this surface's own literals.

**`apps/web/src/app/chat/_canvas/canvas-vocabulary.ts` (NEW, 200 lines)** — exported maps VERBATIM
(61-04/61-05 wire six components onto these; Phase 62 moves `/knowledge`'s edges here):

```ts
export type CanvasEdgeTier = "neutral" | "confirmed" | "suggested";

export const CANVAS_EDGE_TIER: Record<CanvasEdgeTier, { path: string; joint: string }> = {
  neutral: {
    path: "[stroke:var(--edge)] [stroke-width:1.5] fill-none",
    joint: "[fill:var(--edge)]",
  },
  confirmed: {
    path: "stroke-conf-line [stroke-width:1.5] fill-none",
    joint: "fill-conf-line",
  },
  suggested: {
    path: "stroke-sugg-line [stroke-width:1.5] [stroke-dasharray:4_4] fill-none",
    joint: "fill-sugg-line",
  },
};

export type CanvasNodeKind =
  | "chat" | "genui-panel" | "email-thread" | "knowledge-preview" | "unknown";

export function canvasNodeKindOf(type: string): CanvasNodeKind;  // miss -> "unknown"

export const CANVAS_NODE_KIND_GEOMETRY: Record<CanvasNodeKind, string> = {
  chat: "border-l-4 border-l-ink",
  "email-thread": "border-l-2 border-l-ink",
  "genui-panel": "border-l border-l-ink",
  "knowledge-preview": "border-l-2 border-l-ink border-dotted",
  unknown: "border-dotted",
};

export const CANVAS_NODE_KIND_LABEL: Record<CanvasNodeKind, string> = {
  chat: "Chat",
  "genui-panel": "Panel",
  "email-thread": "Email thread",
  "knowledge-preview": "Knowledge",
  unknown: "Unrecognized",
};
```

**The node-kind axis, stated so it can be extended rather than guessed at:**
- **Left-rule WEIGHT = how much of the user's own material the node carries.** chat (4) is the
  conversation itself — the anchor; email-thread (2) is mail the user received, real evidence in
  full; genui-panel (1) is polytoken's rendering, with no words of its own.
- **DOTTED = "a view or a guess, not an artifact in its own right."** knowledge-preview has real
  material (rule 2) but is a bounded, non-interactive *glance* at another surface; unknown claims
  nothing at all — no rule, provisional frame.
- Dotted, never dashed — tier owns solid-vs-dashed, the same concession `region-vocabulary.ts` makes
  with `unrelated`.

## Proof: Phase 60's Surface Compiles Byte-Unchanged

```
$ git diff --stat -- "src/app/emails/[id]"
 .../emails/[id]/_components/region-vocabulary.ts   | 43 +++++++++++++---------
 1 file changed, 26 insertions(+), 17 deletions(-)

$ git diff --stat -- "src/app/emails/[id]" | grep -v region-vocabulary.ts | grep -c "|"
0
```

Phase 60's two committed gates + `role-hue-ban.test.ts` pass **unmodified**:

```
✓ src/app/emails/[id]/_components/__tests__/region-vocabulary.test.ts   (17 tests)
✓ src/app/emails/[id]/_components/__tests__/region-overlay-law.test.tsx (38 tests)
✓ src/app/_vocabulary/__tests__/tier.test.ts                            (15 tests)
Test Files  7 passed (7)   Tests  89 passed | 1 skipped (90)
```

`role-hue-ban.test.ts`'s `SCOPED_DIRS` still walks `emails/[id]` to >0 files — the promotion removed
no files from the ratchet's scope. (Appending `chat/` to that ratchet belongs to 61-04/61-05, which
sweep the components; this plan touched no component.)

The strongest proof is a test, not a diff: **`expect(regionTierOf).toBe(tierOf)`** — reference
equality. A behavioural clone would pass a behaviour test; only a genuine re-export passes this.

## The Drift Test's Behaviour

Three gates make "one mapping, not two" executable:

1. **`REGION_TIER` agrees with the facts** (`tier.test.ts`) — for each tier, `box` contains
   `TIER_HUE_FAMILY`'s family (or neither `conf` nor `sugg` when null), and contains `border-dashed`
   exactly when `TIER_IS_DASHED` says.
2. **`CANVAS_EDGE_TIER` agrees with the facts** — same derivation, canvas idiom.
3. **The two surfaces agree with EACH OTHER** — compared *directly*, not each against the facts
   separately. A surface that agreed with the facts in a divergent idiom would slip past (2) alone.

**The idiom split is the whole reason facts travel and classes don't:** the email-detail box spells
dashed as `border-dashed` (a CSS box); a canvas edge spells the same fact as
`[stroke-dasharray:4_4]` (an SVG path). The class could never have travelled between them. The
boolean does.

The module also pins that it exports **zero class strings** — a scan over every export for a
colour-utility prefix (`bg-`/`text-`/`border-`/`stroke-`/…). `TIER_HUE_FAMILY`'s bare `"conf"`
deliberately does not match: the prefix requirement is what separates a *fact* from a *class*.

## Negative Proofs (all three executed, RED output verbatim, all reverted)

**1. A hue creeps onto kind** — `CANVAS_NODE_KIND_GEOMETRY["genui-panel"] = "border-l border-l-conf-line"`:

```
× CANVAS_NODE_KIND_GEOMETRY — kind is shape, never hue (law 3) > no kind's geometry names a tier or a retired node-type colour
× MATRIX ... > edge=neutral x kind=genui-panel: the tier reading and the kind reading do not interfere
  → kind genui-panel must state no tier: expected 'conf' to be null
× KIND IS NOT COLOUR ... > chat vs genui-panel: their set difference contains no tier or retired node-type token
  → kind-only class difference "border-l-conf-line" (between chat and genui-panel) must not carry a
    tier/retired token: expected 'border-l-conf-line' not to match /conf|sugg|graph-/
Tests  8 failed | 45 passed (53)
```

**2. Kind collapses into indistinguishability** (the Phase 59 failure, on the other surface) —
`["email-thread"]` made identical to `["knowledge-preview"]`:

```
× CANVAS_NODE_KIND_GEOMETRY ... > all five kinds are structurally DISTINCT — kind is re-encoded, not deleted
× KIND IS LEGIBLE ... > edge=neutral: chat / genui-panel / email-thread / knowledge-preview / unknown all render distinguishably
  → distinct kind treatments at edge=neutral: expected 4 to be 5 // Object.is equality
Tests  4 failed | 49 passed (53)
```

**3. The two surfaces drift apart** — `CANVAS_EDGE_TIER.confirmed` flipped to a `sugg` token:

```
× AGREEMENT — two surfaces, one answer to what a tier looks like > confirmed: the canvas edge and the region box name the SAME family
× CANVAS_EDGE_TIER ... > confirmed: hue and dash follow the SHARED facts, not a second opinion
  → confirmed.path must carry the conf family: expected 'stroke-sugg-line [stroke-width:1.5] f…' to contain 'conf'
× CANVAS_EDGE_TIER ... > confirmed: the joint dot matches its path's colour
  → confirmed.joint must carry the conf family: expected 'fill-sugg-line' to contain 'conf'
Tests  8 failed | 45 passed (53)
```

**4. No proof edit leaked** — `git diff --stat 79b5ea6 -- apps/web/src/app/chat/_canvas/canvas-vocabulary.ts`
is **empty**; the file is byte-identical to its Task 2 commit.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | **74 files / 874 passed**, 2 skipped (baseline 72/806 + my 15 + 53 = 874 exactly; zero regressions) |
| `npm run build:local` (from `apps/web`) | green |
| `npm run test:geometry` (61-01's gate) | 3 passed |
| Files changed | only the 5 in `files_modified`; no component touched |

**Tailwind purge check — the one that matters here, since §C's failure mode is silent.** Grepped the
built CSS for every literal:

```
.\[stroke-dasharray\:4_4\]{stroke-dasharray:4 4}     ← underscore correctly became a space
stroke:var(--edge)   fill:var(--edge)   stroke-width:1.5
stroke-conf-line   stroke-sugg-line   fill-conf-line   fill-sugg-line
border-l-ink   border-l-4   border-dotted
```

All emitted — **including classes no component consumes yet**, which confirms Tailwind's `@source`
scans a plain `.ts` file with no JSX. That is the empirical basis for the whole fact/literal split.
(My first grep reported `stroke-dasharray:4_4` "PURGED" — a false alarm from CSS class-name
escaping, not a real purge. Worth knowing: a naive grep for an arbitrary-value class in built CSS
will lie to you.)

## Deviations from Plan

**1. [Rule 2 — missing critical functionality] `canvasNodeKindOf` uses a null-prototype lookup.**
A plain object literal answers `canvasNodeKindOf("__proto__")`, `("constructor")` and `("toString")`
from the prototype chain rather than missing — so a persisted `node.type` of `"toString"` would
return a function, not `"unknown"`, defeating T-61-06 on a user-writable field. `node.type` comes
from `chat_canvas_layouts`. Fixed with `Object.create(null)` + `Object.freeze`; the hostile-input
test pins all three. *Commit `79b5ea6`.*

**2. [Rule 2] `canvasNodeKindOf` recognizes EXACTLY `NODE_TYPE_REGISTRY`'s keys — asserted.**
The plan did not ask for this, but it is the same "one mapping, not two" law the plan is built on:
register a fifth node type without growing this vocabulary and `canvasNodeKindOf` quietly answers
`"unknown"`, rendering the new node as a degraded placeholder frame forever. The test imports the
registry and compares key sets, so that drift is red here instead of a mystery on the canvas.

**3. [Judgement call — flagged, not silently taken] The `!` specificity override is NOT in the
vocabulary.** `chat-canvas.tsx:51` still imports `@xyflow/react/dist/style.css`, whose
`.react-flow__edge-path` sets its own stroke at single-class specificity — which is why today's
`DataEdge` needs `!stroke-primary` rather than `stroke-primary`. Baking `!` into `CANVAS_EDGE_TIER`
would make 61-04's "zero stock React Flow styling" decision for it and would be wrong on a
non-React-Flow consumer (a legend swatch). Omitting it risks 61-04 wiring the map and rendering a
stock grey wire *through a green suite*. I chose to omit and document loudly — the hazard is called
out in the module header where 61-04's author will actually be reading. **61-04: wire an edge and
look at it.**

## Findings for Later Phases

**`/knowledge`'s "tier" is a DIFFERENT axis — do not conflate them (Phase 62).** The plan says Phase
62 "moves `/knowledge`'s tier edges onto this map". `knowledge/_components/tier-edge-style.ts` keys
on `EXTRACTED` / `INFERRED` / `AMBIGUOUS` — knowledge-node-edge **trust** tiers on the
`--tier-extracted` / `--tier-inferred` token ladder (D-48-04). That is not `confirmed` / `suggested`
/ `terminal`, which are **extraction statuses**. Two things called "tier" that share not one value —
the same shape as the `parseStatus` ≠ `extractionStatus` trap 60-06 nearly shipped. `CANVAS_EDGE_TIER`
deliberately does **not** claim to cover them; Phase 62 must decide whether trust tier maps onto the
confirmed/suggested language or stays a separate axis, and that is a real design decision, not a
rename. Note `chat/_canvas/knowledge-preview-mini-graph.tsx` already imports `tierEdgeStyle`, so the
canvas surface hosts both vocabularies today. **Logged as `deferred-items.md` D-61-04** with the
decision Phase 62 owes.

**Out-of-scope working-tree churn, deliberately NOT committed.** `apps/web/tsconfig.json` and
`apps/web/next-env.d.ts` carry uncommitted Next.js-generated churn (`next-env.d.ts` re-pointed at
`.next-verify`; tsconfig reformatted). Already modified when I first read them, outside this plan's
five files, so left unstaged rather than swept into a vocabulary commit. **61-01 hit this too and
already logged it as D-61-02** — independently confirming it is not this plan's doing.

**`build:local` must be run from `apps/web`** — there is no root-level script, and several plans
quote the bare command. Logged as **D-61-05**.

## Self-Check: PASSED

Created files verified present:
```
FOUND: apps/web/src/app/_vocabulary/tier.ts
FOUND: apps/web/src/app/_vocabulary/__tests__/tier.test.ts
FOUND: apps/web/src/app/chat/_canvas/canvas-vocabulary.ts
FOUND: apps/web/src/app/chat/_canvas/__tests__/canvas-vocabulary.test.ts
```
Commits verified in `git log`: `6e1ad9e`, `79b5ea6`, `1a81b32`.

No stubs. No `TODO`/`FIXME`/placeholder values introduced. No new threat surface (no network, auth,
file or schema boundary touched — this plan ships two pure modules and their gates).
