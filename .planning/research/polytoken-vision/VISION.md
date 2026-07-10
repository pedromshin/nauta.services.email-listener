# polytoken.ai — Product Vision & Everything-Ahead Bundle

> **SEQUENCING SUPERSEDED 2026-07-10 — two-epoch compression.** The epoch CONTENT below stands,
> but the E3→E7 grouping is replaced by `.planning/research/two-epoch-endgame/ENDGAME-PLAN.md`:
> v1.9 "Cloud Workspace" = live-loop gate + v1.8's re-skin/mobile/panels remainder + E3;
> v2.0 "Local Agent Platform" = E4+E5+E6 merged (one daemon/permission-model/ToolExecutor
> foundation; CDP-first browser, allowlist-panel registry; editor + self-repo stretch);
> E7 stays parked at its gate as a venture decision. Locked with it: deploy/OAuth/live-UAT
> gates are first-class phase work, never deferrable-by-default.

**Status:** VISION / NORTH-STAR — captured 2026-07-07 during v1.5 execution. Not a milestone.
This document bundles (a) all work still pending in the current roadmap, (b) the carried backlog,
and (c) the full polytoken.ai product vision, into one dependency-ordered ladder that future
`/gsd:new-milestone` runs draw from. Nothing here overrides v1.5/v1.6 sequencing — it absorbs them.

**One-line north star:** *"The tool that is everything I wanted all of my current AI tools to be"* —
a personal AI workspace where emails, chats, files, browser sessions, and generated artifacts all
live as connected nodes on a canvas, backed by an AI-powered, ontology-driven knowledge graph that
the user's own conversations grow — paired with real local-machine control (filesystem, terminal,
editor, browser) via a desktop daemon, and eventually pooled distributed inference between users.

---

## 0. Why the current roadmap IS the vision's critical path

Map of vision-language → already-built/in-flight substrate:

| Vision phrase | Existing substrate |
|---|---|
| "emails become cards on the canvas" | Email ingestion pipeline (v1.0) + 2D infinite canvas w/ typed node registry (v1.3 Phase 23) |
| "attach chats to email threads" | `/chat` spine + conversations + canvas ChatNode (v1.3 Phase 22–23) |
| "save sources as knowledge nodes connected to this email/chat cluster" | knowledge_nodes/edges + tier ladder + provenance (v1.5 Phases 29–30, executing NOW) |
| "promote conversation knowledge to my global knowledge" | The suggest-only promotion gate — literally Phase 30's promote-edge use case |
| "AI-powered ontology driven by user chats" | v1.6 Chat × Knowledge Convergence (researched, locked, gated on v1.5) |
| "agent searches the web with my email in context" | v1.6 mid-turn tool loop (Fork 4) + tool surface (Fork 5) — add a web-search executor |
| "PDFs/generated panels in context for next chats in cluster" | genui panels-as-nodes + spec.bindings live-data plumbing (v1.6 Fork 1) |
| "graphify patterns for informational relation systems" | v1.5 already adopts graphify's algorithms (tier ladder, bounded expand, tier-pruned detail) |
| "agent's own repository of reusable functions" | Template flywheel research (`research/TEMPLATE-FLYWHEEL.md`) + ui_spec_templates cache |
| "control which tools the agent can use" | tRPC procedure allowlist + tool registry patterns (v1.6 Forks 4/5) — generalize |

**Consequence:** do NOT restart or fork the project. Finish v1.5, run v1.6 as researched, then
rebrand and build outward. The rename is a re-skin of a substrate that's already correct.

---

## 1. The Epoch Ladder

Epochs are dependency-ordered groups; each becomes 1–3 GSD milestones when its gate opens.
E-numbers are abstract — map to v1.7+ at each `/gsd:new-milestone`.

### E0 — Finish v1.5 (IN FLIGHT)
- 30-02 promotion mechanic (RED tests exist, uncommitted implementation in progress)
- Phase 31 Recall & Measurement → produces the retrieval-miss rate that gates KGX-01..03
- Phase 32 Knowledge Canvas (tiered rendering, ≤2-hop expand, tier filter)
- **While in there:** expose the DB-level `extracted_only` view v1.6 Fork 3 asked for.

