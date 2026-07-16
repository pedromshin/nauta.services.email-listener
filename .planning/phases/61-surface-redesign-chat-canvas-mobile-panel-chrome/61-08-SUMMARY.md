---
phase: 61-surface-redesign-chat-canvas-mobile-panel-chrome
plan: 08
subsystem: chat-transcript-panel-toolbar-mobile-and-role-hue-ratchet
tags: [chat, canvas, panel-toolbar, mobile, touch-target, SURF-07, SURF-02, 999.17, criterion-3, role-hue-ban, ratchet, law-1, dead-string, tailwind-v4]
requires:
  - "61-07's TranscriptPanelHost + useIsTranscriptPanelHost() — the marker this plan's toolbar mounts on"
  - "61-07's T-61-21 round-trip mechanism (the restored layout IS the live state) — inherited, not re-derived"
  - "52-02's PanelActionsToolbar + its five controls — mounted verbatim, zero new controls"
  - "61-06's sweep of chat/_canvas/ (verified clear, not trusted) + canvas-node-shell-class/canvas-vocabulary"
  - "61-01's screenshot theme axis + test:geometry; 61-05's chat-canvas surface"
provides:
  - "criterion 3 / SURF-07's write half: the four editing controls reachable AND operable at 390px on a touch pointer"
  - "transcript-panel-toolbar.test.tsx — the mount gate (10 assertions), red-proven against store-presence gating"
  - "3 rendered touch-target measurements in test:geometry (hasTouch/isMobile), red-proven at 24x24px"
  - "the role-hue ratchet advanced over chat/ + _vocabulary — after clearing 11 real violations"
  - "@utility touch-target — D-48-07's 44px floor now EMITS for the first time (4 call sites repaired at the root)"
  - "61-SCREENSHOT-REVIEW.md — both themes reviewed, PROVEN/UNPROVEN per claim"
  - "brand-guide §3 + SKILL.md carrying Phase 61's realized patterns to Phases 62-63"
affects:
  - "Phase 62 (appends knowledge/ + entities/ to SCOPED_DIRS — the ratchet's next step)"
  - "Phase 62/63 (D-61-07-A: genui packs are light-only — still a packages/genui product decision)"
  - "anyone adding a custom Tailwind utility (@utility, never @layer utilities — or every variant of it dies silently)"
tech-stack:
  added: []
  patterns:
    - "a class STRING gate cannot see EMISSION — pair it with the thing that makes the string real"
    - "@layer utilities is plain CSS Tailwind never learns the name of, so no variant can compose onto it"
    - "pointer-coarse: is keyed on pointer CAPABILITY, not width — a 390px viewport test proves nothing about a phone"
    - "a marker beats store presence when two trees legitimately hold the same providers"
    - "readiness in VALUES not SHAPE, applied one level down: {cond && <X/>} keeps its slot, so siblings never remount"
    - "chrome must sit OUTSIDE a theme scope that injects a pack's palette — inside it, chrome inherits light-only"
key-files:
  created:
    - apps/web/src/app/chat/_components/__tests__/transcript-panel-toolbar.test.tsx
    - .planning/phases/61-surface-redesign-chat-canvas-mobile-panel-chrome/artifacts/61-SCREENSHOT-REVIEW.md
  modified:
    - apps/web/src/app/globals.css
    - apps/web/src/app/chat/_components/message-turn.tsx
    - apps/web/src/app/chat/_canvas/panel-actions-toolbar.tsx
    - apps/web/src/app/__tests__/role-hue-ban.test.ts
    - apps/web/src/app/chat/_canvas/__tests__/touch-target-pointer-coarse.test.tsx
    - apps/web/src/app/chat/_components/__tests__/transcript-overlay.test.tsx
    - apps/web/src/app/chat/_components/inline-error-card.tsx
    - apps/web/src/app/chat/_components/cost-cap-blocked-card.tsx
    - apps/web/src/app/chat/_components/interactive-widget-boundary.tsx
    - apps/web/src/app/chat/_components/model-picker-entry.tsx
    - apps/web/src/app/chat/_components/thread-cluster-indicator.tsx
    - apps/web/e2e/surface-geometry.spec.ts
    - docs/design/brand-guide.md
    - .claude/skills/polytoken-design-system/SKILL.md
