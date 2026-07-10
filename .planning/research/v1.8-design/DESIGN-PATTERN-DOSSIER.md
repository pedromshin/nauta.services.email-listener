# Design-Pattern Dossier — AI-Product Flows → v1.4 Token System (DSSR-02)

**Status:** Decision-ready research input for v1.8 (E2 — "polytoken.ai: Rebrand, Design Refactor, Auth & Tenancy")
**Researched:** 2026-07-10 (web research current as of this date; ChatGPT Canvas findings below reflect a May 2026 product change)
**Scope:** Maps observed Claude.ai / ChatGPT / Perplexity-class product flows onto the ACTUAL v1.4 DTCG token system (`packages/genui/src/theme/tokens.ts`, `packages/genui/src/theme/packs.ts`). Documentation only — no tokens, packs, or components are added or changed by this document. Implementation is v1.8 / RSKN-* work.

**Mapping target (real, not invented):** The 20 `TOKEN_ALIASES` — `color.background`, `color.foreground`, `color.card`, `color.cardForeground`, `color.primary`, `color.primaryForeground`, `color.secondary`, `color.secondaryForeground`, `color.muted`, `color.mutedForeground`, `color.accent`, `color.accentForeground`, `color.destructive`, `color.destructiveForeground`, `color.border`, `color.ring`, `radius.base`, `spacing.density`, `shadow.base`, `typography.display.family`, `typography.body.family` — and the 6 style packs: `polytoken-teal` (default), `linear-clean`, `warm-editorial`, `brutalist`, `corporate-saas`, `playful-rounded`.

**Headline research finding (informs flow b and e below):** ChatGPT Canvas — the closest ChatGPT analog to a docked-panel canvas — was quietly removed May 28, 2026 and replaced by inline "writing blocks"/"code blocks" rendered directly in the chat thread, explicitly to fix cross-surface (mobile/tablet/desktop) rendering inconsistency. Claude Artifacts is now the only surviving true side-panel canvas among the three products researched. This is directly relevant to VISION E2's own open question ("Canvas needs a mobile interaction answer — likely: list/feed view on small screens, canvas on desktop") — the market has just moved in the direction of inline-first, panel-second.

---

## (a) Chat / conversation surface

