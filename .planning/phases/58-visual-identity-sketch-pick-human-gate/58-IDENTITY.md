---
phase: 58-visual-identity-sketch-pick-human-gate
type: decision-record
status: LOCKED
locked: 2026-07-15
locked_by: user
requirements: [IDNT-01, IDNT-02]
decision_id: D-58-01
direction: "Provenance × Meaningful Colour"
base_sketch: sketches/direction-a.html
colour_philosophy_from: sketches/direction-c.html
realized_as: sketches/direction-final.html
consumed_by: [59, 60, 61, 62, 63]
---

# D-58-01 — Visual identity: Provenance × Meaningful Colour (LOCKED)

**This is the locked input for Phases 59–63.** Phase 59 realizes it as real tokens in
`apps/web/src/app/globals.css` + the brand guide's visual-identity section. Phases 60–63 consume
it. Nothing here is re-litigated downstream without a new user decision.

## The user's pick (verbatim, 2026-07-15)

> "i liked a best but also liked c color concept. we will want light and dark theme and liked the
> idea of using colors meaningfully datafully"

Selected after reviewing all three directions rendered on real polytoken screens
(`58-SKETCH-REVIEW.md`, adversarially reviewed with screenshots at 1440 and 1024). This satisfies
999.18(d) — the design-review loop on real screens that v1.9 skipped, which is what produced the
user's verdict that "the whole UI is still ugly/experimental."

**Resolution:** Direction A (Provenance) is the base identity. Direction C contributes its colour
*philosophy* — not its typography, density, or tier-meter signature. Both themes are first-class.

## Thesis

**Every fact has a source, and colour is reserved for what the data means.**

polytoken's substance is provenance: OCR token polygons, extraction regions, a confidence tier
ladder separating what a human confirmed from what a machine guessed. The identity makes that
visible rather than decorating around it.

## The three laws

### 1. Colour is earned, never decorative

Chrome is monochrome. A hue appears only where it carries data meaning, and it means exactly one
thing in both themes.

| Hue | Means | Allowed on |
|-----|-------|------------|
| **Verdigris** | **Confirmed** (EXTRACTED tier) — a human verified this fact | Solid provenance marks, chips, badges, confirmed connections, legend |
| **Pencil-amber** | **Suggested** (INFERRED tier) — inferred; nobody has confirmed it | Dashed provenance marks, chips, badges, suggested connections, legend |
| **Madder red** | **Irreversible** — this cannot be undone | Destructive buttons only. Never errors, never warnings. |

**Everything else is ink.** Buttons, links, nav, selected states, focus rings, checkbox and switch
fills carry NO hue — they use ink weight, underline, rule, fill, and elevation. This is the radical
part and it is deliberate: it proves a product can be legible and obviously interactive without
spending colour on chrome, which leaves the entire colour budget for the one distinction that
actually matters. A's original quiet action-accent is **removed** by this law.

Adding a hue requires a demonstrated usability failure of the monochrome treatment — not a
preference — documented as an amendment here.

### 2. Chrome speaks sans, evidence speaks serif