decisions:
  - "D-61-08-1: `touch-target` moved from `@layer utilities` to `@utility`. A hand-written @layer rule is plain CSS Tailwind never learns the NAME of, so it cannot compose a variant onto it — and every consumer reaches this guard exclusively as `pointer-coarse:touch-target`. The 44px WCAG floor emitted NOTHING for three milestones, on all four call sites, under a green class-string gate."
  - "D-61-08-2: the toolbar mounts on 61-07's MARKER. Red-proven: store-presence gating grows a second toolbar on the canvas's ChatNode AND crashes on first paint (the host always provides a placeholder store, so presence is true while persistence is still null)."
  - "D-61-08-3: chrome sits OUTSIDE PanelThemeScope, mirroring GenuiPanelNode. The scope injects the pack's palette and packs have no dark variants (D-61-07-A), so a toolbar inside it would be a light strip on a dark app. Visible in chat-thread-desktop-dark.png: dark toolbar, white pack card."
  - "D-61-08-4: ONE SHAPE, ALWAYS — D-61-07-2 applied one level down. Only the toolbar's presence flips; `{cond && <X/>}` holds its slot, so PanelThemeScope never changes position or type and the rendered spec is never remounted when the layout query settles (which would discard a genui form mid-edit, on every mount)."
  - "D-61-08-5: `variant=\"bare\"` + an app-token card. The card IS the panel's bordering layer now, so GenuiCard would be a second border inside it — the triple-nesting 23-UI-REVIEW removed on the canvas and left standing here only because nothing had ever framed a docked panel."
  - "D-61-08-6: criterion 3 is measured with hasTouch/isMobile, NOT a 390px viewport. `pointer-coarse:` keys on pointer CAPABILITY, and that is correct — a mouse-driven 390px window can hit 24px and gets the compact chrome by design. A width-only test would measure 24px, be right to, and prove nothing about a phone."
  - "D-61-08-7: SCOPED_DIRS gains `chat` + `_vocabulary` only AFTER clearing 11 real violations. The append is the last step of a sweep; a root appended while red is how a ratchet gets allowlisted into meaninglessness within a week — the gate's own header names that failure mode."
  - "D-61-08-8: the canvas fixture was NOT re-tuned for D-61-07-C. The genui node's min-height is 272px vs ~238px of free board at the tuned viewport, so framing it means re-tuning positions 61-05/61-06 measured painfully and whose comment records that a bad one 'reads as a node-layout bug'. Marginal frame, real risk — declined with the measurement."
metrics:
  duration: ~185 min
  completed: 2026-07-16
  tasks: 3 (2 auto + 1 checkpoint)
  commits: 5
  tests_added: 13 (10 unit + 3 rendered)
---

# Phase 61 Plan 08: The Toolbar Reaches the Phone, and the Ratchet Closes Over chat/ — Summary

Closed **criterion 3** / SURF-07's write half — the four editing controls (pack switch, param edit,
regenerate, re-theme) are now reachable **and operable** on a phone, where the canvas cannot mount at
all — advanced the role-hue ratchet over `chat/` after clearing 11 real violations, and reviewed both
themes on real pixels for the first time in this project's history.

**Zero new controls were built.** The only thing ever wrong was where they lived.

**And criterion 3 would have shipped broken.** The 44px touch floor those controls depend on had
**never applied, anywhere, for three milestones** — a dead class string under a green gate. Found by
measuring the built stylesheet, not by reading the source.

## What Shipped

