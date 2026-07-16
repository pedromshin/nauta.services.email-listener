---
phase: 61-surface-redesign-chat-canvas-mobile-panel-chrome
plan: 05
subsystem: canvas-chrome
tags: [canvas, react-flow, xyflow, tokens, cascade-layers, law-1, SURF-02, tailwind-v4, a11y]
requires:
  - "61-01's npm run test:geometry (run after every structural edit here)"
  - "58-IDENTITY.md D-58-01 laws 1/2 (LOCKED) + its ban-#12 canvas exception"
  - "Phase 59's identity ladder + density steps"
provides:
  - "globals.css's React Flow block rewritten on the library's own --xy-* theming API — the FIRST version of it that actually applies"
  - "all NINE unregistered palette tokens registered (--edge/--grid/--rule-hi/--ink-05/--fill-hi/--bad-hi/--ink-08/--ink-14/--shimmer)"
  - "token-registration.test.ts's contract is now DERIVED from the palette, not hand-listed"
  - "react-flow-stock-ban.test.ts — criterion 2 executable against the SHIPPED stylesheet"
  - "the sketch's board: a 22px var(--grid) dot grid at the sketch's real dot SIZE"
  - "canvas-panel-button-class.ts — the one top-right Panel cluster recipe"
affects:
  - "61-06 (owns data-edge.tsx: the wire is still !stroke-primary ink at 2px; its arrowhead is now --edge. Measured mismatch, one-line fix)"
  - "61-06 (owns chat/_canvas/: canvas-keyboard-hint.tsx is the last bg-background/95 — D-61-05-B)"
  - "61-06/61-07 (the CANVAS still has zero committed capture coverage — D-61-05-A, recipe included)"
  - "Phase 62 (/knowledge's controls+minimap+attribution VISIBLY change — a fix, before/after PNGs cited)"
tech-stack:
  added: []
  patterns:
    - "unlayered third-party CSS BEATS anything in a Tailwind cascade layer — specificity never enters it"
    - "theme a library through its own --xy-* variables: different property names never fight"
    - "a stylesheet-parsing gate cannot see a colour the library hardcodes in JS as an inline style"
    - "derive a gate's set from the source of truth; a hand-list drifts and its header lies"
key-files:
  created:
    - apps/web/src/app/__tests__/react-flow-stock-ban.test.ts
    - apps/web/src/app/chat/_canvas/canvas-panel-button-class.ts
  modified:
    - apps/web/src/app/globals.css
    - apps/web/src/app/__tests__/token-registration.test.ts
    - apps/web/src/app/chat/_canvas/chat-canvas.tsx
    - apps/web/src/app/chat/_canvas/add-email-thread-popover.tsx
    - apps/web/src/app/chat/_canvas/add-knowledge-preview-popover.tsx
    - apps/web/src/app/chat/_canvas/save-status-indicator.tsx
    - .planning/phases/61-surface-redesign-chat-canvas-mobile-panel-chrome/deferred-items.md
decisions:
  - "D-61-05-1: REGISTER, and register NINE not four — every raw-oklch token declared in :root is a palette token and must have a --color-* mapping. The gate now derives that set instead of hand-listing it."
  - "D-61-05-2: the React Flow override is built on the library's --xy-* theming variables, NOT selector overrides — the only structure that survives the unlayered-vs-layered cascade. !important is used ONLY for the three stock literals with no variable behind them."
  - "D-61-05-3: the stock-ban gate does NOT count a plain layered override as an override — it requires paints-nothing, or var-themed, or !important. That is what makes it reject the dead rule that shipped for two milestones."
  - "D-61-05-4: <Background size={2}>, not the inherited 1 — React Flow's size is the dot DIAMETER and the sketch's radial-gradient is a 1px RADIUS. size={1} drew the grid at half diameter, invisible at --grid's alpha."
  - "D-61-05-5: canvas edges stay NEUTRAL (--edge) — the arrowhead is fixed at the call site because the library paints it from JS; the wire is 61-06's."
  - "D-61-05-6: Rule 2 — nodes get an ink focus-visible outline. The library sets outline:none and puts nothing back on a keyboard path the product advertises."
metrics:
  duration: ~150 min
  completed: 2026-07-16
  tasks: 3
  commits: 3
  tests_added: 6
---

# Phase 61 Plan 05: React Flow Canvas Chrome & the Stock-Styling Ban — Summary