Content that came from the user's own mail renders in a document serif; all product chrome is sans.
Provenance encoded in typography itself. **No exceptions** — an exception makes the rule
unlearnable. (The synthesis audited all 86 serif elements at runtime; the only violation found was
the sketch's own manifesto lede, set back to sans.)

Tabular numerals everywhere for amounts, dates, and counts.

### 3. Entity type is shape, never hue

Supplier = square · Person = circle · Amount = diamond · Document = triangle · Email = hollow.

**This is what makes law 1 possible** — type surrendered its five hues so tier could own colour
outright. It survives greyscale and colour-blindness, which a hue system does not. The cost, stated
honestly: type reads slightly slower than a hue would.

> ⚠ **The one item the user has not explicitly blessed.** Flagged at lock time: this was inferred
> from the user's colour law, not instructed. Cheap to revisit during Phase 59; expensive after
> Phase 62. If revisited, laws 1 and 2 stand regardless.

## Signature element — the provenance mark

An OCR-token-polygon-derived highlight/underline on every extracted fact, used identically on
entity chips, cited spans inside chat answers, and knowledge entity labels:

- **Solid mark** = confirmed
- **Dashed mark** = suggested

One mark language everywhere. This is the thing the product is remembered by.

## Token ladder (oklch — both themes)

Semantic hues hold **hue and chroma constant across themes; only lightness moves.** This is the
oklch payoff Phase 55's migration bought — the dark theme costs three numbers, not a second design.

| Token | Light | Dark | Means |
|-------|-------|------|-------|
| `--conf` | `oklch(49.0% .068 176.3)` | `oklch(78.0% .068 176.3)` | Verdigris — Confirmed |
| `--sugg` | `oklch(50.5% .080 78.7)` | `oklch(78.5% .080 78.7)` | Pencil-amber — Suggested |
| `--bad` | `oklch(49.4% .126 32.4)` | `oklch(70.0% .126 32.4)` | Madder — irreversible |
| `--ink` | `oklch(26.7% .015 124.2)` | `oklch(92.4% .019 83.1)` | Text — and every action, selection, focus ring |
| `--faded` | `oklch(46.6% .021 124.4)` | `oklch(75.2% .024 78.2)` | Secondary text; type shapes |
| `--pencil` | `oklch(51.0% .022 119.2)` | `oklch(65.0% .025 78.1)` | Muted metadata; "Uncertain" |
| `--shelf` | `oklch(92.4% .014 97.5)` | `oklch(19.9% .009 59.1)` | Page ground — warm archival paper / warm graphite |
| `--leaf` | `oklch(95.1% .011 95.2)` | `oklch(22.2% .011 60.9)` | Panel — one step above the page |
| `--bright` | `oklch(98.2% .007 97.4)` | `oklch(26.5% .015 76.2)` | Elevated — the sheet you are working on |
| `--shade` | `oklch(89.9% .016 99.0)` | `oklch(31.3% .016 75.0)` | Well — pressed into the page; hover fills |
| `--rule` | `oklch(82.1% .021 100.6)` | `oklch(38.8% .026 78.8)` | Structural boundary |
| `--hair` | `oklch(88.3% .018 99.6)` | `oklch(32.6% .017 70.9)` | Divider — a boundary that carries less weight |

**Grounds:** light is A's warm archival paper (hue ~97, NOT cream — a warm gray-green archival
tone); dark is C's warm graphite (hue ~60, umber-tinted, clearly NOT pure black).

### Two of Direction A's original values failed WCAG-AA and are corrected here

- `--sugg`: `54.7%` → **`50.5%`**
- `--pencil`: `62.9%` → **`51.0%`**

Found only by computing ratios rather than eyeballing them. The corrected values are canonical.

## Measured contrast (computed from the shipped oklch)

On `--leaf` (light | dark): ink **13.15 | 13.78** · faded **5.98 | 7.80** · pencil **4.95 | 5.33** ·
conf **5.24 | 8.88** · sugg **5.15 | 8.71** · bad **5.67 | 6.13**

Honest worst case — a tier colour as text on its own wash, which is where it actually lives:
conf **4.59 | 6.72**, sugg **4.52 | 6.59**. Clears AA (4.5); **tight in light.**
Buttons: on-fill/ink **14.40 | 14.50** · on-fill/bad **6.21 | 6.46**.

**Phase 59 constraint:** the WCAG-AA gate must be re-run against these values as ported. The light
tier-on-wash pairs have ~0.09 of headroom — any lightness drift breaks them.

## What this commits the product to

- A serif in the product, carrying real meaning (not a decorative choice).
- Chrome that is entirely monochrome — no branded button colour, ever.
- Dark theme as a first-class surface, not an afterthought.
- Entity type distinguished structurally (shape), not chromatically.
- Long email text must stay comfortable to read on the graphite ground.

## Explicitly rejected

- Direction B (Threadwork) and its per-family hue system — superseded by law 3.
- Direction C's tracked small-caps headings ("engineering console" per the review) and its tier
  meter (~4×7px — an accessibility concern).
- Direction A's quiet action accent — removed by law 1.
- Cream + serif + terracotta. The ground is warm gray-green archival, there is no terracotta, and
  the structure is registry rhythm, not editorial magazine.

## Reference implementation

`sketches/direction-final.html` — both themes, live toggle, all four content surfaces plus a
"Colour Law" panel. Rendered proof: `preview-final-light.png`, `preview-final-dark.png`,
`preview-final-1024.png`. Its CSS is already shaped as `:root { --token }` +
`:root[data-theme="dark"]` overrides to mirror `globals.css` and port cleanly.

**It is a sketch, not the source of truth.** Phase 59 makes the tokens real; this document is the
contract.