| Task | Commit | What |
|------|--------|------|
| 1 (pre) | `7551130` | **fix: `touch-target` emitted nothing** — `@layer utilities` is not variant-composable |
| 1 | `ff0126e` | the toolbar mounts in the docked transcript on 61-07's marker — criterion 3 |
| 2 | `46a3d3b` | swept `chat/_components`'s 11 violations, then advanced `SCOPED_DIRS` |
| 1 | `e4076fc` | criterion 3 **measured** on a real touch device (3 rendered assertions) |
| 3 | `52d205c` | the review + Phase 61's patterns carried to brand-guide/SKILL.md |

## THE FINDING: D-48-07's 44px floor never applied to anything, ever

`PANEL_ACTION_ICON_BUTTON_CLASS` is `size-6` (24px) + `pointer-coarse:touch-target`. The second half
was a **dead string**.

`touch-target` was declared as `@layer utilities { .touch-target { … } }` — plain CSS that Tailwind
copies through **without learning the name**. So the bare class worked, and **every variant of it
emitted nothing**. Every consumer reaches this guard *exclusively* through a variant.

Measured in the running sheet, before and after — not argued:

```
BEFORE — the app's only two @media (pointer: coarse) blocks, in 158KB of CSS:
  @media (pointer: coarse) { width: calc(var(--spacing) * 11); height: calc(var(--spacing) * 11); }
  @media (pointer: coarse) { height: calc(var(--spacing) * 11); }
  min-height rule anywhere: NONE

AFTER (@utility touch-target):
  @media (pointer: coarse) { min-height: 44px; min-width: 44px; }   <- a third block
```

And in a real **production** build (`.next-verify`), the escaped selector exists:

```css
@media (pointer:coarse){ … .pointer-coarse\:touch-target{min-width:44px;min-height:44px} }
```

**The red proof, in a browser, against the state that shipped for three milestones:**

```
Error: 'Edit parameters' renders 24x24px on a touch device — below the 44px floor
(WCAG 2.5.8 / D-48-07). "Reachable" means operable with a thumb, not merely
present in the DOM.
```

So Phase 53's touch sweep **half-applied**: `pointer-coarse:h-11` worked (a real utility — which is
why `Style pack` passed even while broken), and the `touch-target` half was dead on **all four** call
sites. Without this fix, this plan would have declared criterion 3 closed with **24px** thumb targets.

**Why it survived**: `touch-target-pointer-coarse.test.tsx` asserted the class STRING and was green
throughout — its own header called that "the correct, and only testable, contract at this layer". It
is honest about its layer and **wrong about its sufficiency**. It now also pins the `@utility`
declaration, red-proven against the old form, where its other **5 string assertions stayed green** —
which is the whole indictment.

Fixed at the ROOT (one line), so all four call sites are repaired at once with no call-site churn
(D-61-08-B logs the other three).

## Criterion 3 — reachable AND operable

**The mount** (`ff0126e`): `TranscriptGenuiPanel` mounts the REAL `PanelActionsToolbar`, gated on
`useIsTranscriptPanelHost()`. Props derived exactly as `GenuiPanelNode` does — `panelId` from
`genuiPanelNodeId(messageId, partIndex)`, provenance `{ messageId, partIndex, runId: null }` (the
identical shape `reconcileNodesFromHistory` puts in the node's data, so both surfaces address the
same panel by construction), the resolved spec/pack, and the real `isStreaming`.

### The marker — red-proven, and it fails TWICE

The naive wiring (`useOptionalCanvasStore() !== null`), against the committed gate:

```
× (b) ON THE CANVAS, inside a real ChatNode — grows NO second toolbar
  → expected [ <div role="toolbar" …(2)>…(2)</div> ] to have a length of +0 but got 1

× ...7 others
  → usePanelOverlay must be used inside a CanvasPersistenceProvider (canvas host wiring)
```

