---
phase: 61-surface-redesign-chat-canvas-mobile-panel-chrome
plan: 06
subsystem: canvas-nodes
tags: [canvas, react-flow, xyflow, node-shells, data-edge, law-1, law-2, law-3, SURF-02, cascade-layers, tailwind-v4]
requires:
  - "61-02's canvas-vocabulary.ts (CANVAS_NODE_KIND_GEOMETRY / CANVAS_EDGE_TIER)"
  - "61-05's --xy-* React Flow theming + the 9 registered palette tokens (stroke-edge, bg-bright, border-rule/hair, text-pencil/faded)"
  - "61-05's chat-canvas capture surface (D-61-05-A, closed) — the board is finally reviewable"
  - "58-IDENTITY.md D-58-01 laws 1/2/3 (LOCKED)"
provides:
  - "one card language across all five node kinds — the sketch's flat .card, zero shadow, --bright over the board"
  - "canvas-node-shell-class.ts — the ONE shell recipe (61-05's *-class.ts precedent)"
  - "kind resolved from CANVAS_NODE_KIND_GEOMETRY at every shell; the five local strings are gone"
  - "CANVAS_EDGE_TIER_STYLE — the tier facts as VALUES, for a consumer that cannot use a class"
  - "the wire on the sketch's neutral --edge at 1.5 (61-05's last mismatch on the board, closed)"
  - "canvas-node-law.test.tsx — the laws over the RENDERED shells (49 assertions)"
  - "chat/_canvas/ is CLEAR of the retired hue and madder-on-a-state — 61-08's ratchet precondition"
affects:
  - "61-08 (the ratchet's _canvas/ half is done; chat/_components/ is still red — D-61-06-D)"
  - "61-08 (PanelActionsToolbar's props shape untouched, as required for transcript reuse)"
  - "61-07 (canvas-keyboard-hint is now a bottom-centre card; it no longer covers the Controls)"
  - "Phase 62 (/knowledge's edges: CANVAS_EDGE_TIER_STYLE is the projection a React Flow edge can actually use)"
  - "Phase 63 (provenance edges inherit both edge projections + the drift gate)"
tech-stack:
  added: []
  patterns:
    - "a layered utility can NEVER style a React Flow edge — the stock rule is unlayered; the fact must travel as a VALUE"
    - "two projections of one fact + a drift gate beats one projection that cannot reach its consumer"
    - "a distinctness assertion over a class string that also carries dimensions is vacuous — slice to the axis under test"
    - "a component nothing has ever mounted has no coverage AND no React import; the import is the symptom"
key-files:
  created:
    - apps/web/src/app/chat/_canvas/canvas-node-shell-class.ts
    - apps/web/src/app/chat/_canvas/__tests__/canvas-node-law.test.tsx
  modified:
    - apps/web/src/app/chat/_canvas/chat-node.tsx
    - apps/web/src/app/chat/_canvas/genui-panel-node.tsx
    - apps/web/src/app/chat/_canvas/email-thread-node.tsx
    - apps/web/src/app/chat/_canvas/knowledge-preview-node.tsx
    - apps/web/src/app/chat/_canvas/unknown-node-type-placeholder.tsx
    - apps/web/src/app/chat/_canvas/data-edge.tsx
    - apps/web/src/app/chat/_canvas/canvas-vocabulary.ts
    - apps/web/src/app/chat/_canvas/canvas-keyboard-hint.tsx
    - apps/web/src/app/chat/_canvas/add-knowledge-preview-popover.tsx
    - apps/web/src/app/chat/_canvas/edge-creation-picker.tsx
    - apps/web/src/app/chat/_canvas/controls/edit-params-control.tsx
    - apps/web/src/app/chat/_canvas/controls/retheme-control.tsx
    - apps/web/src/app/chat/_canvas/__tests__/email-thread-node.test.tsx
