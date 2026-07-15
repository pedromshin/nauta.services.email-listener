---
phase: 58-visual-identity-sketch-pick-human-gate
type: phase-summary
status: complete
completed: 2026-07-15
requirements: [IDNT-01, IDNT-02]
gate: HUMAN — closed by user pick 2026-07-15
provides:
  - "D-58-01 — the LOCKED visual identity 'Provenance × Meaningful Colour' (58-IDENTITY.md + PROJECT.md Key Decisions), the input Phases 59-63 read"
  - "Three throwaway visual directions rendered on real polytoken screens with identical content (sketches/direction-{a,b,c}.html)"
  - "sketches/direction-final.html — the user-directed synthesis: both themes, live toggle, the Colour Law panel, the full oklch ladder"
  - "sketches/CONTENT-SPEC.md — the shared real-content spec that made identity the only variable"
  - "58-SKETCH-REVIEW.md — adversarial screenshot-based review of all three directions"
affects: [59, 60, 61, 62, 63]
---

# Phase 58 — Visual Identity: Sketch & Pick (HUMAN GATE)

**One-liner:** The user looked at three genuinely distinct identities rendered on their own screens
with their own content, picked one, and the pick is now a locked contract — closing the gate that
999.18(d) exists to enforce.

## What happened

This phase was a blocking human checkpoint by design, and it behaved like one: it stopped, waited,
and only closed when a human made a taste decision no autonomous run could make.

**Built** (`sketches/`): a shared `CONTENT-SPEC.md` extracted from the real inbox / chat+canvas /
knowledge surfaces, then three independent directions rendering it **identically** so that visual
identity was the only variable:

- **A — Provenance:** warm archival paper, the tier ladder as the palette, chrome-sans /
  evidence-serif, the OCR-polygon provenance mark.
- **B — Threadwork:** light and airy, a hue family per content type, the threadline connector as
  the grammar of connection.
- **C — Quiet Precision:** warm-graphite dark-first, data as the only colour, the tier meter.

**Reviewed** (`58-SKETCH-REVIEW.md`): adversarially, from rendered screenshots at 1440 and 1024 —
not from source. All three passed distinctness, consistency, content fidelity, and the bans.
Direction A **failed production-grade** on a real defect: at 1024 it held all four inbox columns,
crushing the reading pane to ~90px and shattering the subject into a one-word-per-line column (B
and C gave ground at the same width). Fixed with a one-line media-query collapse and re-verified by
looking at both viewports — left alone it would have biased the pick against A for a bug rather
than a taste.

**Picked** (user, verbatim): *"i liked a best but also liked c color concept. we will want light
and dark theme and liked the idea of using colors meaningfully datafully"*

**Synthesized** (`direction-final.html`): A's identity governed by C's colour philosophy, both
themes, live toggle, plus a "Colour Law" panel documenting the rule and its measured contrast.

**Locked**: `58-IDENTITY.md` (D-58-01) + a PROJECT.md Key Decisions row.

## Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D-58-01 | Visual identity = "Provenance × Meaningful Colour" | The user's pick. Full contract in 58-IDENTITY.md |
| D-58-02 | Colour is earned, never decorative — chrome is monochrome | The user's "colors meaningfully/datafully". Consequence: A's quiet action accent is **removed**; buttons/links/nav/selection/focus are ink |
| D-58-03 | Entity type is **shape**, never hue | The enabling move for D-58-02 — type surrendered its hues so tier could own colour outright. Survives greyscale + colour-blindness. **Inferred from the user's law, not instructed** — flagged as the one unblessed item |
| D-58-04 | Both themes first-class; semantic hues hold hue+chroma constant, only lightness moves | The oklch payoff Phase 55 bought — the dark theme costs three numbers, not a second design |
| D-58-05 | `--sugg` 54.7%→50.5%, `--pencil` 62.9%→51.0% | **Direction A's originals failed WCAG-AA.** Found only by computing ratios rather than eyeballing |

## Findings worth carrying

1. **A shipped an accessibility bug that a human eye passed.** Two of its palette values failed AA
   and nobody — including the design judge — caught it by looking. Only computation did. Phase 59's
   WCAG gate is not bureaucracy; it is the thing that works.
2. **Rendering caught what reading could not.** The synthesis builder found a dangling `*/` that
   silently swallowed an entire CSS rule (every entity shape vanished), a `date` entity wearing the
   *document* triangle (a lie — there is no sixth shape), and ink type-dots out-shouting the tier
   colour they were meant to defer to. All three were invisible in source and obvious in pixels.
3. **The law had to obey itself.** A runtime audit of all 86 serif elements found exactly one
   violation: the sketch's own manifesto lede. It looked better in serif — and was set back to sans,
   because one exception makes "serif means this came from your mail" unlearnable.
4. **The gate worked as designed.** It blocked, surfaced the decision, and closed only on real human
   input. This is the mechanism v1.9 lacked.

## Deviations

- **No PLAN.md files.** This phase is a human gate, not an implementation phase; its criteria are
  about artifacts existing and a decision being recorded. Executed directly rather than through
  plan-phase.
- **A fourth artifact beyond the ROADMAP's ask.** The spec called for 2–3 directions and a pick; the
  user's pick was a *synthesis* of two, so `direction-final.html` was built to render the actual
  locked identity rather than leaving Phase 59 to interpret prose. Strictly additive.
- **Session limit killed the first sketch run mid-flight.** All three builders had already written
  their files; only their return messages were lost. Files were validated directly (complete,
  well-formed, all four sections) rather than trusting the "failed" status, and the judge re-ran.

## Requirements

- **IDNT-01** — 2–3 distinct directions on real screens: ✅ three built, adversarially verified
  distinct from rendered screenshots.
- **IDNT-02** — user picks exactly one, recorded durably: ✅ picked 2026-07-15, locked as D-58-01 in
  58-IDENTITY.md + PROJECT.md Key Decisions.