1. **A second toolbar on the board.** Both trees hold the store and the persistence context, so
   store presence cannot tell them apart — exactly as 61-07 predicted.
2. **The first-paint crash.** Sharper than expected, and it is 61-07's own fix that makes it certain:
   the host *always* provides a store (a placeholder pre-restore, so the tree keeps one shape), so
   store-presence is **true** while persistence is still `null` — the controls mount before they can
   possibly work and throw on every mount's first render.

The marker is the only discriminator right on both counts. **Not a viewport check** either: criterion
3 says "can reach" on mobile, not "only on mobile", and the desktop docked view gets editing free.

### Operability — measured, because a touch target is a rendered box

`npm run test:geometry` (3 → **6 passed**) now drives the **real mobile transcript** at 390×844 with
`hasTouch`+`isMobile`, real auth, and a real seeded genui panel:

| Measurement | Result |
|---|---|
| `(pointer: coarse)` actually matches | asserted FIRST — the suite cannot pass vacuously |
| 4/4 controls reachable | pass |
| 4/4 ≥ 44×44px | pass (**24×24px** before `7551130`) |
| pack dropdown opens, options on-screen + tappable | pass |
| Edit-params popover opens, stays on-screen (`w-80`=320px vs 390px) | pass |

**`hasTouch`, not a 390px viewport** (D-61-08-6): `pointer-coarse:` keys on pointer CAPABILITY, which
is correct — a mouse-driven 390px window can hit 24px fine and *should* get the compact chrome. A
width-only test would measure 24px, be right to, and prove nothing about a phone.

**The mobile rail, and the warning I did not violate**: `prepareChat` in the geometry gate **already**
opens the overlay Sheet and selects a conversation at 390px, and passes. The "NO TOGGLE CLICKING …
so the third person does not try a fourth" warning is the *screenshot harness's*, about its own
capture loop — and that same header asks for exactly what I did: "that surface is SURF-07's, and it
should capture it on its own terms rather than have this harness guess."

## The ratchet — 11 violations cleared first

`chat/` was **red on arrival**, measured with the gate's own patterns (never trusted from
D-61-04-B/D-61-06-D):

| Family | Count | Files |
|---|---|---|
| madder on a STATE | 10 | `cost-cap-blocked-card` (3), `inline-error-card` (4 — **one a COMMENT citing the literal**, trap 1 live), `interactive-widget-boundary` (2), `model-picker-entry` (1) |
| retired role hue | 1 | `thread-cluster-indicator` |

Every one a **state talking** — errors, a failed widget submit, a WebGPU capability warning — so
every one was **swept, not allowlisted**. `chat/_canvas/` was verified clear (61-06's claim
confirmed by measurement, not trusted); `_vocabulary` was born clean (2 files, non-vacuous).

The swept treatment is the one Phase 60 and 61-06 landed on **independently**: an error is
`border-rule` + `text-ink`, the glyph carries the role (shape survives greyscale), `role="alert"`
carries it accessibly, `p-panel` is the named step. The retired role hue already resolved to
`--pencil`, so naming `--pencil` directly **changes no pixel** — it removes a colour key that had
stopped distinguishing anything.

**THE READ — the half no gate can see.** The fill-vs-text rule is a PROXY for intent; 60-06 found
`<Badge variant="destructive">Preview failed</Badge>` passing it while violating law 1. Every
allowed-by-the-gate occurrence in `chat/`:

| Occurrence | Judgement |
|---|---|
| `delete-conversation-dialog.tsx:60` — `bg-destructive` + paired foreground | **GENUINE.** An `AlertDialogAction` labelled "Delete", `aria-label="Confirm conversation delete"`, in a dialog whose own copy reads *"This permanently deletes all messages… This can't be undone."* Exactly what the irreversible colour is reserved for. **No change.** |