### E1 — v1.6 Chat × Knowledge Convergence (RESEARCHED, GATED ON E0)
Run as locked in `research/v1.6-chat-knowledge/SYNTHESIS.md` (9 phases, gates G1–G4).
This delivers the conversational-knowledge core of polytoken: knowledge tools in chat, live
data-bound panels, confirm-action widgets, citations, quarantine, Python KnowledgeGraphRepository.
**Vision-relevant additions to consider at v1.6 planning time (not in the synthesis):**
- a `web_search` ToolExecutor (same port as Fork 5's tools) — "ask questions with my email in
  context and it searches the web"
- source-capture: tool results (URLs/PDFs) persistable as INFERRED knowledge nodes attached to the
  conversation — the "stop bookmarking Chrome tabs manually" feature. Suggest-only, as always.

### E2 — polytoken.ai: Rebrand, Design Refactor, Auth & Tenancy
The "become a product" epoch. First epoch that is genuinely NEW work.
- **Rename** nauta → polytoken.ai (repo, packages, domains, docs). Do once, atomically.
- **Branding + design + marketing research:** establish brand identity; research design patterns
  and user flows of Claude/ChatGPT/Perplexity-class tools (the stated pattern reference);
  total UI refactor on the v1.4 token system (extend, don't discard — the token discipline is the
  asset that makes a re-skin cheap). Absorbs backlog 999.4 Design Engine ambitions where cheap.
- **Web-first, mobile-responsive.** No native mobile. Canvas needs a mobile interaction answer
  (likely: list/feed view on small screens, canvas on desktop).
- **Auth:** Google OAuth (gauth) + sessions; **tenancy:** per-user data isolation, Supabase RLS
  actually enforced (today: RESTRICTIVE deny-all + single shared API key). Absorbs backlog 999.1
  (per-importer authorization) — it becomes per-USER scoping.
- **Email forwarding for real personal use:** wire the user's own email via the existing
  ingestion system; **email THREAD handling** (thread model, not just single messages) — new
  requirement, the ingestion pipeline is message-oriented today.
- Gate: E1 shipped (don't re-skin a UI that v1.6 is still adding surfaces to).

### E3 — Email-Cluster Workflow (the personal killer feature)
"Emails are cards; chats attach to threads; research accumulates into the cluster."
- Email/thread cards as canvas node types (registry already versioned/extensible).
- Chat panels bound to an email thread's context (thread → conversation linkage).
- Web research from chat with email in context (E1's tool loop + web-search executor).
- Sources → knowledge nodes (URLs, PDFs, PDFs-from-URLs, attachments, images + extracted
  content) attached to the email/chat cluster; **promote-to-global** via the E0 promotion gate.
- Cluster context: generated artifacts (PDFs, genui panels) enter the context of subsequent
  chats in the same cluster (the salary-negotiation scenario: shared ontology + benchmarks +
  artifacts across chats). This is the graphify-style "community/cluster" concept applied live.
- Gate: E2 (auth + own-email forwarding must exist for personal use).

### E4 — Desktop App + Daemon (local-machine control)
- Desktop app (likely Tauri/Electron — decide at planning) hosting a **daemon**: outbound
  persistent connection to polytoken cloud; phone/web sends commands → daemon executes locally.
- **Watched folder:** drop a folder into the polytoken controller directory → contents become
  visible/browsable in the system and on the canvas as directory panels.
- **Remote filesystem ops:** "download everything from this ontology cluster to my machine."
- **Directory panels + attached chats:** a chat bound to a directory panel operates like a
  Claude Code session scoped to that folder — THE gold-star agent loop. Best-possible Claude Code
  clone: agent loop + tool executors (E1's ToolExecutor port generalizes: fs read/write, terminal,
  git) + permission model.
- **Embedded editor in a canvas panel:** code-server (VS Code in browser) or Monaco embedded in
  an iframe panel — the jailed-iframe discipline from v1.2 Phase 20 is directly reusable thinking.
  Many panels = many folders, all editable/runnable on the home machine.
- Security is the whole game here: daemon auth, per-command permissioning, audit log. Suggest-only
  posture extends: destructive fs ops require confirm-action widgets (E1 Fork 2 machinery).
- Gate: E2 (auth/tenancy — a daemon without real auth is a remote shell for anyone).

### E5 — Browser-Control Canvas Panel
- A canvas panel that is a window into a locally-running controlled browser (Claude-in-Chrome-like
  frictionless UX: one-click extension permission, tab-group isolation).
- Transport: Chrome extension + native messaging to the E4 daemon, or CDP. Research fork.
- Perception pipeline: screenshot-first (sees the page like a user) vs DOM-level. Research list
  from user: pixelrag, ui-tars, agentreach, depth-anything — evaluate current OSS SOTA at
  planning time (this space moves fast; do NOT lock now).
- Gate: E4 (daemon is the local execution host).

### E6 — Tool/Skill Registry + Agent Self-Repository
- **Registry of external OSS tools/capabilities** (potentially hundreds+): web search, YouTube
  content search, file conversion, coding, terminal, generation... Per-user enable/disable
  control panel ("which of these is my agent currently allowed to use"). Generalizes the
  compile-time allowlist posture from E1 — allowlists become user-managed, still never
  model-managed.
- **Agent self-repository of reusable functions:** when the agent repeatedly solves the same
  class of task (file conversion, a UI pattern, a code pattern), it saves and reuses its own
  vetted implementation instead of regenerating — the template flywheel generalized from genui
  specs to arbitrary functions. Reuse-before-regenerate, human-promotable (same tier ladder
  philosophy: generated = INFERRED, human-blessed = EXTRACTED).
- Gate: E4 (most tools execute via the daemon); design seams from E1's ToolExecutor day one.

### E7 — Distributed Inference / Compute Pooling (LAST, HARDEST)
- Idle machines offer compute for credits; others offload to the pool. Scheduler matches task
  profile (model size, latency tolerance, urgency) to node profile (strong/weak setups);
  low-urgency big-model jobs can shard across weak nodes; credits spendable on paid models.
- **Explicitly deferred design:** pricing/credit economics ("once pricing is figured out the rest
  fits into it — too many gray areas yet"), scheduling optimization, trust/verification of
  remote execution, model licensing.
- Gate: E4 shipped + real multi-user tenancy + demonstrated demand. Do NOT design now beyond
  keeping E4's daemon protocol job-shaped (a "run inference task" is just another daemon job).
- Risk note: this epoch is a company-sized problem on its own (see Petals, Exo, distributed-llama
  prior art). Treat as its own venture decision at gate time.

---

## 2. Carried backlog absorption map

| Backlog item | Absorbed into |
|---|---|
| KGX-01..03 (BFS retrieval, tier-pruning, snapshot/diff) | E1/E3 — still gated on Phase 31's measured miss-rate |
| 999.1 per-importer auth | E2 tenancy (becomes per-user) |
| 999.2 grid colSpan + pytest event-loop cleanup | E2 UI refactor (fold in) |
| 999.3 connected-env verifications (Bedrock evals, Playwright) | E2 kickoff hygiene — run before re-skinning |
| 999.4 Design Engine (DSGN-01..04) | E2 (promptable design system, token extraction) |
| 999.5 Orchestration Visualizer (ORCH-01) | E4/E5 (run-tree on canvas next to directory/browser panels) |
| 999.7 editable genui panels / studio-on-canvas | E2/E3 (panel editing surfaces) |
| 999.8(b) renderer mustache interpolation | E2 UI refactor, only if still needed |
| truncated-tool-call salvage todo | E1 (Fork 4 fixes this class explicitly) |

## 3. Irreversibility guardrails (decisions to NOT foreclose now)

1. **"Abstracted database within our own system"** — single-user for now; avoid only the
   clearly-irreversible: keep user_id/tenant scoping columns on new tables from E2 onward, keep
   storage behind repository ports (already the house pattern), no cross-tenant PK schemes.
2. **Daemon protocol** — design E4's command envelope generic (job type + payload + permissions)
   so E7's inference jobs and E5's browser jobs are just new job types.
3. **Tool execution** — everything through the ToolExecutor port from E1 day one; no ad-hoc tool
   call sites. This is what makes E6's registry cheap later.
4. **Tier ladder everywhere** — generated/suggested vs human-confirmed stays a first-class,
   structural distinction across ALL new artifact types (knowledge, functions, files). It's the
   product's defensible stance (design case) — never regress to auto-trust.
5. **Rename once** — no partial polytoken/nauta hybrid states; E2 does it atomically.

## 4. Immediate single next step (unchanged by all of the above)

**Finish 30-02** (promotion mechanic — RED tests already written) → Phase 31 → Phase 32 →
v1.5 audit/close → point `/gsd:new-milestone` at `research/v1.6-chat-knowledge/SYNTHESIS.md`.
E2 (rebrand/auth) is the first NEW planning conversation, and it happens after v1.6 — or at
earliest, its research/branding track can run concurrently during v1.6 execution the way the
v1.6 research ran during v1.5.