Made criterion 2 checkable, and in doing so found that **the override block it was supposed to
verify had been mostly dead since Phase 26**. `@xyflow/react/dist/style.css` is imported from a
client component, so Next emits it **unlayered** — and unlayered normal declarations beat anything
inside a Tailwind cascade layer, *before specificity is even consulted*. Every property Phase 26
tried to override that the library also declares has been losing, silently, for two milestones:
the zoom controls rendered the library's near-white fill **in both themes**, the minimap rendered
**pure white**, and the shadow on screen was xyflow's own — so the plan's instruction to "remove
`shadow-sm`" would have changed nothing while reading as a fix, and its grep gate would have
certified it.

None of it was ever seen because **dark mode had never once been captured** until 61-01 added the
theme axis. In light, white-on-parchment just looks like a card.

## What Shipped

| Task | Commit | What |
|------|--------|------|
| 1 | `d3b7106` | the chrome override, rebuilt on the library's own theming API + the 9-token registration gap |
| 2 | `845c7ab` | the board — the sketch's grid at its real dot size, ink controls, a real arrowhead |
| 3 | `26d0493` | `react-flow-stock-ban.test.ts` — criterion 2 against the SHIPPED stylesheet |

## The finding that reframed the whole plan — measured, not reasoned

I probed the live canvas before writing a line of CSS. Same page, both themes, computed styles:

| | before | after |
|---|---|---|
| `.react-flow__handle` background | **`rgb(26,25,43)`** (stock navy) | `oklch(.267 .015 124.2)` = `--ink` |
| `.react-flow__handle` border | **`rgb(255,255,255)`** (stock white ring) | `oklch(.982 .007 97.4)` = `--bright` |
| `.react-flow__controls-button` background | **`rgb(254,254,254)`** (stock `#fefefe`) | `rgba(0,0,0,0)` transparent |
| `.react-flow__controls-button` divider | **`rgb(238,238,238)`** (stock `#eee`) | `oklch(.883 .018 99.6)` = `--hair` |
| `.react-flow__controls` box-shadow | **stock drop shadow** | `none` |
| `.react-flow__minimap` background | **`rgb(255,255,255)`** (stock `#fff`) | `oklch(.951 .011 95.2)` = `--leaf` |
| `.react-flow__attribution` background | **`rgba(255,255,255,.5)`** (stock) | `--leaf` |
| `.react-flow__attribution a` | **`rgb(153,153,153)`** (stock `#999`) | `oklch(.51 .022 119.2)` = `--pencil` |
| `.react-flow__arrowhead polyline` | **`rgb(177,177,183)`** (stock `#b1b1b7`) | `oklch(.267 .015 124.2/.38)` = `--edge` |

**In dark mode the controls button computed `color: oklch(.924…)` (near-white ink) on
`background: rgb(254,254,254)` (white).** The zoom glyphs were white-on-white. The minimap was a
white brick on a dark board.

The `handleRuleOrigins` probe proved the mechanism outright:

```
[layer=components] .react-flow__controls-button { ... bg-transparent ... }   <- ours, LAYERED
[layer=UNLAYERED]  .react-flow__controls-button { background: var(--xy-controls-button-...) }
```

`@apply bg-transparent` never had a chance. **Specificity was never the issue** — layer precedence
is resolved first, and unlayered wins outright.

**This also explains 61-02's note to me.** `DataEdge` needs `!stroke-primary` "because the stock
stylesheet is still imported" — the `!` is not a specificity hack, it is a **cascade-layer**
workaround. An important declaration in a layer beats an unlayered normal one; a plain
`stroke-primary` would have lost. Measured: `edgePath.stroke` = `--ink`, so the `!` is doing exactly
that work.

## Per-File Changes

**`apps/web/src/app/globals.css`** — the override, rebuilt so it applies.

- **Colour is now set through the library's own `--xy-*` theming variables** (D-61-05-2), not by
  re-declaring properties it already declares. We set `--xy-NAME`; the library declares only
  `--xy-NAME-default`. **Two different property names never fight**, so there is no cascade to lose —
  and it is xyflow's supported, documented API, which survives an upgrade far better than a selector
  override. Setting *any* non-default link in a `var(a, var(b, var(c-default)))` chain makes the
  stock tail unreachable, because the tail is only consulted when every earlier link is unset.
- **The handles — the headline.** Never styled in this product's life. Now ink chrome with a
  `--bright` ring, no hue: a connection point is polytoken's own affordance and makes no tier claim
  (law 1). The shipped stylesheet defines **no colour** for the `connectingfrom`/`connectionindicator`
  states, so there was no state-hue to remove — I checked rather than assumed.