**1 of 1 checked by reading. No badge-shaped violation in `chat/`.** Two further hits are prose in
`__tests__` citing 60-06's badge; they survive the widened walk because `ROLE_HUE_PATTERN` requires
a colour-utility PREFIX (trap 2) — **verified by running the full suite**, not assumed.

`SCOPED_DIRS` = `["_components", "emails/[id]", "chat", "_vocabulary"]`. No root removed.
`ALLOWLIST` still **empty**. The pinning test asserts all four and is honestly renamed; a new
invariant test states the ratchet outright. The header no longer claims `chat/` is unswept and still
names `knowledge/`/`entities/` as Phase 62's.

**The vacuity test was VERIFIED, not assumed** (the plan asked): red-proven both ways on the NEW
roots — a missing root (`scoped root is missing: chat/does-not-exist`) and an existing root walking
to zero files (`scoped root walks to zero files: _vacuity-probe`).

## What I SAW

`npm run screenshot:review` — **40 PNGs, both themes**, all `settled`, ISO-filtered (D-61-01).
Run: `.planning/ui-reviews/2026-07-16T07-20-21-279Z/`. Full verdict:
`artifacts/61-SCREENSHOT-REVIEW.md`.

**Liveness proven before any frame was read** (§G): `.next/BUILD_ID` absent, `layout.css` → 200 /
157,979 bytes containing the rule I had just added, geometry gate green, and the dark `chat-thread`
frames show the toggle on **Chat** (so 61-07's D-61-07-B localStorage bleed does not recur — the
brief's warning, checked).

1. **The toolbar is there, in both themes** — "Polytoken Teal" + four icon buttons on the panel in
   the docked transcript. First time these controls have rendered outside a React Flow node.
2. **The no-second-toolbar claim is visible on ONE screen** (`chat-canvas-desktop-*`): the ChatNode's
   transcript renders the panel with **no** toolbar while the `GenuiPanelNode` beside it has one.
   The picture of the bug not happening.
3. **Dark mode validated the chrome/content boundary.** The toolbar row is graphite on the app's ink;
   the pack card below it is white. Previously the transcript's panel was wrapped by `GenuiCard`
   *inside* `PanelThemeScope`, so its border was the PACK's light `--border` — a light rectangle
   floating on the dark app (compare `06-24-06-201Z/chat-thread-desktop-dark.png`). **This is why the
   toolbar had to mount outside the theme scope**: inside it, it would be a light strip.
4. **Law 2's clearest worked example, on one screen**: the ChatNode's title (sans — polytoken's own
   label) beside the EmailThreadNode's subject (serif + `data-evidence` — the mail's own words). Same
   size, same weight, adjacent cards; the only difference is where the words came from.
5. **I looked at a handle** (criterion 2): ink-toned and small, not the stock navy dot with a white
   border. Dot grid, Controls card, hint card, and the React Flow attribution (D-61-06-B) all read as
   polytoken.

**What I did NOT see, said plainly:**
- **No mobile photograph of the transcript.** `chat-thread-mobile-*` is the empty state
  (`select:n/a-overlay-rail`) — **D-61-07-D stands**. Mobile is covered by *mechanism* (identical
  docked branch — there is no mobile-specific transcript code) plus the three touch-emulated
  measurements above, which for "operable" are stronger than a picture. Said as mechanism, not
  dressed up as a photograph.
- **No selected node** (D-61-06-A, unchanged).
- **The genui panel node is still clipped** (D-61-07-C) — declined with a measurement, see below.
- **999.25 is live**: no `--sugg` anywhere is the FIXTURE, not the redesign. Not reported as a gap,
  not fixed.

## Per-File Changes

**`globals.css`** — `@layer utilities { .touch-target }` → `@utility touch-target`. One line; repairs
four call sites. The comment records the measurement so the next reader does not re-derive it.