decisions:
  - "D-61-06-1: the card base lives in canvas-node-shell-class.ts, NOT canvas-vocabulary.ts — 61-02's own header assigns it to the shell, and 61-05's canvas-panel-button-class.ts is the precedent for one recipe across N files."
  - "D-61-06-2: shells index CANVAS_NODE_KIND_GEOMETRY with a STATIC literal key, not canvasNodeKindOf(<literal>). A registry rename would make the resolver silently answer 'unknown' (a placeholder frame forever); the static key is a compile error instead."
  - "D-61-06-3: the wire's tier travels as VALUES (CANVAS_EDGE_TIER_STYLE), not classes. The stock .react-flow__edge-path rule is UNLAYERED, so the class map's colour would have agreed by accident while the sketch's 1.5 width silently lost to a stock default of 1. A drift gate asserts the two projections agree."
  - "D-61-06-4: selection is an ink OUTLINE, not a ring — law 1 says it out loud rather than through --primary's indirection, and D-61-05-6/D-61-03-F rule out ring (--tw-ring-offset-color defaults to #fff = a white halo in dark)."
  - "D-61-06-5: the chat title stays SANS and the thread subject goes SERIF. One test, opposite answers — the pair is the worked example of law 2's 'where did the words come from'."
  - "D-61-06-6: the unknown placeholder takes EmptyState tone='muted', not a new 'pencil' tone — that primitive is shared with Phase 62's surfaces and D-61-07 already has an open question about it. Same call, same reason, as 61-05 on CanvasEmptyState."
  - "D-61-06-7: chat/_canvas/ swept CLEAR of madder-on-a-state (6 occurrences in 4 files outside files_modified). The plan's own <verification> demands it and 61-08 is gated on it. role-hue-ban's SCOPED_DIRS was NOT touched — that stays 61-08's."
metrics:
  duration: ~185 min
  completed: 2026-07-16
  tasks: 3
  commits: 5
  tests_added: 49
---

# Phase 61 Plan 06: Canvas Node Shells, the Wire & Three Law Violations — Summary

Put all five node shells and the edge on 61-02's vocabulary, redesigned the genui panel chrome, and
cleared **four** live law violations — the three the plan named plus one its objective missed, found
the only way that one can be found: by reading.

**The headline is what the capture showed.** 61-05 closed D-61-05-A one commit before this plan, so
for the first time the board was photographable — and every card on it was painted `bg-background`,
which resolves to **`--shelf`, the page ground**. Every node card was the *exact colour of the board
behind it*. Only its border and the grid stopping at its edge said a card was there at all. The
sketch says `--bright` and means it: a card sits ABOVE the page. That is not a token rename; it is
the difference between a sheet and a hole, and it was invisible for three milestones because nobody
could see this surface.

## What Shipped

