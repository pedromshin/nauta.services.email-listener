---
phase: 58-visual-identity-sketch-pick-human-gate
type: verification
status: passed
score: 4/4
verified: 2026-07-15
requirements: [IDNT-01, IDNT-02]
method: goal-backward against the ROADMAP's 4 success criteria
human_verification: []
deferred:
  - "D-58-03 (entity-type-as-shape) was inferred from the user's colour law rather than instructed — flagged in 58-IDENTITY.md and the PROJECT.md decision row as the one unblessed item. Cheap to revisit in Phase 59, expensive after Phase 62."
  - "Light-theme tier-on-wash contrast has ~0.09 headroom (4.59 vs the 4.5 AA floor). Phase 59 must re-run the WCAG gate against the ported values; any lightness drift breaks it."
---

# Phase 58 Verification — Visual Identity: Sketch & Pick (HUMAN GATE)

**Verdict: passed (4/4).** This phase's completion *is* the gate, and the gate closed on a real
human decision — which is the only way it could legitimately close.

## Criterion 1 — 2–3 distinct visual directions exist as throwaway HTML/CSS renders of real polytoken screens, each internally consistent and visibly different on real content, not swatches

**✅ VERIFIED.** Three self-contained files: `direction-a.html` (Provenance, 1038 lines),
`direction-b.html` (Threadwork, 1068), `direction-c.html` (Quiet Precision, 1140). Each renders
four sections — inbox three-pane, chat + canvas, knowledge, components strip — driven by
`CONTENT-SPEC.md`, which was extracted from the *actual* source files (`inbox-three-pane.tsx`,
`chat/`, `knowledge/`) so the content is real: real thread subjects, real entity chips, real
amounts, real timestamps. Not mood boards; not swatches.

Distinctness was verified **adversarially from rendered pixels**, not source: the judge screenshot
each at 1440 and 1024 and scored all three PASS on distinct / internally consistent / content
fidelity / bans. Content fidelity was checked mechanically — 22 CONTENT-SPEC strings byte-identical
across all three, so identity was provably the only variable.

**One real defect found and fixed:** Direction A FAILED production-grade at 1024 (four inbox columns
held, reading pane crushed to ~90px, subject wrapping one word per line across 7 lines — confirmed
A-specific, since the identical string wraps normally in B and C at the same width). Fixed via a
`@media (max-width:1120px)` right-rail collapse; both viewports re-rendered and visually confirmed
(subject now 2 lines, body a proper paragraph; 1440 unchanged). Review updated FAIL → PASS.

## Criterion 2 — The user has looked at all directions on real screens and explicitly selected exactly one

**✅ VERIFIED.** The user reviewed and selected on 2026-07-15, verbatim:

> "i liked a best but also liked c color concept. we will want light and dark theme and liked the
> idea of using colors meaningfully datafully"

This is an explicit selection of exactly one base direction (A) with a scoped amendment (C's colour
*philosophy*, not its typography/density/signature) — not an abstention, not a "they're all fine."
It is a genuine taste decision made by a human looking at real screens, which is precisely what
this gate exists to obtain and what no autonomous run could have produced.

The selection was realized as `direction-final.html` (both themes, live toggle, Colour Law panel)
so Phase 59 inherits a rendered artifact rather than interpreting prose. Rendered proof:
`preview-final-light.png`, `preview-final-dark.png`, `preview-final-1024.png` — all three read at
full size in their committed state.

## Criterion 3 — The selected direction is recorded in a durable, machine-readable location that Phase 59 onward reads as its locked input

**✅ VERIFIED.** Recorded in two places, both durable and committed:

1. **`58-IDENTITY.md`** — the full contract, YAML frontmatter (`status: LOCKED`, `decision_id:
   D-58-01`, `consumed_by: [59,60,61,62,63]`), the three laws, the signature element, the complete
   12-token oklch ladder for both themes, measured contrast, what it commits the product to, and
   what was explicitly rejected.
2. **`PROJECT.md` → Key Decisions** — a D-58-01 row carrying the verbatim user quote, the rationale,
   and the open items. This is the location the ROADMAP criterion names.

Machine-readable: frontmatter keys are parseable; the token ladder is a table of literal oklch
values Phase 59 ports directly.

## Criterion 4 — No phase after this one has begun planning or execution before the selection was recorded

**✅ VERIFIED.** Phases 59–63 have `disk_status: no_directory` — no phase directory, no CONTEXT, no
PLAN, no code. `roadmap.analyze` confirms. The only phases executed before the pick (55, 56, 57)
are all *upstream* of it by design: 55 is Phase 58's own declared dependency (sketches are built on
the migrated stack), and 56/57 are backend/data-model work with zero visual surface — deliberately
sequenced as the palette-independent work that could proceed while the gate was closed.

Phase 63 (Research Canvas — Visual Surfaces) was explicitly held despite Phase 56's backend landing,
which is the ordering constraint working as written.

## Notes for Phase 59

- **The WCAG gate is load-bearing, not bureaucracy.** Two of Direction A's palette values
  (`--sugg`, `--pencil`) failed AA and were caught only by computing ratios — a design judge looking
  at rendered screenshots did not catch them. Corrected values are canonical in 58-IDENTITY.md.
  Re-run the gate against the ported values.
- **Light tier-on-wash has ~0.09 headroom** (4.59 vs 4.5). Any lightness drift during the port
  breaks it.
- **D-58-03 (shape-not-hue) is the one unblessed inference.** If it is revisited, laws 1 and 2 stand
  regardless.
- `direction-final.html`'s CSS is already shaped as `:root { --token }` + `:root[data-theme="dark"]`
  overrides to mirror `globals.css` — it ports without restructuring. It is a sketch, not the source
  of truth; 58-IDENTITY.md is the contract.
