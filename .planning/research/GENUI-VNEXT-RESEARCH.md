# GenUI v-next — Research Synthesis & Architecture Decision

**Date:** 2026-06-27
**Status:** Synthesis authored in-context from a deep-research run (`wqh16m5tl`) that completed PARTIALLY — it hit an account session/rate limit (resets ~18:50 America/Sao_Paulo). 9 claims passed 3-0 adversarial verification; ~16 more came from primary sources but only *abstained* (verifiers rate-limited, NOT refuted) — treated here as strong leads. Synthesis step itself was rate-limited, so this document is the human/main-context synthesis.
**Scope guard:** LOCAL + `/studio` sandbox only (no deploy, no product convergence) per user direction. See [[genui-vnext-direction]].

---

## TL;DR — the decisions

1. **Architecture fork → HYBRID** (declarative spec for safe/consistent layout + **JSON-Schema-driven forms** for form business logic + **sandboxed code-islands** for truly custom/interactive bits). This is exactly the model Google just published (A2UI declarative components + sandboxed MCP-App code islands), and it lets us keep v1.1's zero-eval safety where it matters while breaking the ceiling where we must.
2. **Tier A (escape generic shadcn) → ground generation in an explicit, machine-readable design system + design tokens**, varied per generation. This is precisely how v0 escapes the generic look (a "registry" passes component structure + tokens to the model). It extends what we already started (injecting the catalog payload into the prompt).
3. **Rigorous process → eval-driven development.** Real apps from a frontier model are non-deterministic; TDD doesn't fit. Build a golden prompt set (from the *other* research's real-prompt corpus) + an **LLM-as-judge UI-quality rubric** (UI-Bench-style) as a regression eval, and iterate. Pair with GSD phasing + the v0 "composite" pattern (RAG + base LLM + deterministic/model repair).

---

## 1. How real tools actually generate UI (the fork evidence)

| Tool | Approach | Evidence (verification) |
|------|----------|--------------------------|
| **v0 (Vercel)** | **Code-emit** — emits real React/TSX (shadcn/Tailwind), not a spec. Composite system: RAG over a design-system *registry* + frontier base LLM + **custom streaming AutoFix model** + **AST parse/repair** + linter. Raw LLM code errors ~10%; the repair pipeline gives a "double-digit" success-rate lift. | 3-0 verified ×6. Sources: vercel.com/blog/how-we-made-v0-an-effective-coding-agent; /blog/v0-composite-model-family |
| **Bolt.new** | **Code-emit**, run in **WebContainers** (a ~1MB WASM OS in the browser tab) + a **self-healing agent loop** (run → surface error → "fix it" → feed telemetry back). | 3-0 verified ×3. Source: latent.space/p/bolt |
| **Builder.io Visual Copilot** | Purpose-trained model → **Mitosis IR/compiler** → framework code (React/Vue/Svelte/…). An IR/compiler decouples generation from output. | primary (rate-limited abstain). builder.io/blog/figma-to-code-visual-copilot |
| **tldraw "make real"** | **Code-emit** (HTML/CSS from GPT-4V) rendered in an **iframe** on canvas. | primary (abstain). tldraw.dev/blog/make-real-the-story-so-far |
| **Google A2UI vs MCP Apps** | **A2UI = declarative JSON spec**, host renders **trusted components from a predefined catalog** (capability-based security, no raw HTML) — *this is exactly our v1.1*. **MCP Apps = code-emit in a sandboxed iframe.** Google explicitly advocates a **HYBRID**: A2UI declarative components **with sandboxed MCP-App code islands**. | primary (abstain, but THE definitive reference for our fork). developers.googleblog.com/a2ui-and-mcp-apps/ ; a2ui.org |

**Read:** The serious code tools (v0, Bolt) prove code-emit works only with an *engineered* verification/repair/sandbox harness — not a strong model alone. The declarative camp (Google A2UI = our architecture) is safe-but-bounded. The emerging best practice (Google) is **hybrid** — which is the answer to your Tier-B problem.

---

## 2. Architecture recommendation — HYBRID, three tiers of capability