| Observed pattern | Product | v1.4 token/pack mapping | Gap identified | Source |
|---|---|---|---|---|
| Reverse-chronological flat conversation sidebar, no folders | Claude.ai | List items: `color.accent` / `color.accentForeground` for hover/active row (already the intended shadcn usage); container `color.background` | None — existing tokens sufficient | [Guideflow: regenerate a response](https://www.guideflow.com/tutorial/how-to-regenerate-a-response-in-a-chat-in-claudeai) |
| Server-sent-event streaming with a pre-first-token typing indicator | Claude.ai (API) | Typing dots: `color.mutedForeground` on `color.card` | No motion/pulse token exists in TOKEN_ALIASES — animation timing is left entirely to component code, not token-driven | [Claude Platform Docs: Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming) |
| Floating/overlay sidebar (hovers over content, doesn't push it) | ChatGPT | Overlay surface: `color.card` + `shadow.base` (per-pack shadow already varies from `"none"` in `polytoken-teal` to soft shadows in `linear-clean`/`playful-rounded`, so packs already express overlay-elevation differently) | None — `shadow.base` already models this axis | [AI Toolbox: ChatGPT Sidebar Redesign](https://www.ai-toolbox.co/chatgpt-management-and-productivity/chatgpt-sidebar-redesign-guide) |
| Stop-generating button during stream | ChatGPT | Secondary/ghost button: `color.muted` background, `color.mutedForeground` text — explicitly NOT `color.destructive` (stop is a control action, not a delete action; conflating them would be a token-semantics regression) | None, but flag as a usage rule: `color.destructive` is reserved for irreversible/delete actions | Search-snippet aggregation (cometapi.com, techyorker.com) |
| Thread-based follow-up composer + follow-up chips below the answer | Perplexity | Chips: `color.secondary`/`color.secondaryForeground` fill, `radius.base` corners | `radius.base` is a single global per-pack value (e.g., `0.5rem` teal, `1rem` playful-rounded) — there is no separate pill/full-round alias, so a true pill-shaped chip isn't independently expressible per pack without a hardcoded override | [Perplexity Help Center: What is a Thread?](https://www.perplexity.ai/help-center/en/articles/10354769-what-is-a-thread) |

**Style-pack fit for the chat surface:** `linear-clean` (tight `0.375rem` radius, monochrome slate, subtle shadow) is the closest existing pack to Claude.ai/ChatGPT's precision chat chrome. `polytoken-teal` (default) is a reasonable neutral baseline. None of the 6 packs is purpose-built for a citation-chip-heavy layout like Perplexity's.

---

## (b) Canvas / multi-panel workspace

| Observed pattern | Product | v1.4 token/pack mapping | Gap identified | Source |
|---|---|---|---|---|
| Docked side panel, in-place update on further prompts (not a new message) | Claude Artifacts | Panel chrome: `color.card` + `color.cardForeground` + `color.border` (divider from chat column) + `shadow.base` | None for chrome — but "in-place update" is an interpreter/state concern, not a token concern; note as an implication below | [Claude Help Center: What are artifacts?](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them) |
| Version stepper ("Version 3 of 5") + diff-mode toggle between versions | Claude Artifacts | Stepper pill: `color.muted` background / `color.mutedForeground` text, active step `color.primary` | **Significant gap:** no diff-semantic tokens exist. `TOKEN_ALIASES` has `color.destructive` (negative) but nothing on the positive/success side (`color.success` or `color.diffAdded`/`color.diffRemoved`) — a version-diff view cannot be token-driven today | [Guideflow: version history](https://www.guideflow.com/tutorial/how-to-view-version-history-of-an-artifact-in-claudeai) |
| Auto-open heuristic (~15+ lines, self-contained content triggers the panel) | Claude Artifacts | Not a token concern — spec-schema/interpreter concern (which node type renders as a docked panel vs inline) | N/A (correctly out of token scope) | [Claude Help Center: artifacts](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them) |
| Canvas removed May 28 2026; replaced by inline "writing/code blocks" in the thread, for cross-surface consistency | ChatGPT | Inline code block: `typography.body.family` for prose, but code needs a **monospace family that doesn't exist as its own alias** — `brutalist` currently hardcodes `'JetBrains Mono'` into `typography.display.family` as a workaround | **Gap:** no `typography.code.family` alias; every non-brutalist pack has no defined monospace token at all | [AI Weekly: OpenAI Silently Drops Canvas](https://aiweekly.co/alerts/openai-silently-drops-canvas-from-gpt-55-update); [AI CERTs: Canvas sunset](https://www.aicerts.ai/news/chatgpt-canvas-sunset-key-dates-impacts-migration-guidance/) |
| "Claude Design" (Anthropic Labs, Apr 17 2026) auto-infers branding from a user's own codebase/design files | Anthropic Labs | N/A — not a chat/canvas UI pattern, but a validated precedent for "read design tokens from a repo automatically," directly analogous to our own DTCG token-pack model | Not a gap; a future backlog idea (out of v1.8 scope) | [Anthropic: Introducing Claude Design](https://www.anthropic.com/news/claude-design-anthropic-labs) |

**Style-pack fit for canvas/artifact surfaces:** `brutalist` (monospace, zero radius, high contrast) is closest to a "code artifact" register. `warm-editorial` (serif, soft shadow) is closest to a "document/mockup artifact" register (Claude Design's own output is closer to this). No pack currently spans both cleanly — an artifact panel switching between code and prose content would visibly clash against a single active pack today.

---

## (c) Side / detail panels

| Observed pattern | Product | v1.4 token/pack mapping | Gap identified | Source |
|---|---|---|---|---|
| Artifacts panel doubles as code/detail view with copy/download controls; a slider switches between multiple artifacts in one thread | Claude.ai | Panel chrome as (b) above; icon buttons: `color.mutedForeground` resting state | **Gap:** no hover/active-state token exists — packs define one resting value per alias, hover/pressed states are left to Tailwind opacity utilities rather than being first-class DTCG values | [Claude Help Center: artifacts](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them) |
| Knowledge base + Artifacts both render in a "dedicated window alongside your conversation"; Team/Enterprise adds a shared activity feed | Claude Projects | Feed item card: `color.card`/`color.border`; feed timestamp/actor: `color.mutedForeground` | None | [Anthropic: Collaborate with Claude on Projects](https://www.anthropic.com/news/projects); [Claude Help Center: What are projects?](https://support.claude.com/en/articles/9517075-what-are-projects) |
| Memory surfaced via a settings **modal**, not a persistent panel; "Memory updated" toast | ChatGPT | Modal/dialog: `color.card` + `shadow.base`; toast: `color.secondary`/`color.secondaryForeground` | None — confirms a modal is a legitimate alternative to a persistent panel for lower-frequency detail surfaces, useful precedent when scoping our own settings/memory UI | [OpenAI: Memory and new controls for ChatGPT](https://openai.com/index/memory-and-new-controls-for-chatgpt/) |
| Sources sidebar with numbered inline citation chips + Answer/Images/Sources tabs | Perplexity | Active tab: `color.primary` underline or `color.accent` fill; inactive tab: `color.mutedForeground`; citation chip: same `radius.base` gap as flow (a) | Same pill-radius gap as (a) — recurs across three separate flows, strengthening the case for fixing it | [Unusual.ai: Design for Citation-Forward Answers](https://www.unusual.ai/blog/perplexity-platform-guide-design-for-citation-forward-answers) |

---

## (d) Knowledge surfaces

This is the flow most directly relevant to polytoken's own differentiator — the ontology/knowledge-graph engine and the suggest-only tier ladder (INFERRED vs EXTRACTED) — so it is where the mapping is least "borrow a competitor's pattern" and most "confirm no competitor pattern exists to borrow."

| Observed pattern | Product | v1.4 token/pack mapping | Gap identified | Source |
|---|---|---|---|---|
| Citations API guarantees `cited_text` points to a real passage in the source doc | Claude.ai / API | Citation card: `color.card` + `color.border`, metadata text `color.mutedForeground` | None for the visual container | [Anthropic: Citations API](https://claude.com/blog/introducing-citations-api); [Claude Platform Docs: Citations](https://platform.claude.com/docs/en/build-with-claude/citations) |
| Spaces: persistent knowledge hub combining uploaded files + live web search, custom per-space instructions | Perplexity | Space container: `color.secondary` surface (distinguishing a "hub" from a one-off chat's `color.background`) | None beyond generic card treatment | [Perplexity: Introducing Internal Knowledge Search and Spaces](https://www.perplexity.ai/hub/blog/introducing-internal-knowledge-search-and-spaces) |
| Chat-style Q&A over a workspace with an explicit source-scoping selector | Notion AI | Source-selector control: existing form/select primitives, `color.border`/`color.ring` on focus | None | [Notion: Introducing Q&A](https://www.notion.com/blog/introducing-q-and-a) |
| Typed nodes ("supertags") + typed/named edges + a dedicated graph view (still "in development" even there) | Tana | Canvas node/edge rendering already exists via `@xyflow/react` per `.planning/research/FEATURES.md`, but **has no dedicated style-pack tokens for node/edge coloring by type** (person/org/topic/email/etc.) | **Gap:** node-type coloring today would have to hardcode hex values to differentiate categories, which directly violates the "raw hex forbidden" rule (D-03/STYLE-03) already enforced for the rest of the token system | [Tana: Knowledge Graph](https://tana.inc/knowledge-graph); [Tana Ideas: Visual Graph feature request](https://ideas.tana.inc/posts/114-visual-graph-visualize-and-manipulate-my-nodes-via-a-graph-view) |
| Tier-ladder confidence badges (INFERRED vs EXTRACTED, suggest-only promotion) | **polytoken (no competitor precedent)** | N/A — none of Claude.ai, ChatGPT, Perplexity, Notion AI, or Tana expose an explicit confidence/promotion-tier visual system in this research pass | **Gap, and a genuinely novel one:** this cannot be mapped onto an existing alias without semantic collision (forcing it onto `color.accent` or `color.muted` would overload those aliases' other UI meanings) — recommend a fresh, purpose-built token pair | No source — confirmed absence across all products researched |

---

## (e) Mobile-responsive answer layouts

| Observed pattern | Product | v1.4 token/pack mapping | Gap identified | Source |
|---|---|---|---|---|
| Artifacts render inline in the conversation on mobile; no side panel, no artifacts-library/gallery view | Claude.ai (mobile) | Inline artifact block reuses `color.card`/`color.border` from the desktop panel treatment — same visual language, different placement | Confirms "docked panel → inline on small screens" as the market-standard collapse pattern; directly validates VISION E2's own tentative plan (list/feed on mobile, canvas on desktop) rather than requiring net-new research | [Support.Claude.com: Use artifacts...](https://support.claude.com/en/articles/11649427-use-artifacts-to-visualize-and-create-ai-apps-without-ever-writing-a-line-of-code) |
| Persistent sidebar on desktop; single-column swipe-menu collapse on mobile; Canvas removed specifically because a docked panel "doesn't render the same way everywhere" | ChatGPT | Single-column layout reuses `color.background`/`color.card` unchanged — no color-token gap; the gap is structural, not chromatic | **Significant structural gap:** none of the 20 `TOKEN_ALIASES` are breakpoint-aware. `spacing.density` is a single scalar per pack (`1rem` teal / `0.875rem` linear-clean / `1.25rem` playful-rounded) expressing "how airy is this pack," not "how does layout/spacing change at a breakpoint" | [AI Weekly: Canvas removal](https://aiweekly.co/alerts/openai-silently-drops-canvas-from-gpt-55-update); [ChatGPT4Mobile: Mobile vs Desktop](https://chatgpt4mobile.com/chatgpt-mobile-vs-desktop-differences) |
| Mobile apps near feature-parity with web, optimized for touch rather than restructured | Perplexity | N/A — token-neutral finding | Related gap: no explicit minimum-touch-target token; denser packs (`linear-clean` at `0.875rem`) risk sub-44px touch targets on mobile with no token-level guard | [Perplexity: Get the Mobile App](https://www.perplexity.ai/mobile) |
| Cowork (agentic tasks) shares one home surface with Chat; push-style permission prompts follow the user across devices, expanded to mobile/web July 7–8 2026 | Claude Cowork | N/A — out of scope for a v1.4 token mapping today; relevant to a future E4 daemon-approval UI, not this dossier | Not scored as a gap; flagged for awareness only | [Claude Help Center: Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork); [TechCrunch: Cowork expands to mobile/web](https://techcrunch.com/2026/07/07/the-coding-agent-wars-are-spilling-into-the-rest-of-the-office-claude-cowork/) |

---

## Design-token / design-system caveat

No official, first-party published design-token sets were found for Claude.ai, ChatGPT, or Perplexity. Several third-party sites present detailed "reverse-engineered" token tables (hex codes, named typefaces, spacing scales) — these are **not authoritative first-party publications** and were explicitly excluded from the mappings above; only qualitative, officially-documented UI mechanics were mapped onto real tokens.

## Accessibility / WCAG posture caveat

No official WCAG conformance statement was found for any of the three products researched. Third-party evaluations found gaps rather than endorsements (unlabeled ChatGPT composer field for screen readers; missing form labels and contrast issues in Perplexity's filters; no Claude.ai audit found either way). This is noted for completeness, not scored against our own token system — our own WCAG-AA verification already exists per-pack in `packages/genui/src/theme/packs.ts`'s inline contrast-ratio comments.

---

## Token-system implications for v1.8

Concrete, additive follow-ups surfaced by the mappings above. None are implemented here — this is a punch list for v1.8/RSKN-* planning. All are additive (existing packs/specs stay valid; nothing here requires removing or renaming an existing alias):

1. **Add a pill/chip radius alias** (e.g., `radius.pill`) alongside the existing `radius.base` — surfaced independently in flows (a) and (c) (follow-up-question chips, citation chips, tab pills all need full-round corners regardless of a pack's base radius).
2. **Add semantic status tokens for the positive/success side** (e.g., `color.success` / `color.successForeground`) to pair with the existing `color.destructive` / `color.destructiveForeground` — needed for version-diff views (flow b) and any future confirm/success state, not just tier-ladder badges.
3. **Add a dedicated monospace/code typography alias** (e.g., `typography.code.family`), decoupled from `typography.display.family` — `brutalist` currently overloads display-family with JetBrains Mono as a workaround; every other pack has no code-font answer at all (flow b).
4. **Design fresh, polytoken-specific tier-ladder tokens** (e.g., `color.tier.inferred` / `color.tier.extracted`, naming TBD at implementation time) — flow (d) confirms no competitor exposes an equivalent visual system to borrow; this must be designed rather than mapped.
5. **Add a small closed palette of graph node/edge-type tokens** for the `@xyflow/react` canvas (flow d) — needed so node-type differentiation (email/chat/knowledge/artifact) doesn't fall back to hardcoded hex, which would violate the existing D-03/STYLE-03 raw-hex-forbidden rule.
6. **Introduce breakpoint-awareness into the token/pack model** (flow e) — today `spacing.density` is the only density-adjacent lever and it is not breakpoint-scoped; this is the largest structural gap found and should be scoped as its own design conversation (not a single new alias) before the mobile-responsive canvas answer is implemented.
7. **Consider a canvas-first 7th style pack** if the Constellation brand direction from `BRAND-IDENTITY-OPTIONS.md` (DSSR-01) is adopted — none of the 6 existing packs are purpose-built for a spatial/canvas-forward visual register; if Cortex (the DSSR-01 recommendation) is adopted instead, this follow-up is lower priority.
8. **Define a hover/active-state convention** (flow c) — packs currently define one resting value per alias; interactive-state derivation is left entirely to component-level Tailwind opacity utilities rather than being token-driven, which risks per-pack inconsistency as more packs are added.

None of the above block v1.8 kickoff — they are input to that milestone's design-token planning, sequenced roughly by how many flows independently surfaced the same gap (radius/pill and breakpoint-awareness recurred across 3 and 2 flows respectively; the rest surfaced once each).