- **The shadows are gone for real** via `--xy-controls-box-shadow: none`. Deleting `shadow-sm` (the
  plan's instruction) would have left the stock shadow on screen.
- **Selection was BLUE.** Stock is `rgba(0,89,220,.08)` with a blue dotted border — shadcn-era React
  Flow branding on a monochrome identity. Now `--ink-08` + a dotted `--edge`.
- **Built-in node types + resize controls themed anyway**, though no surface mounts them: two lines
  of CSS beat an allowlist entry that rots the first time someone adds a `<NodeResizer>`.
- **`!important` on exactly three rules** — the stock literals with no variable behind them
  (`.react-flow__attribution a`'s `#999`, `.react-flow__edge.updating`'s `#777`,
  `.react-flow__resize-control.handle`'s `#fff`). Each is marked at its site.
- **The controls-svg fill rule was DEAD, and §C's guard was guarding nothing.** The library sets
  `fill: currentcolor` on that same selector, unlayered, so our layered `fill: var(--foreground)` lost.
  It resolved to the same ink *by accident* (the button's colour inherits ink), which is why
  `token-render.spec.ts` stayed green over a rule that never applied. Kept as a bare `var(...)` per
  §C — with an `!important` so it is now true.
- **The attribution stays visible** (T-61-16): restyled to pencil on leaf, never hidden,
  `hideAttribution` untouched.
- **Rule 2 — an ink focus-visible outline on nodes.** The library sets `outline: none` on a focused
  node and puts nothing back, so Tab-ing between nodes — a flow **the canvas's own hint advertises**
  ("Tab to move between panels") — moved an invisible focus. WCAG 2.4.7. Ink, never a hue (law 1);
  an outline, not a ring (D-61-03-F: `--tw-ring-offset-color` defaults to white = a halo in dark).

**`apps/web/src/app/__tests__/token-registration.test.ts`** — the contract made true.

Its header has claimed since 28-01 that it "asserts every token FAMILY that globals.css declares vars
for is registered". **It did not** — every assertion was a hand-list, so the prose over-claimed and
the gate was silently wrong, which is the exact defect shape it exists to catch. `PALETTE_TOKENS` is
now **derived**: every raw `oklch(...)` value declared in `:root`. That selects exactly the 31 tokens
that must have a `--color-*` mapping — verified against the file, not assumed:

- the identity ladder + `chart-1..5` are all raw oklch literals → the palette;
- every shadcn alias (`--primary`, `--border`, `--sidebar-*`, tier/graph) is a `var(--x)` **reference**
  (59-01 rewrote them all this way) → correctly ignored, they register under their own names;
- `--radius*`/`--font-code`/`--elevation-*` are neither oklch nor colour → the native `@theme` block's
  own assertions.

No allowlist, and a future palette token is caught automatically.

**`apps/web/src/app/chat/_canvas/chat-canvas.tsx`** — the board.

- **The grid: `gap={16} color="var(--border)"` → `gap={22} color="var(--grid)"`.** `--border`
  resolves to `--rule`, a *structural boundary* token doing decorative duty. The identity's own
  ban-#12 exception is **quoted at the call site** — someone will try to remove this grid, and
  D-58-01 pre-authorized it in the sketch's own words.
- **The dot SIZE, which the plan never mentioned and mattered more than the gap (D-61-05-4).**
  React Flow's `size` is the dot **diameter** (it renders `r = size/2` — measured: `circleR: 0.375`
  at 0.75 zoom). The sketch draws `radial-gradient(var(--grid) 1px, transparent 1px)` — solid to a
  1px **radius**, i.e. a **2px** dot. The inherited `size={1}` therefore drew the sketch's grid at
  **half diameter**, and at `--grid`'s 10%/8% alpha that is not subtle, it is **invisible**. I
  captured a 4x crop of an empty board region and got **blank parchment**. `size={2}` is the sketch's
  actual dot. *A grid nobody can see is a dead call site that passes every gate.*
- **The arrowhead** (below).
- **The top-right cluster is one card.** Three `bg-background/95` ghosts — an opacity trick through
  which the board's grid showed faintly — became a real card: container carries the `--bright` fill
  and `--rule` hairline, segments sit transparent inside, `overflow-hidden` clips the hover fill to
  the radius. **The same chrome language as the Controls card**, so the canvas has one vocabulary
  instead of two. 44px floor (D-48-07) and every `aria-label`/`aria-pressed` untouched.
- **Untouched, as instructed**: the whole provider stack + the `isRestoring`/`canvasStore === null`
  skeleton guard above it (61-07 extracts it), every `persistence.scheduleSave` trigger, `handleInit`,
  the seed-once/reconcile effect and its `wasSeeded` capture, `buildSnapshot`, `showMiniMap`'s
  session-only non-persistence, `minZoom`/`maxZoom` (T-61-15), `proOptions` (T-61-16), the
  `role="application"` block, the `sr-only` announcements, `dragHandle`/`DRAG_HANDLE_SELECTOR`.

**`canvas-panel-button-class.ts`** (new) — one recipe, mirroring `panel-action-button-class.ts` and
`user-bubble-class.ts` (the same precedent, twice). The three cluster buttons live in **three files**
and render **side by side in one card**; each carried a hand-copied `size-11 bg-background/95` held
true only by discipline, in the one place drift is most visible.

**`save-status-indicator.tsx`** — the sketch's `.savestatus` register: `text-xs text-muted-foreground`
(12px/`--faded`) → `text-2xs text-pencil` (11px, the micro step). **The error goes INK, not madder and
not pencil**: a failed save is a *state*, not an irreversible action (law 1) — but it is not
bookkeeping either, so it does not drop to the pencil "Saved" wears. Same reasoning as D-61-04-E.
Restyled **in place**; never moved across 61-03's bar boundary.

## The arrowhead — the gate's blind spot, found by looking

With a real edge wired, the wire rendered **ink** and its own **arrowhead rendered stock grey**
(`#b1b1b7`). `--xy-edge-stroke` was set and *should* have themed it. It didn't. The reason:

```
polylineAttrs.styleAttr: "stroke-width: 1; stroke: rgb(177,177,183); fill: rgb(177,177,183);"
resolvedEdgeStrokeVarAtArrowhead: "oklch(26.7% 0.015 124.2 / 0.38)"   <- the var IS reaching it
```

**React Flow computes the marker colour in JS and applies it as an inline style**, so the stylesheet
is never consulted. The var arrives and is silently outranked.

**This is `react-flow-stock-ban.test.ts`'s blind spot, and it is now the first thing its header
says.** The gate reported nothing — correctly and uselessly: `.react-flow__arrowhead polyline` *is*
var-themed in the stylesheet. A green run means *"no stock value in the library's STYLESHEET can
reach the screen"*, **not** *"the canvas has no stock chrome"*. The gap between those two claims is
exactly one class of defect wide, and only looking closed it.

Fixed at the call site (`DATA_EDGE_MARKER_END`) with `color: "var(--edge)"`.

## Decisions the plan asked me to record

**The registration decision, verbatim (D-61-05-1): REGISTER — and NINE, not four.**

The plan named `--edge`/`--grid`/`--rule-hi`/`--ink-05`; 61-03 added `--fill-hi`. The real gap is
**nine**: `bad-hi`, `ink-05`, `ink-08`, `ink-14`, `edge`, `grid`, `fill-hi`, `rule-hi`, `shimmer` —
all declared in **both** themes, registered in neither. Leaving four of nine would reproduce the
exact gap for the next plan, which is how it reached its third consecutive hand-off.

The plan asked whether the gate's own contract says they should be registered. **Its header says yes
and its implementation never checked** — so registering fixes the system rather than extending it,
and the honest completion is making the implementation match the prose. It now derives.

**61-06 inherits: `--edge` is registered — `stroke-edge` exists and emits.** Proven below.

`--ink-05`/`-08`/`-14` deserve a note: registering them does **not** retract D-61-03-B. `bg-ink/5`
and `bg-ink-05` are the same colour by construction and both spellings are legal; the ramps are
registered because they are declared palette values like any other, and their first-class consumers
are `var()` call sites — this plan's own React Flow block reaches for two of them.

**The allowlist entries and their reasons: THERE ARE NONE. The allowlist is EMPTY.**

That is the finding, not an oversight. xyflow v12 routes essentially every visible value through a
`--xy-*` variable, so the library's own theming API covers the surface and nothing needed excusing.
The two candidates I could have allowlisted — the resize controls and the built-in node types, both
mounted by **no** surface today — are **themed instead**: two lines of CSS beat a note that rots.
The gate's header says so explicitly, because "this component never mounts" is a scope reduction
wearing a comment.

**The expected `/knowledge` change, so Phase 62 is not surprised: IT IS A FIX, and it is visible.**

Before/after, both committed captures, dark:

- **before** (`.planning/ui-reviews/2026-07-16T03-25-49-408Z/knowledge-desktop-dark.png`): a **white
  minimap brick** bottom-right, a **white controls strip** with invisible glyphs bottom-left, and a
  **white attribution pill**.
- **after** (`.planning/ui-reviews/2026-07-16T04-15-44-293Z/knowledge-desktop-dark.png`): all three
  are dark cards on the identity, glyphs legible.

`/knowledge`'s own node chrome, filter rail, legend and detail pane are **untouched** — I edited no
file under `knowledge/`. Its handles carry `!opacity-0`, so the navy dots were never visible there.

**A correction to the plan and 61-CONTEXT while I am here:** both state the stock handles are "on
every node of BOTH canvases". They are not — `/knowledge`'s `graph-nodes.tsx` sets `!opacity-0` on
every handle. **The stock navy dots were on the chat canvas only.** The claim is half right, and the
half that is wrong is the one that made it sound twice as bad.

## Deviations from Plan

**1. [Rule 1 — Bug] The override block was dead; the plan's Task 1 premise was wrong.** Full detail
above. The plan says the controls/minimap "carry `shadow-sm`" against "zero shadow anywhere" — true
in source, false on screen: the shadow was xyflow's own, and `shadow-sm` never applied. Its `done`
criterion ("no `shadow-sm`") and its grep verify would **both have passed with the shadow still
visible**. Fixed at the root by rebuilding on the theming API.

**2. [Rule 1 — Bug] `size={1}` drew the sketch's grid at half diameter (D-61-05-4).** Invisible at
`--grid`'s alpha; proven by a blank 4x crop, fixed to `size={2}`, re-proven by a crop that shows the
grid. The plan specified the gap and the token but not the size, and the inherited value silently
halved the one thing the task exists to deliver.

**3. [Rule 1 — Bug] The arrowhead rendered stock grey.** Found by wiring an edge and looking, exactly
as instructed. Invisible to the gate by construction; documented as its blind spot.

**4. [Rule 2 — a11y correctness] Nodes had no visible keyboard focus (D-61-05-6).** The library
removes the outline and the product advertises Tab-navigation between nodes. Ink outline added.

**5. [Scope — taken] Three files outside `files_modified`.** `add-email-thread-popover.tsx`,
`add-knowledge-preview-popover.tsx` (the other two cluster buttons — leaving them would ship three
controls in one card disagreeing, 61-04's `compact-interaction-entry` situation exactly; resolved by
extracting ONE constant rather than editing copies) and `save-status-indicator.tsx` (the plan's own
Task 2 action directs the restyle "where it is", which is impossible without touching its file).

**6. [Scope — NOT taken] `CanvasEmptyState` has nothing to restyle.** It is a thin delegation to the
shared `EmptyState` primitive with no classes of its own. Restyling it means restyling a primitive
shared with `/knowledge`, `/studio` and `entities-gallery` — Phase 62's surfaces — and D-61-07 already
flags that primitive's `action` weight. The plan's "restyle what is there" resolves to "there is
nothing here"; expanding is SURF-06, explicitly Phase 62's.

**7. [Scope — flagged] The plan's §F comment-hazard check is RED ON ARRIVAL** (D-61-05-C). Two
pre-existing comments (Phase 59's, Phase 27's) match it; **2 at HEAD before my change, 2 after**. It
is also over-broad — the real hazard only exists inside the four blocks `readTokenBlock` parses, and
both offenders sit outside them. I verified the **scoped** version: 0 token-colon, 0 stray-close
across `:root`/`.dark`/`@theme inline`/`@theme`.

**8. [Scope — flagged] `canvas-keyboard-hint.tsx` is the last `bg-background/95`** (D-61-05-B) — same
defect class, left to 61-06 which already sweeps `_canvas/`.

**9. [Scope — flagged] The CANVAS still has no committed capture** (D-61-05-A) — see below.

**10. [Scope] `tsconfig.json`/`next-env.d.ts` churn left unstaged** — the `build:local` dist-dir flip
(D-61-02). Independently confirmed by 61-01/61-02/61-03/61-04; not this plan's doing.

**11. [Process — my own error, recorded so nobody repeats it]** I ran `git checkout -- globals.css`
to revert a negative-proof edit **before committing Task 1**, and lost the entire task. Re-applied
from context; zero net loss. **Commit before running negative proofs** — every later proof in this
plan was run against a committed file and reverted safely.

**12. [Rule 1 — my own bug, caught by reading the diff stat] I CRLF-flipped `STATE.md`.** Editing it
with Python's `io.open(p, "w")` translated every `\n` to `\r\n` on Windows, and `core.autocrlf` is
`false` here, so git stored the rewrite verbatim: **the docs commit's first stat read
`10848 ++++----`** for what is a two-line change. Normalised back to LF as bytes
(`open(p,"rb")` → `replace(b"\r\n", b"\n")` → `open(p,"wb")`) and amended; the stat is now
**`8 +-`**. `ROADMAP.md` was already CRLF in the repo and was edited in place, so its diff is the one
line it should be. **Anyone scripting an edit to a `.planning/` file on Windows: read and write
BYTES, or pass `newline=""`.** A commit that rewrites 5,400 lines of shared state to change two is
the kind of thing that silently eats a concurrent agent's work.

## Negative Proofs — all three executed, RED output verbatim, all reverted

**1. The handle theming removed** — the gate names the selector *and* its stock properties:

```
× leaves no stock visible-property declaration able to reach the screen
  → 2 stock React Flow declaration(s) can still reach the screen (ROADMAP criterion 2: "zero stock
    React Flow default styling remaining").

Parsed from the SHIPPED stylesheet at:
  C:\...\node_modules\@xyflow\react\dist\style.css

  .react-flow__handle
      background-color: var(--xy-handle-background-color, var(--xy-handle-background-color-default))
  .react-flow__handle
      border: 1px solid var(--xy-handle-border-color, var(--xy-handle-border-color-default))
```

**2. The stylesheet path moved (a version bump that renames `dist/style.css`)** — and note **which
test passed**:

```
× resolves the SHIPPED stylesheet from the real dependency
  → the resolved xyflow stylesheet does not exist at C:\...\dist\MOVED-BY-AN-UPGRADE.css. An upgrade
    that moves or renames dist/style.css would otherwise leave this gate parsing nothing and passing
    everything.: expected false to be true
× parses a non-zero number of selectors and visible declarations
  → parsed zero rules out of the xyflow stylesheet — the parser or the file shape changed, and this
    gate is now inspecting nothing.: expected 0 to be greater than 50
Tests  2 failed | 3 passed (5)
```

**The main assertion PASSED on zero selectors.** That is the vacuity failure mode in one line, and
the only thing standing between it and a green gate certifying nothing is those two guards. Worth
the ten lines.

*(The first attempt at this proof crashed at module import with a raw ENOENT and "no tests" — a
stack trace, not a guard. I made the reads defensive so the guard reports the sentence that explains
it. A guard whose failure output is an ENOENT is a guard nobody reads.)*

**3. `!important` dropped from a literal override** — the proof that the gate encodes the cascade
discovery and rejects the exact dead rule that shipped:

```
× leaves no stock visible-property declaration able to reach the screen
  → 1 stock React Flow declaration(s) can still reach the screen ...
  .react-flow__attribution a
      color: #999
```

**4. Bonus — the derived registration gate**, proven by deleting one registration:

```
× registers EVERY palette token declared in :root (derived, not hand-listed)
  → globals.css declares 1 palette token(s) with NO `--color-*` mapping in its `@theme inline` block:
  --edge: oklch(26.7% 0.015 124.2 / 0.38)

An unregistered family emits NO CSS: a consumer reaching for bg-edge / text-edge / border-edge gets
nothing, with no build error and no console warning. ...
```

**No proof edit leaked.** `git diff --stat 845c7ab -- globals.css chat/ token-registration.test.ts`
after every revert: **empty**.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | **77 files / 916 passed**, 2 skipped — baseline 76/910 + this plan's 6, **zero regressions** |
| `npx vitest run src/app/__tests__/` (token gates, before AND after the globals.css edit) | 5/289 before → **6/295 after** |
| `npm run test:geometry` | **3 passed**, after every structural edit |
| `npm run build:local` | clean |
| `npm run screenshot:review` | 37 files, both themes; `chat-thread` desktop `select:ok` + `settled` in both |
| §F comment hazard, **scoped to the four parsed blocks** | 0 token-colon, 0 stray-close |
| every new class + rule EMITTED in built CSS | **22/22 by exact escaped selector** |
| all 9 registrations emit real utilities | **9/9**, with 2 working negative controls |

**Emitted-CSS proofs.** Respecting the trap (`head -1` picks a 1.3KB sheet over the real one; `grep -c`
counts *lines* on minified CSS): I concatenated **all five** sheets (largest 115,574 B; 144,015 B
total) and matched exact escaped selectors in Python.

```
.rounded-card{border-radius:var(--radius-card)          .bg-bright{background-color:var(--bright)
.border-rule{border-color:var(--rule)                   .rounded-none{border-radius:0
.text-2xs{font-size:var(--text-2xs)                     .text-pencil{color:var(--pencil)
--xy-handle-background-color:var(--ink)                 --xy-handle-border-color:var(--bright)
--xy-background-pattern-color:var(--grid)               --xy-edge-stroke:var(--edge)
--xy-controls-box-shadow:none                           --xy-controls-button-background-color:transparent
--xy-minimap-background-color:var(--leaf)               --xy-selection-background-color:var(--ink-08)
.react-flow__attribution a{color:var(--pencil)!important
.react-flow__controls-button svg{fill:var(--foreground)!important
.react-flow__node.selectable:focus-visible{outline-offset:2px;outline:2px solid var(--ink)!important
```

The focus rule initially read as MISSING — **the minifier had reordered the declarations**, not
dropped them. A naive check would have reported a false PURGE on correct CSS; a naive *fix* would
have chased a live rule.

**The nine registrations**, each proven through a real consumer (a throwaway file, since `@theme
inline` emits a utility **only on use** — a registration cannot be proven by grepping for the token):

```
.bg-bad-hi{background-color:var(--bad-hi)        .bg-ink-05{background-color:var(--ink-05)
.bg-ink-08{background-color:var(--ink-08)        .bg-ink-14{background-color:var(--ink-14)
.stroke-edge{stroke:var(--edge)                  .bg-grid{background-color:var(--grid)
.hover\:bg-fill-hi:hover{background-color:var(--fill-hi)
.bg-shimmer{background-color:var(--shimmer)
.hover\:border-rule-hi:hover{border-color:var(--rule-hi)

negative controls: .bg-notatoken{ -> absent (correct)   .bg-edge-hi{ -> absent (correct)
```

The throwaway consumer was deleted before the final commit.

## What I SAW

**The canvas, in a real browser, both themes, at 100% zoom — plus 4x crops of the bare board.**

- **Dark, before:** a **glaring white brick** bottom-right (the minimap) and a **white strip**
  bottom-left (the controls) whose glyphs were white-on-white, on an otherwise correct dark board.
  **Light, before:** both blend into the parchment and look like cards. *That is why this survived —
  the bug only shows in the theme nobody had ever photographed.*
- **After:** both are dark `--leaf`/`--bright` cards with `--rule` hairlines and legible ink glyphs.
  The top-right cluster reads as one designed card instead of three floating ghosts.
- **The grid:** a 4x crop of an empty board region was **blank parchment** at `size={1}` — in both
  themes. At `size={2}` it is the sketch's board: a calm, quiet 22px dot field that reads as a
  working surface without competing with anything on it. Correct in both themes.
- **The edge:** ink wire, and its arrowhead now `--edge` instead of stock grey.
- **`/knowledge`:** the same white bricks, before and after, in committed captures.

**What still looks wrong, said plainly:**

1. **The wire and its arrowhead disagree.** The path is `!stroke-primary` — **ink at 2px**; the
   arrowhead is now `--edge`. Both are hueless and on-identity, so this is a weight mismatch, not a
   law-1 problem, and it is strictly better than the ink-wire/stock-grey mismatch it replaces. I did
   not close it because **`data-edge.tsx` is 61-06's file** and the plan fences it explicitly. The
   sketch's neutral edge is `--edge` at **1.5px** (`.e-neutral`), which makes the pair agree in one
   line. The ink is not a design choice — it is `--primary`'s indirection surviving from before the
   identity, kept alive by a `!` that exists to win a *layer* fight. **61-06: make the path `--edge`
   at 1.5 and it matches the sketch, the marker, and the decision.**
2. **The keyboard-hint bar** spans the board's full width and overlaps both the Controls card and the
   minimap, still wearing `bg-background/95` (D-61-05-B).

## The CANVAS still has no committed capture — say it rather than claim it unseen

You asked me to use the new `chat-thread` surface and to say so if the canvas needs its own capture.
**It does.** `chat-thread` selects a conversation but leaves the header toggle on **Chat**, and the
canvas only mounts on **Canvas** — so both `chat-thread` desktop PNGs show 61-04's transcript
(correctly, `select:ok`), and **the board appears in no committed capture at all**.

Every visual claim above rests on a throwaway probe, exactly as 61-04's did. That is survivable for
*this* plan — the probe measured computed styles and I have the before/after numbers — but **61-06
owns `data-edge.tsx` and all four node components**, i.e. it redesigns the same invisible surface
next wave.

**The recipe is ~30 lines and I ran it working**; it is written out in `deferred-items.md`
(D-61-05-A) with the three traps: seed `chat_canvas_layouts` directly (**never** via
`saveCanvasLayout` — T-61-21), pin `node_registry_version` to `NODE_REGISTRY_VERSION` or the nodes
degrade to placeholders, and **seed `zoom: 1`** — at 0.75 the grid is sub-pixel and unjudgeable,
which is how I nearly mis-read it myself.

## Success criteria

- [x] **Every visible piece of React Flow chrome is polytoken's — including the handles.** And four
      more nobody had named: the controls' fill, the minimap's fill, the attribution, and a blue
      selection wash. Distinct in SUBSTANCE, not just token names: the previous block **did not
      apply**.
- [x] **"Zero stock React Flow default styling remaining" is a passing test that reads the library's
      own stylesheet** — with an empty allowlist, a documented visible-vs-mechanics constant, two
      vacuity guards proven load-bearing, and a stated blind spot.
- [x] **A future `@xyflow/react` upgrade that ships new default chrome goes red in CI** — proven by
      removing an override (RED, names the selector) and by moving the stylesheet (RED, guards fire).
- [x] **The board is the sketch's working surface, with the identity's own exception cited in place**
      — and at the sketch's real dot size, which is the difference between a grid and a blank field.

**ROADMAP criterion 2 is NOT fully met by this plan, and I am not claiming it.** It reads: *"The
canvas chrome (controls, minimap, background, **node shells**) matches the new identity end-to-end,
with zero stock React Flow default styling remaining."* This plan delivers the controls, the minimap,
the background, and the **"zero stock styling"** clause — made executable and proven able to fail.
**The node shells are 61-06's**, and so is the wire. SURF-02 stays Pending (61-06, 61-08 also carry
it), exactly as 61-04 left it.

## Notes for later plans

- **61-06: your wire is the last mismatch on the board.** Path = ink at 2px, arrowhead = `--edge`.
  The sketch says `--edge` at 1.5. The `!` in `!stroke-primary` is a **cascade-layer** workaround,
  not specificity — if you restyle the path, keep the `!` (or set `--xy-edge-stroke`, which is now
  themed and needs no `!` at all).
- **61-06: `stroke-edge` now exists and emits.** Stop reaching through `!stroke-primary`'s
  indirection if you can say the token.
- **61-06: the canvas is invisible to the harness** (D-61-05-A) — the recipe is written and proven.
  You are about to redesign four node components nobody can see.
- **61-06: `canvas-keyboard-hint.tsx`** is the last `bg-background/95` in `_canvas/` (D-61-05-B).
- **Anyone touching globals.css: a layered rule cannot override this library.** The block's header
  says it at length. Use `--xy-*`; reach for `!important` only for a stock literal with no variable.
- **Anyone adding a palette token:** the registration gate is derived now. Declare a raw oklch in
  `:root` without a `--color-*` mapping and you are red immediately, by name.
- **Phase 62: `/knowledge`'s canvas chrome visibly changed and it is a fix** — before/after PNGs
  cited above. Its own components are untouched.

## Self-Check: PASSED

```
FOUND: apps/web/src/app/__tests__/react-flow-stock-ban.test.ts
FOUND: apps/web/src/app/chat/_canvas/canvas-panel-button-class.ts
FOUND: apps/web/src/app/globals.css
FOUND: apps/web/src/app/__tests__/token-registration.test.ts
FOUND: apps/web/src/app/chat/_canvas/chat-canvas.tsx
FOUND: apps/web/src/app/chat/_canvas/add-email-thread-popover.tsx
FOUND: apps/web/src/app/chat/_canvas/add-knowledge-preview-popover.tsx
FOUND: apps/web/src/app/chat/_canvas/save-status-indicator.tsx
```
Commits verified in `git log`: `d3b7106`, `845c7ab`, `26d0493`.

**No stubs.** No `TODO`/`FIXME`/placeholder introduced. Every temporary artifact used to prove a
claim (the canvas probe spec, its config, the registration-emission consumer) was **deleted** before
the final commit; nothing was written to a non-ISO dir under `.planning/ui-reviews/` (D-61-01).

**Threat model compliance:** **T-61-14** — the gate parses the SHIPPED stylesheet resolved through
the real dependency's export map, asserts the path lives in `node_modules` (a vendored copy fails the
test by name), and carries vacuity guards; no static list, no pinned version directory. **T-61-15** —
`minZoom={0.1}`/`maxZoom={2}` and the MiniMap's session-only mount are byte-identical; the grid's dot
count per frame is unchanged (only its diameter and 16→22px gap changed, which *reduces* dots per
frame). **T-61-16** — the attribution is restyled and still visible; `proOptions={{ hideAttribution:
false }}` untouched, no `display: none` anywhere in the block, and the gate would report the
attribution's own selectors if they were ever left stock. **T-61-SC** — no packages installed, and
`@xyflow/react` is deliberately NOT upgraded (an upgrade would change the very stylesheet the gate
parses, conflating two changes in one commit). **T-61-21** — `saveCanvasLayout` was never called,
read, or modified; the probe seeded `chat_canvas_layouts` directly as a test fixture and the probe is
deleted.

**Threat flags:** none. No network, auth, file or schema boundary touched — this plan edits a
stylesheet, four client components, and adds two test/constant modules.