**`message-turn.tsx`** — `TranscriptGenuiPanel` takes `messageId`+`partIndex` (was a pre-computed
`panelId`) so it can build the canvas's identical provenance; mounts the real toolbar on the marker;
one `GeneratingRing` driven by `isStreaming || generating` on the element that owns the radius (the
streaming branch's outer ring is gone — its `rounded-lg` would have painted around a `rounded-card`
edge); `variant="bare"` inside an app-token card. Every other part branch untouched.

**`panel-actions-toolbar.tsx`** — onto the card language: `border-border/60 bg-background` →
`border-b border-hair`, no fill. Phase 52 wrote that before the identity existed, and `--background`
resolves to `--shelf` (the PAGE ground), so the row painted the page's tone across the middle of a
`--bright` card **on both surfaces**. It now agrees with `GenuiPanelNode`'s `.ch` header row
directly above it. Lock, aria contract, `onGeneratingChange` and every control's props: untouched.

**The five swept files** — madder → ink on a rule; the retired role hue → `--pencil` (no pixel
changes). Each carries the reasoning, not just the class.

**`surface-geometry.spec.ts`** — the criterion-3 describe (3 rendered measurements);
`prepareChat` gains an **opt-in, default-off** `withGenuiPanel` so the three existing tests measure
exactly the surface they always did. Fixture mirrors `screenshot-fixtures.ts`'s part deliberately —
a gate measuring a different panel than the photographs show answers a question nobody asked.

**`transcript-overlay.test.tsx`** — the tRPC mock learns `genui.*` + `chat.getHistory`. **Evidence,
not a chore**: it died on `Cannot read properties of undefined (reading 'applyPanelEdit')` because
the transcript now really mounts the real controls — the same shape as 61-07's `chat-mobile-feed`
mock having to learn `getCanvasLayout`.

## Deviations from Plan

**1. [Rule 1 — fixed] `touch-target` emitted nothing** (`7551130`). Not in the plan; found by
measuring the built sheet while checking the plan's own "check the four icon buttons against the
floor at 390px" instruction. It is the reason criterion 3 is real rather than nominal. Touches
`globals.css` and `touch-target-pointer-coarse.test.tsx`, both outside `files_modified`.

**2. [Rule 2 — added] 3 rendered touch-target measurements in `test:geometry`.** The plan's Task 1
requires the floor be "checked as OPERABLE at 390px and the finding recorded". jsdom does no layout
and the existing gate is a class-string gate, so nothing that existed could check it. `e2e/` is
outside `files_modified`.

**3. [Rule 2 — added] the `@utility` pin in `touch-target-pointer-coarse.test.tsx`.** A string gate
cannot see emission; without this the fix regresses silently and the suite stays green — exactly the
state it was already in.

**4. [Rule 3 — blocking] `transcript-overlay.test.tsx`'s tRPC mock.** See above.