| Task | Commit | What |
|------|--------|------|
| 1 | `1a101d9` | the card language — one flat sheet, kind from the vocabulary |
| 2 | `b430257` | the remaining nodes, the neutral wire, four law violations |
| — | `f70bbb6` | clear the last madder-on-a-state in `chat/_canvas/` (61-08's precondition) |
| 3 | `54773ae` | `canvas-node-law.test.tsx` — the laws over the RENDERED shells |
| 3 | `4444a13` | fix a VACUOUS assertion in that gate, caught by its own negative proof |

## What I SAW in the canvas captures

Ran `npm run screenshot:review` before and after, read `chat-canvas-desktop-{light,dark}.png` at full
size in both themes, plus 3x crops. `select:ok tab:ok`, 40 PNGs/run.

**Before** (`.planning/ui-reviews/2026-07-16T04-41-27-678Z/`):

1. **The cards were the board.** `bg-background` = `--shelf` = the board's own colour. In both
   themes the card fill and the parchment/dark ground were indistinguishable; the grid dots ran right
   up to the border and the card read as a cut-out, not a sheet.
2. **The wire dominated the composition.** Ink at 2px — in dark it was a **glaring near-white
   rectangle** looping around the empty middle of the board, by far the loudest thing on screen, and
   its arrowhead (61-05's `--edge`) visibly disagreed with it.
3. **The header tonal shift was doing nothing.** `bg-muted/60` on the chat node vs `bg-muted/40` on
   the others — two shades of one grey, invisible as a "kind" signal and inconsistent as chrome.
4. **The thread snippet was sans.** The mail's own sentence, in the product's UI font, indistinguishable
   from "Example Sender" above it.
5. **The keyboard-hint bar was worse than an opacity trick** (D-61-05-B). Its full-width
   `bg-background/95` strip **clipped the Controls card in half**: the fit-view and interactive
   buttons sat underneath it, unclickable, with one of them faintly **GHOSTING THROUGH** the 5%
   translucency. That is a reachability bug wearing a styling bug's clothes — and an opaque ground
   alone would have hidden the ghost while leaving the controls just as unreachable.

**After** (`.planning/ui-reviews/2026-07-16T05-27-20-685Z/`):

- **The cards sit on the board.** `--bright` over `--shelf`, a `--rule` hairline, `rounded-card`, no
  shadow. The grid stops at the edge and the card reads as a sheet laid on the working surface —
  in both themes.
- **The wire recedes.** `--edge` at 1.5. In dark it went from the loudest element to a quiet
  structural line, and it now agrees with its own arrowhead. The board reads calm; the cards carry
  the composition. This is the single largest visual change in the plan.
- **Law 2 is legible on one card.** The thread's subject and snippet are serif ink; "Example
  Sender" is sans and quiet, one line apart. You can *see* which words are the mail's. That crop is
  the clearest evidence this project has that law 2 does real work.
- **The Controls card is whole again** — all four buttons visible — and the hint is an opaque
  bottom-centre card clearing both it and the minimap.
- **The React Flow attribution is visible in a committed capture for the first time** (D-61-06-B).
  The full-width hint bar had been painting over it. T-61-16 makes that a *contract*; 61-05
  restyled the attribution to stay visible and left `hideAttribution: false` untouched — correctly —
  while a sibling component quietly occluded it anyway. **No gate could see this**: 61-05's stock-ban
  gate reads the stylesheet and would report the attribution correctly themed, which it was. An
  element occluded by an unrelated sibling is invisible to every gate this phase has.

**What I did NOT see, said plainly: the selection outline.** The fixture seeds no selected node, so
no committed PNG shows a selected card. I verified the classes EMIT and that the gate proves they
are applied and ink — I am not claiming they look right. Logged as **D-61-06-A** with the recipe.
I did not change the fixture: seeding selection means clicking a node in the shared harness, which
changes what "the canvas surface" means for every future run and risks a drag/misclick on the `×` in
a harness that currently passes. That is a harness decision, not a restyle.

## The law-2 pair — the thing the plan asked me to record

**This is one decision with two answers, and it only makes sense read as a pair.** Law 2's test is
*"where did the words come from?"* — never *"which element holds them?"*. Both cards put a title in
the same slot of the same header; the answers diverge because the provenance does.

| Words | Where they came from | Verdict |
|---|---|---|
| `EmailThreadNode`'s **subject** | the sender typed it, into their mail client | **serif + `data-evidence`** |
| `EmailThreadNode`'s **snippet** | the sender's own sentence, server-truncated | **serif + `data-evidence`** |
| `EmailThreadNode`'s **participants** ("Example Sender, you · 2 messages") | polytoken counted and formatted this. The mail contains no such line. | **sans** |
| `ChatNode`'s **title** | the user named the conversation, or polytoken generated it | **sans** |
| `ChatNode`'s **`?? "Chat"` fallback** | polytoken's word, outright | **sans** |
| `KnowledgePreviewNode`'s **label** | polytoken's canonical name for a resolved entity — its index term, deduped and normalized across every mail it appeared in | **sans** |

The chat title is the interesting one because it *looks* like the thread subject: same slot, same
size, user-supplied text. But a conversation title is a name the user gave to a **polytoken
artifact**; a thread subject is a string that arrived **from outside**, in the mail. Serif is the
claim "these are not our words". A conversation title fails that test even though a human typed it.

The knowledge label is the closest call and I resolved it **sans**, deliberately: an entity label is
derived FROM mail but is not a quote OF it — it is a catalogue heading, and its fallback ("Knowledge
preview") is polytoken's own. Serif is a claim that has to be earned; that label does not earn it.
**Phases 62 and 63 will face this exact question** on source cards and canon entries — the rule that
travels is *ask about the provenance of the words, not the role of the element*.

**The trap (§F), and how it was avoided:** `font-serif` is on the SPANS, never on the header row. A
serif container hands its font down to the sans caption beside it by INHERITANCE, and **no
className-reading gate can see that** — which is why `pmark`/`chip` (both of which imply
`font-serif`) are not used here at all. The gate asserts the implication **both ways** over the whole
rendered tree, and the "participants line" test additionally asserts `closest("[data-evidence]")` is
null, so an inherited serif from an ancestor would be caught rather than assumed absent.

## Per-File Changes

**`canvas-node-shell-class.ts`** (new) — ONE card recipe. Five shells carried five hand-copied
strings (`rounded-lg border border-border/60 bg-background transition-shadow duration-150` + a
shadow); four agreed by coincidence and the fifth had drifted into framing itself in the irreversible
colour, unnoticed for three milestones. **The base is here, not in `canvas-vocabulary.ts`, because
61-02's own header says so** ("the base belongs to the shell") — the vocabulary holds semantic maps;
a flat card is not one. Precedent: `canvas-panel-button-class.ts` (61-05), `panel-action-button-class.ts`,
`user-bubble-class.ts`.

**`chat-node.tsx`** — the flat card; `border-l-4 border-l-ink` from the map. FIX-04's
`border-l-2 border-l-primary` had the right IDEA (a left rule saying "this is the conversation") and
the wrong spelling: `--primary` resolves to ink, so the stripe was already hueless on screen while
still *reading* as an accent to anyone editing the file. **That indirection is the mechanism of this
whole debt** — a hue that isn't one, kept alive by a name. The idea survives, in ink, said out loud.
`bg-muted/60` gone; icon `text-primary` → `text-faded`; title `text-sm font-semibold text-foreground`
→ `text-xs font-semibold text-ink`, sans.

**`genui-panel-node.tsx`** (criterion 1's fourth named component) — the flat card;
`border-l border-l-ink`, the lightest of the three ruled kinds, because a generated panel carries
none of the user's own words. `bg-muted/40` gone. Icon faded. Caption "From turn {n}" → the sketch's
`.cap` (`text-2xs text-pencil`, sans). Streaming dot `text-primary` → `text-ink`, keeping its
`aria-label="Streaming"` and `motion-safe:` guard. Body `p-4` → `p-row-y` (the sketch's `.cbody`
rhythm on a named step; 16px was an inherited default, never a chosen density) **plus `w-full`** —
D-61-06's obligation, not decoration: Radix's Viewport wraps children in an inline
`{min-width:100%;display:table}` div that shrink-wraps to CONTENT, so a body that does not claim the
full width lets a wide spec de-bound every descendant. Preserved exactly: `GenuiPanelNodeBody`'s memo
split (no unstable prop added), the whole `useCanvasSpec`/`useCanvasPart`/`usePanelData`/
`useDataBindings`/`usePanelOverlay` + `resolveActivePanel` + `PanelThemeScope` +
`GenuiPartBoundary variant="bare"` chain, `PanelActionsToolbar`'s mount point **and props shape**
(61-08 reuses it), `GeneratingRing`, `onGeneratingChange`, the `isInteractiveWidget` branch,
`node-drag-handle`, both `<Handle>`s, the dimension floors. **`spec-renderer.tsx` byte-identical.**

**`email-thread-node.tsx`** — the flat card + `border-l-2 border-l-ink`. The retired node-type hue
gone from the icon **and from the comment that named it** (the ratchet reads LINES). Subject and
snippet → serif + `data-evidence` on the sketch's `.ct2`/`.csnip`; participants → `.parts`, sans.
`×` → the sketch's `.xbtn`, ink. Error icon → ink (below). Footer `.cf` on a `--hair` rule; "Open
thread" on `.tbtn.quiet`'s hover step. Skeleton rows + `role="status"` untouched; **no invented
fields** (T-61-20 — the sketch's source card has a URL line and a "Saved from the web" caption for a
node type this product does not have; that is Phase 63's, and 60-07 recorded the same trap).

**`knowledge-preview-node.tsx`** — the flat card + `border-l-2 border-l-ink border-dotted` (a bounded
GLANCE at another surface, not an artifact in its own right). Icon `text-primary` → `text-faded`. `×`
→ ink. The footer link IS interactive, so its hover is honest — moved onto the sketch's `--ink-05`
step and kept its `pointer-coarse:h-11` floor.

**`unknown-node-type-placeholder.tsx`** — the madder frame gone; now the vocabulary's `unknown`
geometry (a dotted `--rule` frame, no left rule — "this card claims nothing"). `tone="destructive"`
→ `tone="muted"`. **T-61-18 respected**: still visibly accounts for the saved node (the gate asserts
its `nodeType` renders), still inert, still never throws.

**`data-edge.tsx`** — the wire (below). Label pill → the sketch's `.edgelabel`: `--faded` on
`--leaf`, micro step, small radius, **no shadow** (it wore `shadow-sm` over an 80%-opaque page ground
— a label the wire shows through is a smudge). Preserved: `getSmoothStepPath`, the always-visible
label, `interactionWidth={20}`, `EdgeLabelClickContext`'s stable seam and its persisted-`data`
purity, `animated` unset, `nodrag nopan`.

**`canvas-keyboard-hint.tsx`** (D-61-05-B) — a real bottom-centre card in the surface's own language.
See "What I SAW".

## The wire — why the class map could not style it, and what I did instead

61-05 handed me a one-line fix: *"make the path `--edge` at 1.5"*. The plan handed me a different
one: *"`className="!stroke-primary"` becomes `CANVAS_EDGE_TIER.neutral`"*. **Both cannot be right,
and measuring says the plan's is not.**

The shipped stylesheet, unlayered:

```css
.react-flow__edge-path {
  stroke:       var(--xy-edge-stroke,       var(--xy-edge-stroke-default));
  stroke-width: var(--xy-edge-stroke-width, var(--xy-edge-stroke-width-default));  /* default: 1 */
  fill: none;
}
```

Applying `CANVAS_EDGE_TIER.neutral.path` (`[stroke:var(--edge)] [stroke-width:1.5] fill-none`) puts
those declarations in `@layer utilities`, and **unlayered beats layered before specificity is
consulted**. So:

- `stroke` would lose — and 61-05 set `--xy-edge-stroke: var(--edge)`, so it would resolve to the
  **same colour anyway**. The class would be dead and *look correct*.
- `stroke-width` would lose to a stock default of **1**, and the sketch's 1.5 would silently not
  happen.

That is precisely the failure 61-05 found in the controls-svg `fill` rule — *"it resolved to the
same ink by accident, which is why the gate stayed green over a rule that never applied"* — and I
was one instruction away from re-committing it in a new file. 61-02's escape hatch ("the consumer
must force them") is also not mechanically available: **Tailwind v4 scans for LITERAL strings, so a
`!` composed at runtime (`` `!${tier.path}` ``) emits nothing at all.**

So the FACT travels and the CLASS cannot — which is the concession `CANVAS_EDGE_TIER.suggested`
already documents in the other direction (*"the email-detail surface spells this same fact as
`border-dashed` on a CSS box; an edge is an SVG path, so it spells it as a dasharray"*). I added
**`CANVAS_EDGE_TIER_STYLE`**: the same three tiers as CSS values, consumed inline where nothing can
outrank them, with a **drift gate** asserting the two projections name the same token, width and
dashedness. Extend both or neither.

`--xy-edge-stroke-width: 1.5` in `globals.css` was the tempting one-liner and is **wrong**: those
vars sit on `.react-flow`, shared with `/knowledge`, whose `tier-edge-style.ts` sets `stroke` but
leaves width to the library — so a global would silently re-weight Phase 62's edges from a plan that
does not own them.

**Phase 62 inherits this**: `/knowledge`'s tier edges are React Flow edges too, so they need
`CANVAS_EDGE_TIER_STYLE`, not `CANVAS_EDGE_TIER`. (And see D-61-04 — its "tier" is a different axis
that must be *decided*, not renamed.)

## The four violations — each re-verified as live before it was touched

The plan told me to verify first because 60-07 was ordered to fix a defect that had already been
fixed. All three were live. **A fourth was not in the plan's objective.**

| # | Where | What | Now |
|---|---|---|---|
| 1 | `unknown-node-type-placeholder.tsx:45` | madder framing a **STATE** — an unrecognized node type is not an irreversible action; nothing has happened, so nothing can be undone | dotted `--rule` frame (the `unknown` geometry) |
| 2 | `email-thread-node.tsx:134` (+ its comment, `:13`) | the retired node-type hue on the icon; post-59 it resolves to a grey, so the role coding was **already dead on screen** | `text-faded`, like every kind |
| 3 | both `×` buttons | madder TEXT on a control that removes a card from a board (T-61-19) — the thread, the conversation and the knowledge node all survive; only the placement drops, and it re-adds | ink, on the sketch's `.xbtn` |
| **4** | `email-thread-node.tsx:171` | **found by reading, not named by the plan**: the error branch tinted its `AlertCircle` with the irreversible colour — **madder on an error state**, the exact `<Badge variant="destructive">Preview failed</Badge>` defect class 60-06 found | ink, per 61-05's save-status precedent |

Violation 4 is worth dwelling on. The plan's objective names three; its own `<automated>` verify
greps for `text-<madder>` across the file and would have caught it — so the plan's *gate* was
stricter than the plan's *prose*. That is the right direction for a gate to fail, but it is luck.
The generalisable point is the one the brand guide already makes: **a status talking in the
irreversible colour is the single most common law-1 violation, and reading is the only thing that
reliably finds it.**

**Comments count.** My own first drafts of two comments named `text-<madder>` and the
important-marked ink stroke while explaining why they were removed — and the plan's verify caught
**my documentation**, exactly as §G/60-06 warn. Both rewritten to describe, never name.

## Deviations from Plan

**1. [Scope — taken] `chat/_canvas/`'s remaining madder: 6 occurrences, 4 files outside
`files_modified`** (`f70bbb6`). The plan's `<verification>` demands *"zero ... anywhere under
`chat/_canvas/` — Plan 61-08's ratchet depends on this being true before it runs"*, and its
`files_modified` under-counted (D-61-04-B had already measured 13 in `_canvas/`). All six are STATES
in the irreversible colour: validation errors, server errors, two error cards wearing a madder wash.
Now ink at medium weight / ink on a `--rule` hairline, per brand-guide §3's own replacement rule.
`edge-creation-picker`'s Remove is the one CONTROL and it goes ink too — removing an edge re-adds
from the same picker, i.e. T-61-19's reasoning applied to a wire. **`role-hue-ban.test.ts` was NOT
touched**: `chat/_components/` is still red, so the ratchet append stays 61-08's call (D-61-06-D).

**2. [Scope — taken] `canvas-vocabulary.ts` gained `CANVAS_EDGE_TIER_STYLE`** (not in
`files_modified`). Forced by the cascade measurement above; the alternative was a dead class string.
Additive — 61-02's map gate enumerates its three maps explicitly and stays green (53/53).

**3. [Scope — taken] `canvas-keyboard-hint.tsx`** (D-61-05-B, not in `files_modified` — the brief
assigned it). Its named fix was "a real ground", but the capture showed the full-width strip also
**occluded the Controls card and the attribution**, so a ground alone would have hidden a ghost and
left the bug. Made it a bottom-centre card, which fixes both in one change and puts it in 61-05's
card vocabulary.

**4. [Rule 3 — blocking] `data-edge.tsx` and `unknown-node-type-placeholder.tsx` had no
`import * as React`** and threw `ReferenceError: React is not defined` the first time the new gate
mounted them. **The missing import is not the finding — the reason it survived is: nothing had ever
mounted either component.** `data-edge.tsx` has shipped since Phase 23 and the placeholder since
Phase 26 with zero component-level coverage, and the placeholder IS CANVAS-03's degrade-gracefully
mitigation for an untrusted persisted `node.type`. Fixed at both sites with the note; logged as
D-61-06-C.

**5. [Deviation from a literal instruction] Shells index `CANVAS_NODE_KIND_GEOMETRY` with a static
key, not `canvasNodeKindOf(<literal>)`** (D-61-06-2). `canvasNodeKindOf` is a resolver for an
UNTRUSTED string; inside a shell React Flow only ever mounts for its own registered type, the kind is
a compile-time fact. And the resolver is strictly *less* safe here: rename the registry key
`"email-thread"` → `"email_thread"` and `canvasNodeKindOf("email-thread")` silently returns
`"unknown"` — a placeholder frame forever — where `CANVAS_NODE_KIND_GEOMETRY["email-thread"]` is a
compile error. T-61-17 holds either way (a literal key, never data-derived).

**6. [Test updated, not deleted] `email-thread-node.test.tsx`'s Retry hover assertion.** It pinned
`hover:bg-accent`; the redesign moved that hover to the sketch's own `.tbtn:hover` step
(`--ink-08`). The FACT it guards — *"this Retry is a quiet ghost, not a filled CTA"* — is unchanged,
and `not.toContain("bg-primary")` is the half that actually guards it. Re-pointed with the reasoning
in place.

**7. [Scope — NOT taken] The `×` buttons' focus rings.** I briefly changed them to outlines and
reverted: `ring-offset-1`'s white halo in dark is real but **pre-existing and app-wide**, and
changing two buttons would create a new inconsistency with every other button while fixing nothing
systemic. Not my violation; not this plan's call.

**8. [Scope — NOT taken] `EmptyState` gained no `pencil` tone** (D-61-06-6). Brand-guide §3 says an
uncertain read is `--pencil`, and `tone="muted"` renders `--faded` — one step off. Adding a tone to a
primitive shared with `/knowledge`, `/studio` and `entities-gallery` (Phase 62's surfaces, with
D-61-07 already open on its `action` weight) is a cross-surface decision, not a restyle. `--faded` is
also exactly what the sketch's `.ch svg` gives every other card's icon, so the placeholder now agrees
with its siblings.

**9. [Pre-existing] `tsconfig.json` / `next-env.d.ts` churn left unstaged** — D-61-02's `build:local`
dist-dir flip. Confirmed by 61-01..61-05; not this plan's doing.

## Negative Proofs — all three executed against the COMMITTED tree, RED output verbatim

61-05 lost a whole task to `git checkout --` before committing. Every proof below ran against a
committed file.

**1. Restore the madder frame on the unknown placeholder** — RED, naming the rendered class:

```
→ unknown rendered "h-full min-h-[240px] w-full min-w-[320px] gap-2 p-row-y border-destructive/30
  flex flex-col overflow-hidden rounded-card border border-rule bg-bright transition-colors
  hover:border-rule-hi border-dotted":
  expected 'h-full min-h-[240px] w-full min-w-[32…' not to match /\b(?:text|border)-destructive\b(?!-fo…/
Tests  1 failed | 4 passed | 39 skipped (44)
```

**2. Point `GenuiPanelNode` at `CANVAS_NODE_KIND_GEOMETRY.chat`** — **this proof found a defect in my
own gate, and that is the most valuable thing in this plan.**

First run, with the mis-wire live: **61-02's map gate 53/53 green** (as predicted — it structurally
cannot see a mis-wire) *and my rendered gate green too*. The assertion was **"the four real shells
produce mutually DISTINCT root class strings"** — and the shells' *dimension* classes
(`min-h-[320px]` vs `h-[220px]` …) already differ, so it was asserting the shells have different
SIZES, a fact nobody doubted, while reading as if it proved kind legibility. **Green, and about
nothing** — the same shape as the dead override 61-05 found, in the gate written to prevent it.

Fixed to read the kind-geometry SLICE alone, plus a per-kind own/other-geometry assertion. Re-run
against the same mis-wire:

```
→ two kinds render the SAME geometry:
  chat: border-l-4 border-l-ink
  genui-panel: border-l-4 border-l-ink
  email-thread: border-l-2 border-l-ink
  knowledge-preview: border-dotted border-l-2 border-l-ink: expected 3 to be 4

→ genui-panel does not render its own geometry class "border-l": expected false to be true
Tests  2 failed | 47 passed (49)
```

…while `canvas-vocabulary.test.ts` stays **53/53 green**. That contrast is the entire argument for
both gates existing, and it is now demonstrated rather than asserted.

**3. Drop `data-evidence` from the thread subject, keep `font-serif`** — RED, naming the element and
its words:

```
→ email-thread: <span> is font-serif without data-evidence — "Q3 renewal quote":
  expected false to be true
Tests  1 failed | 48 passed (49)
```

**4. No proof edit leaked.** `git diff --stat 54773ae -- src/app/chat/_canvas/` after all three
reverts shows **only** `canvas-node-law.test.tsx` (the vacuity fix from proof 2, committed as
`4444a13`); `git status` for `_canvas/` is clean.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | **78 files / 960 passed**, 2 skipped — baseline 77/916 + this plan's 44 (+5 from the gate fix), **zero regressions** |
| `npm run test:geometry` | **3 passed** (D-61-06 unaffected; the panel body claims `w-full`) |
| `npm run build:local` | clean (`✓ Compiled successfully`) |
| `npm run screenshot:review` | 40 PNGs, both themes, `select:ok tab:ok`; canvas read at full size + 3x crops |
| `packages/genui/src/renderer/spec-renderer.tsx` | **untouched** — `git diff --stat` empty, `git status` clean |
| Task 1 verify (`shadow-elevation`/`text-primary`/`border-l-primary` in the two shells) | **0** |
| Task 2 verify (retired hue / madder / `shadow-elevation` / forced ink stroke in the four files) | **0** |
| every new class EMITTED in built CSS | **29/29 by exact escaped selector**, 3 negative controls absent |
| `chat/_canvas/` clear of the retired family + madder text/border | **ZERO** — 61-08's precondition holds |

**Emitted-CSS proof.** Respecting the trap that has lied 5 times: concatenated **all five** sheets
(largest 115,352 B; 143,793 B total — `head -1` would have picked a 1,316 B sheet), matched exact
escaped selectors in Python, never `grep -c` on minified CSS.

Two near-misses worth recording, both of which a naive check would have reported as defects:

- **`.outline-2` emits as TWO rules** — `{outline-style:var(--tw-outline-style)}` then
  `{outline-width:2px}`. Reading only the first says "the selection outline has no width" and sends
  you chasing a live rule. (`@property --tw-outline-style` defaults to `solid`, so no
  `outline-solid` is needed — nothing here sets `outline-none`.) This is 61-05's minifier-reordering
  trap, inverted.
- **`.hover\:border-rule-hi{` reads MISSING** — because the emitted selector carries the pseudo:
  `.hover\:border-rule-hi:hover{border-color:var(--rule-hi)}`. The check string was wrong, not the
  CSS.

## Success criteria

- [x] **One card language across every node kind** — a flat `--bright` sheet, one `--rule`, one
      `rounded-card`, `--rule-hi` on hover, zero shadow, an ink selection outline stated rather than
      inherited. Distinct in SUBSTANCE: the cards were previously painted the board's own colour.
- [x] **Kind is geometry from one map** — the five near-identical local strings are gone; every shell
      names `CANVAS_NODE_KIND_GEOMETRY`, and the gate proves the components USE it (proof 2).
- [x] **The mail's own words are serif; polytoken's summary of them is sans; the gate proves both
      ways** — over the whole rendered tree, plus an ancestor check the class gates cannot do.
- [x] **The three law violations are gone from code and comments** — and a fourth the plan did not
      name. `chat/_canvas/` is measured clear, so 61-08's ratchet is unblocked for that subtree.

**SURF-02 stays Pending** — 61-08 also carries it. But **ROADMAP criterion 2 is now fully met**:
61-05 delivered the controls, minimap, background and the "zero stock styling" clause and explicitly
left *"the node shells are 61-06's, and so is the wire"*. Both are now done, on the vocabulary, with
a gate over the rendered result. Criterion 1's fourth named component (the genui panel chrome) is
also delivered.

## Notes for later plans

- **61-08: the `_canvas/` half of the ratchet is done; `chat/_components/` is not** (D-61-06-D). ~11
  madder text/border remain there — `cost-cap-blocked-card.tsx` / `inline-error-card.tsx` are a real
  law-1 question (a *state* wearing a madder border), not a chore, and `thread-cluster-indicator.tsx`
  carries the retired hue. Clear those before appending `chat/` to `SCOPED_DIRS`, or the gate is red
  on arrival.
- **61-08: `PanelActionsToolbar`'s props shape is untouched**, as your plan requires.
- **Anyone styling a React Flow edge: a class CANNOT do it.** Use `CANVAS_EDGE_TIER_STYLE`. The
  stock rule is unlayered; a layered utility loses before specificity is consulted; and the `!`
  escape hatch cannot be composed at runtime under Tailwind v4's scanner. The drift gate keeps the
  two projections honest.
- **Phase 62: `/knowledge`'s edges need the VALUE projection too**, and D-61-04's "two unions called
  tier" question is still open and must be decided, not renamed.
- **Anyone writing a distinctness gate: slice to the axis under test.** A root class string that also
  carries dimensions makes "all N are distinct" true for free (proof 2).
- **Anyone adding a component under `_canvas/`: check something mounts it.** Two shipped for three
  years' worth of milestones with no component coverage, and the missing `React` import was only ever
  a symptom of that.

## Self-Check: PASSED

```
FOUND: apps/web/src/app/chat/_canvas/canvas-node-shell-class.ts
FOUND: apps/web/src/app/chat/_canvas/__tests__/canvas-node-law.test.tsx
FOUND: apps/web/src/app/chat/_canvas/chat-node.tsx
FOUND: apps/web/src/app/chat/_canvas/genui-panel-node.tsx
FOUND: apps/web/src/app/chat/_canvas/email-thread-node.tsx
FOUND: apps/web/src/app/chat/_canvas/knowledge-preview-node.tsx
FOUND: apps/web/src/app/chat/_canvas/unknown-node-type-placeholder.tsx
FOUND: apps/web/src/app/chat/_canvas/data-edge.tsx
FOUND: apps/web/src/app/chat/_canvas/canvas-vocabulary.ts
FOUND: apps/web/src/app/chat/_canvas/canvas-keyboard-hint.tsx
```
Commits verified in `git log`: `1a101d9`, `b430257`, `f70bbb6`, `54773ae`, `4444a13`.

**No stubs.** No `TODO`/`FIXME`/placeholder introduced. No scratch dir written under
`.planning/ui-reviews/` (D-61-01); the emission-check script lives in the session scratchpad.

**Threat model compliance:** **T-61-17** — every class comes from a lookup into a closed map keyed by
a compile-time-literal kind; no string is concatenated from `node.data`/`node.type`/`edge.data`.
Subjects, snippets, `sourcePath`, `targetKey` and `data.nodeType` all render as React text nodes and
are never interpolated into a class or a `style`. **T-61-18** — the unknown placeholder is restyled
only: still rendered, still inert, never throws, and the gate asserts its `nodeType` is visibly
accounted for. **T-61-19** — both `×` controls are ink; the reasoning (removal is undoable) is stated
at both sites and gated. **T-61-20** — `email-thread-node` renders exactly the fields it rendered
before; the sketch's source-card URL line and "Saved from the web" caption were NOT built (Phase
63's). **T-61-21** — `saveCanvasLayout` was never called, read or modified. **T-61-SC** — no packages
installed.

**Threat flags:** none. No network, auth, file or schema boundary touched — this plan edits client
components, one vocabulary module, and adds one constant module and one test.
