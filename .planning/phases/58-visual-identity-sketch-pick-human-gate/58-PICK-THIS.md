# Pick a direction — the v1.10 human gate

**Status:** ⏸ WAITING ON YOU. This is the one gate autonomous execution cannot pass.
**Blocks:** Phases 59–63 (identity tokens → inbox → chat/canvas → knowledge → the research-canvas UI).
**Time needed:** ~15 minutes.

---

## Why this exists

Your verdict on the v1.9 app was *"the whole UI is still ugly/experimental, not a production UI —
not just tokens and colors."* Backlog 999.18's own scope item (d) is the fix: **a design-review
loop with the user on real screens BEFORE cascading**, because an autonomous run cannot make taste
decisions. It can build anything, but it cannot know what you want the product to *feel* like.

So: three directions, built on your actual screens with your actual content. Identity is the only
variable — all three render the identical `sketches/CONTENT-SPEC.md` (inbox, chat + canvas,
knowledge, components strip). Whatever you pick propagates through the token system to every
surface, and the rest of the milestone runs without you.

---

## How to look

Open all three in a browser (they're self-contained — no server, no build):

```
.planning/phases/58-visual-identity-sketch-pick-human-gate/sketches/direction-a.html
.planning/phases/58-visual-identity-sketch-pick-human-gate/sketches/direction-b.html
.planning/phases/58-visual-identity-sketch-pick-human-gate/sketches/direction-c.html
```

On Windows, from the repo root:

```powershell
ii .planning\phases\58-visual-identity-sketch-pick-human-gate\sketches\direction-a.html
```

Each has a top bar with anchor nav — walk all four sections. Compare the **same screen** across
the three files (all three inboxes, then all three canvases) rather than reading each file
top-to-bottom; the differences show up much faster that way.

`58-SKETCH-REVIEW.md` (next to this file) has an adversarial review with rendered screenshots —
distinctness, consistency, bans, production-grade — and an honest cost for each. It deliberately
makes **no recommendation**. This is your call, not mine.

---

## The three

| | **A — Provenance** | **B — Threadwork** | **C — Quiet Precision** |
|---|---|---|---|
| **Thesis** | Every fact has a source | Everything connects | The instrument you trust |
| **Ground** | Warm archival paper | Light cool paper-white | Warm graphite (dark-first) |
| **Color does** | Tier ladder IS the palette — verdigris = confirmed, pencil-amber = suggested | A hue family per content type (people / companies / amounts / documents) | Nothing, except signal — your data is the only color |
| **Type** | Chrome speaks sans, **evidence speaks serif** | Rounded humanist throughout, mono for identifiers | Condensed utility labels, tabular numerals everywhere |
| **Signature** | The provenance mark — an OCR-polygon-derived highlight on every extracted fact | The threadline — a connector motif wherever things relate | The tier meter — a two-segment confidence bar on every item |
| **Density** | Calm, registry rhythm | Airy, soft, tactile | Comfortably dense — most rows visible |
| **Commits you to** | A serif in the product; provenance as the dominant visual idea | A multi-hue system that must stay disciplined | Dark-first, and making long email text comfortable to read |

---

## How to record it

Just say which one — e.g. **"go with B"**, or **"B but the dark ground from C"**. Hybrids are
fine and expected; that's what a design review is for. If none of them land, say what's wrong and
I'll sketch another round — that's cheaper now than after it cascades.

Once you pick, I'll:
1. Write `58-IDENTITY.md` — the locked token system (palette in oklch, type scale, spacing,
   signature spec) derived from your choice.
2. Port it into `apps/web/src/app/globals.css`'s `@theme` blocks (Tailwind v4 / oklch — Phase 55
   already migrated the stack for exactly this).
3. Run Phases 59–63 autonomously against the locked identity, with the WCAG-AA contrast gate and
   the palette-ban gate as rails.

---

## What's already done, waiting on this

- **Phase 55 — Platform Migration** ✅ verified 4/4. Tailwind v4 + oklch + React 19; the token
  gates rewritten to be oklch-aware and *proven able to fail*.
- **Phase 56 — Research Canvas backend** ✅ 5/5 plans. Auto-collected source ledger (no capture
  ceremony), `chat_context_edges` as a real semantic store (not canvas sharedState, per D-54),
  edges-as-context injection, promotion reachable with zero new promotion code.
- **Phase 57 — Email Learning Loop** ✅ 3/3 plans. Corrections captured as structured records;
  entity-type few-shot; the dead `was_dismissed` flag finally consumed. All suggest-only.

Every palette-independent thing is built. Everything visual is behind this door.

---

*Gate opened 2026-07-15. Phases 59–63 do not start until it closes.*