**5. [Scope — taken] the toolbar's own chrome** (`border-hair`, no fill). The plan sanctions it
("if it did not reach it, bring it onto the card language now"); it affects the canvas too, and it is
an improvement there (the row no longer paints the page's ground across a card).

**6. [Scope — taken] `variant="bare"` + an app-token card** (D-61-08-5). Mounting demands a frame the
toolbar can attach to, and chrome cannot live inside `PanelThemeScope`. Changes the panel's frame in
all three trees — shape-stable and deliberate, reported rather than slipped in.

**7. [Scope — NOT taken] D-61-07-C, the clipped canvas panel node** (D-61-08-8). 61-07 handed it to
this plan. Declined **with the measurement**: the node's `min-height` is 272px and the free board at
the tuned viewport (`{x:380,y:360,zoom:1}`) is ~238px, so framing it means re-tuning positions
61-05/61-06 measured painfully and whose own comment records that a bad one "reads as a node-layout
bug". The panel node's toolbar is legible at the clip in both themes and the same toolbar is fully
visible in the transcript. Marginal frame, real risk.

**8. [Scope — NOT taken] `packs.ts` dark variants** (D-61-07-A). A `packages/genui` product decision
(Rule 4), unchanged from 61-07.

**9. [Scope — NOT taken] the focus-ring `ring-offset-1` on the panel controls.** They carry
`focus-visible:ring-2 ring-ring ring-offset-1`; `--ring` is `var(--ink)` so law 1 holds, but
`--tw-ring-offset-color` defaults to `#fff` — the white-halo hazard D-61-05-6/D-61-03-F name. Not
this plan's (the plan says "do not redesign the controls") and not reachable on the surface criterion
3 is about. Flagged for whoever owns `controls/`.

**10. [Pre-existing] `tsconfig.json` / `next-env.d.ts` churn left unstaged** — D-61-02.

## Negative Proofs — all executed against the COMMITTED tree

**1. `touch-target` reverted to `@layer utilities`** — the one that matters. `test:geometry` RED:
`'Edit parameters' renders 24x24px on a touch device`. The class-string gate's other **5 assertions
stayed green**. Reverted.

**2. The `@utility` pin against the old form** — RED with its own message; 5 passed. Reverted.

**3. Store-presence gating instead of the marker** — RED twice (a second toolbar on the board; the
first-paint crash ×7), verbatim above. Reverted.

**4. The vacuity test on the NEW roots** — RED both ways (missing root; existing-but-empty root).
Reverted; the probe dir removed.

**5. No proof edit leaked.** `git diff --stat HEAD` clean per file after each revert; `0` occurrences
of `NEGATIVE PROOF` left in `message-turn.tsx`; `_vacuity-probe/` gone.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | **80 files / 992 passed**, 2 skipped — baseline 79/980 + this plan's 12, **zero regressions** |
| `npm run test:geometry` | **6 passed** (was 3) at 390 + 1440 |
| **T-61-25** — 61-07's T-61-21 round-trip regression, re-run with the first REAL user-facing caller of that write path mounted | **15/15 green** — not assumed |
| `npm run build:local` (from `apps/web`, D-61-05) | `✓ Compiled successfully in 11.7s` |
| **Production CSS proof** | `.next-verify` contains `@media (pointer:coarse){….pointer-coarse\:touch-target{min-width:44px;min-height:44px}}` — the fix reaches a real build, not just dev |
| `npm run screenshot:review` | 40 PNGs, both themes, all `settled`, hydration proven BEFORE review |
| **T-61-27** — no PNG committed | `git check-ignore` → `.planning/ui-reviews/.gitignore:2:*.png`; **0 tracked PNGs** |
| **T-61-26** — no server change | `git diff --name-only 7551130~1..HEAD -- packages/` → **0 files**; `packages/api-client` untouched |
| xyflow leakage (D-61-07-1) | the toolbar's import graph reaches `@xyflow/react` only via **`import type`** (erased); the UNLAYERED stylesheet is imported solely by `chat-canvas.tsx`/`knowledge-graph.tsx`, both `dynamic(ssr:false)` — **verified by walking 40 modules**, not assumed |

## Threat model compliance

**T-61-25** — mitigated: 61-07's layout round-trip test re-run *because* this plan adds the first
real user-facing caller of `scheduleSave`; 15/15, not assumed to still hold.
**T-61-26** — accepted and verified: zero files under `packages/`. `RethemeControl` reaches Bedrock
through the same `RethemeResolutionSchema` web boundary with the same session — a caller, not a
capability.
**T-61-27** — mitigated: PNGs gitignored and verified with `git check-ignore`; 0 tracked; no
rendered address/token/signed URL pasted into the review.
**T-61-28** — mitigated: the review splits PROVEN/UNPROVEN per claim, names the two things no capture
shows as UNPROVEN, and describes no capture that did not run.
**T-61-SC** — no packages installed.

**Threat flags:** none. No network, auth, file or schema boundary touched.

## Success criteria

- [x] **On a 390px viewport a user can switch a panel's pack, edit its params, regenerate it and
      re-theme it — operably, not just structurally.** Measured on a real touch pointer, red-proven
      at 24×24px without this plan's first commit. 999.17's write half, closed.
- [x] **The canvas's own ChatNode transcript sprouts no second toolbar.** Red-proven, and *visible*
      beside the real panel node's toolbar on one screen.
- [x] **`chat/` is inside the role-hue ban permanently, the ratchet only grew, the allowlist is still
      empty, and the half of law 1 no gate can see was checked by reading** (1 of 1, genuine).
- [x] **Both themes looked at by a human, PROVEN/UNPROVEN per claim** rather than one comfortable
      word.

**SURF-07 → Complete.** It is a two-clause requirement — *"editable-panel chrome is reachable on
mobile AND the docked/mobile transcript honors panel overlays"*. 61-07 closed the second clause and
deliberately left it Pending for this plan to carry the first. Both clauses now hold, and the first
is measured rather than asserted. **999.17 closed.**

**SURF-02 → Complete.** 61-06 left it Pending as the last plan to sweep `chat/`'s chrome would own
it. `/chat` and its canvas are redesigned on the identity across 61-01..61-08, the role-hue ban is
permanent over the surface, and both themes have been reviewed. *The user's aesthetic verdict is the
checkpoint's, not this plan's.*

## Notes for later plans

- **Phase 62: append `knowledge/` + `entities/` to `SCOPED_DIRS` as you sweep.** They are the last
  unswept roots and the only reason the ban is still scoped. Measure first — `chat/` was red with 11
  violations and the append is the LAST step, not the first. And **read** for badge-shaped
  violations: the gate is a proxy that cannot see intent.
- **Anyone adding a Tailwind utility: `@utility`, never `@layer utilities`** — otherwise every
  variant of it dies silently and any class-string gate over it stays green. **Prove it EMITS.**
- **Anything about a rendered box belongs in `test:geometry`, not a unit suite.** jsdom does no
  layout. It now catches height chains, horizontal `display:table` overflow, a React remount, and
  touch targets.
- **D-61-07-A is still open and now visible on two surfaces**: every genui panel is a white card in
  dark. Decide it once for `packages/genui`, not per surface.
- **D-61-08-A**: 60-07's `.next`-corruption tell-tale is over-broad — 2 of its 3 artifacts are normal
  dev output. `BUILD_ID` is the discriminator. Do not `rm -rf .next` on the other two.
- **The strongest liveness proof is not artifact archaeology**: `curl` the linked stylesheet and
  confirm it contains something you just changed.

## Self-Check: PASSED

```
FOUND: apps/web/src/app/chat/_components/__tests__/transcript-panel-toolbar.test.tsx
FOUND: .planning/phases/61-.../artifacts/61-SCREENSHOT-REVIEW.md
FOUND: apps/web/src/app/globals.css                        (@utility touch-target)
FOUND: apps/web/src/app/chat/_components/message-turn.tsx   (PanelActionsToolbar mounted)
FOUND: apps/web/src/app/chat/_canvas/panel-actions-toolbar.tsx
FOUND: apps/web/src/app/__tests__/role-hue-ban.test.ts       (SCOPED_DIRS: 4 roots)
FOUND: apps/web/e2e/surface-geometry.spec.ts                 (criterion 3, 3 measurements)
FOUND: docs/design/brand-guide.md                            (§3 Phases 60-61)
FOUND: .claude/skills/polytoken-design-system/SKILL.md       (theme axis now true)
```
Commits verified in `git log`: `7551130`, `ff0126e`, `46a3d3b`, `e4076fc`, `52d205c`.

**No stubs.** No `TODO`/`FIXME`/placeholder introduced. No scratch dir written under
`.planning/ui-reviews/` (D-61-01). The `_vacuity-probe/` dir created for a negative proof was
removed and verified gone.