Keep v1.1's spec-first zero-eval interpreter as the **trusted shell**, and add capability by tier so we never pay the code-emit safety/complexity cost where a declarative path suffices:

- **Layout & static content → declarative spec (today).** Keep as-is. Safe, cacheable, the bulk of any page.
- **Forms & form business logic → declarative JSON-Schema form engine.** This is the key insight: *forms do NOT need code-emit.* Mature engines (react-jsonschema-form, JSONForms, Formily, Form.io) express fields, conditional logic, and validation rules as JSON Schema / UI Schema — fully declarative, no eval. Add a `form` node kind backed by one of these. This covers "calendars, complex form controls, customizable validation/business logic" *within* the safe model.
- **Truly custom / arbitrarily-interactive widgets → sandboxed code-islands (Tier B proper).** For the rest (bespoke charts, novel interactions), emit real code into an **isolated sandbox** (iframe / Sandpack / WebContainer / Vercel Sandbox), exactly as v0/Bolt/tldraw/MCP-Apps do — with the v0 repair harness (AST validate → autofix → run → self-heal). The spec references a code-island node; the island runs jailed. Safety model shifts from "no eval" to "eval only in a jail," which is the industry norm and what the user's ambition requires.

This is incremental and de-risked: Tier A + the form engine land inside the existing engine; the sandboxed island is the one genuinely new, higher-risk subsystem — and it's isolated, so it can't regress the trusted core.

---

## 3. Tier A — escaping the generic shadcn look (custom stylization)

Evidence converges on one method (not post-processing): **ground the model in an explicit, machine-readable design system + design tokens, and vary them.**

- v0's mechanism is a **"registry" / MCP channel** that passes component structure, blocks, and **design tokens** to the model before generation — "models must be given component structure, styling, and relationships before they can produce brand-aligned interfaces." (vercel.com/blog/ai-powered-prototyping-with-design-systems; v0.app/docs/design-systems)
- **Design tokens as data**: W3C DTCG **Design Tokens Spec reached first stable version (2025.10)** — a vendor-neutral JSON format for color/type/spacing decisions the agent references at generation time. (w3.org design-tokens)
- **Constrain, don't free-form**: AutonomyAI constrains the agent to a token registry (W3C tokens → Style Dictionary → CSS vars + Tailwind) so it picks existing aliases or computes derived shades — never invents arbitrary styles. (autonomyai.io)
- **Specificity beats description**: give semantic hex tokens, not "navy blue" — "the more specific you are, the less room the model has to substitute its own defaults." (mindstudio.ai/blog/claude-design-avoid-generic-ai-aesthetics)

**Plan for us:** add a **theme/token layer** (W3C-DTCG-shaped JSON) the generator is conditioned on, with a small library of **distinct token sets / "style packs"** the engine can pick or be told to use — so output varies by brand/style instead of always reading as default shadcn. This extends the catalog-payload injection already shipped (commit 57028cb).

---

## 4. Tier B — complex components, forms & business logic

- **Forms (declarative, no eval):** schema-driven engines — RJSF, **JSONForms**, Uniforms, **Form.io** (conditional logic + validation), **Formily** — are the proven way to express customizable form business logic as data. (dev.to RJSF/JSONForms comparison; form.io; jsonforms.io; github.com/alibaba/formily)
- **Assembly intelligence:** v0's RAG-of-examples + a dynamic system prompt is the pattern — retrieve relevant components/exemplars and inject before generation, plus a planning step. (v0 composite-model-family)
- **Complex widgets / calendars / data grids:** either add them as first-class catalog components (declarative props) where the interaction is bounded, or push the genuinely-custom ones to the sandboxed island (§2).

---

## 5. Brutally-rigorous process — eval-driven development

The research is unanimous here, from primary sources:

- **Eval-driven development** (Anthropic + OpenAI): "build evals to define planned capabilities *before* the agent can fulfill them, then iterate"; "evaluate early and often." TDD breaks for LLM features (non-deterministic) — evals replace unit tests for the generation layer. (anthropic.com/engineering/demystifying-evals-for-ai-agents; developers.openai.com eval best-practices; dev.to eval-driven)
- **LLM-as-judge** with a fixed rubric (0.0–1.0 + pass/fail) is the most human-aligned automated grade. (Anthropic multi-agent-research-system)
- **UI-Bench** is a directly reusable methodology for *design/UI quality*: blinded expert **pairwise comparison**, **TrueSkill** ranking with confidence intervals (30 prompts → 300 sites → 4,000+ judgments) — explicitly rejecting naive automated proxies. (arxiv 2508.x / UI-Bench)
- **Spec-driven development** taxonomy (spec-first / spec-anchored / spec-as-source) — our spec *is* the contract; treat it as spec-anchored. (martinfowler.com sdd)
- **Composite architecture** (v0): RAG + base LLM + deterministic/model repair — decouple pieces so we can swap the base model.

**Process stack for this build:** GSD phasing (plan→execute→verify) **+** an **eval harness** as a first-class deliverable: (a) a **golden prompt set** built from the real-prompt corpus (the *other* research, `wme3xqszz`), (b) an **LLM-as-judge UI-quality rubric** (does it render? composed not placeholder? on-brand? a11y? matches intent?) run as a **regression eval** in CI before each phase ships, (c) the existing per-wave code-review + verify discipline. This is the "brutally rigorous" loop: every generation-quality change is measured against the golden set, not vibes.

---

## 6. Proposed v1.2 milestone (to formalize via GSD when the rate limit resets)

**Milestone v1.2 — "Generative UI: Realism & Interactivity" (local/sandbox).**
Suggested phase order (each gated by the eval harness):

1. **Eval harness first** (eval-driven): golden prompt set (from real corpus) + LLM-as-judge UI-quality rubric + a `studio` eval runner. *Nothing else ships without a baseline score.*
2. **Tier A — design-token/theme layer + style packs + assembly RAG**: condition the generator on varied token sets + retrieved exemplars; richer catalog. Measure lift on the golden set.
3. **Tier A — catalog expansion**: real domain components (avatar, list/feed-item, nav, tabs, input primitives) so composition stops reading as generic cards.
4. **Tier B-1 — declarative form engine**: `form` node backed by a JSON-Schema engine (conditional logic + validation) — forms/business-logic without code-emit.
5. **Tier B-2 — sandboxed code-island (SPIKE → phase)**: the one new high-risk subsystem (iframe/Sandpack island + v0-style AST-validate/autofix/self-heal). **Gated on user sign-off** (it changes the safety model from no-eval to jailed-eval).

History tab + page-ideas tab (the near-term asks) slot in as a small early phase (data already persisted; ideas seeded from the real corpus).

---

## Sources (real, from the run)
Architecture: vercel.com/blog/how-we-made-v0-an-effective-coding-agent · vercel.com/blog/v0-composite-model-family · latent.space/p/bolt · builder.io/blog/figma-to-code-visual-copilot · tldraw.dev/blog/make-real-the-story-so-far · developers.googleblog.com/a2ui-and-mcp-apps/ · a2ui.org · langchain.com/breakoutagents/replit
Sandbox/safety: vercel.com/kb/guide/vercel-sandbox-vs-e2b · dev.to renderify
Styling/tokens: vercel.com/blog/ai-powered-prototyping-with-design-systems · v0.app/docs/design-systems · w3.org design-tokens (2025.10) · autonomyai.io · mindstudio.ai (claude-design / design-token)
Forms: dev.to RJSF/JSONForms/Uniforms/Form.io comparison · form.io · jsonforms.io · github.com/alibaba/formily
Process/eval: anthropic.com/engineering/demystifying-evals-for-ai-agents · anthropic.com/engineering/multi-agent-research-system · developers.openai.com eval best-practices · UI-Bench (arxiv) · martinfowler.com sdd-3-tools · newsletter.pragmaticengineer.com/p/evals

*Caveat: ~16 of the supporting claims are from primary sources but were only abstained (rate-limited), not independently 3-0 verified. Re-run the verify pass after 18:50 America/Sao_Paulo to harden them. The 9 core architecture claims (v0/Bolt code-emit + repair + sandbox) ARE 3-0 verified.*
