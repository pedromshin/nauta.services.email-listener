# taste-local-refs — user's own curated design research

## Bottom line

There is **no first-party design-taste document** in this repo. The two files the task pointed at
turned out to be:

1. `links.md` — a raw Instagram-scrape inventory (captions/carousel text extracted from 18 reels/posts the
   user saved), not curated commentary. It's a grab-bag of "vibecoder content," heavily skewed toward
   generic AI-hype/tool-drop reels, with a thin layer of genuinely design-relevant links.
2. `0 - nauta_design_case.pdf` — **not a design/taste document at all**. It is the take-home *business/architecture*
   assignment ("Design Case: The Data-Entry Brain for Logistics") — an agentic-systems design exercise about
   email ingestion, entity resolution, and confidence-gated automation for Nauta's back office. Zero visual-design
   content, zero taste signal. Flag this clearly to whoever assigned the task — it does not answer "what does the
   user's own taste look like."
3. `COWORK-BRIEFING.md` — unrelated ops task (pulling Supabase secrets for staging/prod). No design content.

So the only real signal is the `links.md` extraction, filtered for design relevance, plus a light grep pass over
`.planning/research/` and `docs/design/` for anything the user (vs. an AI research agent) actually pointed at.

## links.md, classified

| Link/item | Relevant? | What to steal |
|---|---|---|
| Mobbin, Awwwards, Screenlane, 21st.dev, Uiverse.io (named via @mentions in reel #9, "avoiding generic vibe-coded look") | **Design-relevant** | This is the closest thing to an explicit taste signal in the file — a creator's advice on avoiding boring/templated UI, citing these five as the counter-references. Mobbin/Screenlane = real-app pattern libraries (mine for LAYOUT/DENSITY on list↔detail, inbox, and card patterns — not palette). Awwwards/21st.dev/Uiverse = component/interaction novelty, high risk of clashing with the locked warm-paper/serif identity — use only for INTERACTION micro-patterns (hover reveal, transition timing), never for color/type. |
| ColorFlow — mesh gradients tool (colorflow.ls.graphics) | Not relevant | Decorative gradient generator; palette is locked, skip. |
| SSGOI — native page transitions (ssgoi.dev) | Marginal — INTERACTION only | Steal the *idea* of native-feeling page-to-page transitions (shared-element continuity), not any visual style. |
| Vibe UI — UI prompt/component library | Not relevant | Generic AI-generated component library; conflicts with "not generic" directive. Skip. |
| replacements.fyi, Quarkdown | Engineering | npm-package auditing tool / markdown superset — no design content. |
| ShaderGradient, liquid-logo, liquid-glass-js, react-three-fiber (GitHub libs) | Not relevant | Shader/glass/3D effect libraries — directly opposed to the locked "warm paper/ink, colour earned never decorative" identity. Explicitly avoid; flag as anti-pattern if it surfaces in any reference-mining later. |
| shaders.com | Not relevant | Same reason as above. |
| Claude skill installers (ux-designer-skill, canvas-design, taste-skill, transitions.dev, artifacts-builder, app-store-screenshots) | Meta/tooling, not visual taste | These are process tools (how to *produce* design work with AI), not references for what good design looks like. Worth noting `taste-skill` and `frontend-design` exist as installable skills if the user wants a stronger taste-layer going forward, but they carry no content signal about this user's preferences specifically. |
| Recipe post, other content-less reels (#1,2,6,7,10,13,14,16,18) | Not relevant | No links/patterns extracted; noise. |

## Explicit design principles the user wrote themselves

**None found.** Nothing in `links.md`, the PDF, or `COWORK-BRIEFING.md` is first-person design commentary by
the user — `links.md` is a third-party extraction of other people's captions, and the PDF is a take-home
architecture brief (not authored by the user; it's the *prompt* they were given by Nauta, describing the
email-ingestion agentic system, not any UI/visual spec).

The one closest artifact to a locked, user-authored design principle set already lives at
`.planning/phases/58-visual-identity-sketch-pick-human-gate/58-IDENTITY.md` (D-58-01) — which the task brief
already treats as ground truth/locked. That remains the only authoritative taste document.

## .planning/research + docs/design grep pass (secondary, AI-authored not user-authored)

These are agent-produced research dossiers from past phases, not user curation, but do contain real reference
URLs worth noting since they were explicitly commissioned by the user's past runs:

- `.planning/research/v1.8-design/DESIGN-PATTERN-DOSSIER.md` — well-formed pattern-mining table citing
  Claude.ai, ChatGPT, Claude Artifacts, Claude Projects, Perplexity, Notion AI as LAYOUT/DENSITY/INTERACTION
  references (sidebar patterns, docked panels, streaming indicators, source-scoping selectors, mobile
  touch-target gaps). This is the right *shape* of reference-mining for tonight's task — same method should be
  applied to any new UI surfaces, filtered again through the locked palette/typography.
- `docs/design/references/ai-ux-patterns.md` — sourced from an external MIT-licensed skill (NN/g, Google PAIR,
  Apple HIG-for-ML, Microsoft HAX Toolkit) — general AI-UX heuristics, not visual style references.

## Takeaway for tonight's "minimize clicks" directive

The only genuine user-adjacent signal is the implicit endorsement of Mobbin/Screenlane-style real-app pattern
mining (via the saved reel) over generic AI-component libraries (ColorFlow/Vibe UI/shader libs, all explicitly
mismatched to the locked warm-paper identity). Recommend other reference-mining agents pull LAYOUT/DENSITY/
INTERACTION patterns from real production apps (Mobbin/Screenlane-class sources, or the already-commissioned
DESIGN-PATTERN-DOSSIER.md) rather than from decorative/shader/gradient sources — and treat the PDF as
out-of-scope for this task (it's the Nauta take-home brief, not a taste document).
