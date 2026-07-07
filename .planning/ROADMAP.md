# Roadmap: nauta.services.email-listener

## Milestones

- ✅ **v1.0 — MVP** (Phases 1–11) — inbound email → parse → extract → entities/knowledge (shipped; phase dirs retained under `.planning/phases/`, lifecycle not formally run).
- ✅ **v1.1 — Generative UI Engine** (Phases 12–15) — spec-first Catalog→Spec→Registry→Renderer→Generation→Cache→Studio. Archived: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md).
- ✅ **v1.2 — Generative UI: Realism & Interactivity** (Phases 16–20) — SHIPPED 2026-07-03. Eval harness + style packs + catalog expansion + declarative form engine + jailed-eval code-island (multi-candidate + judge). Archived: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · Audit: [milestones/v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md).
- ✅ **v1.3 — Conversational GenUI: Chat, Canvas & Dual-Channel** (Phases 22–25) — SHIPPED 2026-07-06. Persistent streamed `/chat` on a 2D infinite canvas of genui panels with bidirectional (agent↔user) interactive widgets, plus an anticipatory-prompting spike. Local/sandbox only. Archived: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) · Audit: [milestones/v1.3-MILESTONE-AUDIT.md](milestones/v1.3-MILESTONE-AUDIT.md).
- ✅ **v1.4 — Chat & Studio Design Uplift** (Phases 26–28) — SHIPPED 2026-07-07. A no-bloat visual/token-discipline uplift of `/chat` + `/studio`'s own hand-built chrome — zero new npm dependencies — executing the locked 3-phase punch list (zero-dep contract fixes → adopted external picks → design-system token upgrades). Archived: [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) · Audit: [milestones/v1.4-MILESTONE-AUDIT.md](milestones/v1.4-MILESTONE-AUDIT.md).

## Phases

**Phase Numbering:**
- Phase numbering continues across milestones (never restarts). v1.2 formally ended at Phase 20 (an
  informal Phase 21 quality-verification effort is recorded in STATE.md history but was never a
  numbered roadmap phase). v1.3 ran Phases 22–25. **v1.4 starts at Phase 26.**
- Integer phases (26, 27, 28): planned v1.4 milestone work.
- Decimal phases (e.g. 26.1): urgent insertions via `/gsd:phase insert`, executed between the
  surrounding integers.

<details>
<summary>✅ v1.2 — Generative UI: Realism & Interactivity (Phases 16–20) — SHIPPED 2026-07-03</summary>

- [x] Phase 16 — Studio Foundation: Eval Harness + History/Page-Ideas Tabs
- [x] Phase 17 — Tier A: Design-Token/Theme Layer + Style Packs + Assembly RAG
- [x] Phase 18 — Tier A: Catalog Expansion
- [x] Phase 19 — Tier B-1: Declarative (zero-eval) Form Engine
- [x] Phase 20 — Tier B-2: Sandboxed Code-Island (jailed-eval; SPIKE→phase; +Phase-21 multi-candidate/judge, cost guard)

Full detail: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md). Audit `tech_debt`, 0 gaps;
15 connected-env/browser verifications deferred (STATE.md → Deferred Items).

</details>

<details>
<summary>✅ v1.1 — Generative UI Engine (Phases 12–15) — SHIPPED 2026-06-27</summary>

See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md).

</details>

<details>
<summary>✅ v1.3 — Conversational GenUI: Chat, Canvas & Dual-Channel (Phases 22–25) — SHIPPED 2026-07-06</summary>

- [x] Phase 22 — Chat Spine + Persistence + Streaming (11/11 plans) — completed 2026-07-04
- [x] Phase 23 — 2D Canvas + Panels-as-Nodes + Shared State (6/6 plans) — completed 2026-07-05
- [x] Phase 24 — Dual-Channel GenUI (4/4 plans) — completed 2026-07-06
- [x] Phase 25 — Anticipatory Prompting (SPIKE) (3/3 plans) — completed 2026-07-06

Full detail: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md). Audit `tech_debt`, 0 gaps,
24/24 requirements satisfied + cross-phase integration verified; 6 connected-env/browser
verifications deferred (STATE.md → Deferred Items). SPIKE verdict: ship-with-conditions
(25-SPIKE-FINDINGS.md).

</details>

<details>
<summary>✅ v1.4 — Chat & Studio Design Uplift (Phases 26–28) — SHIPPED 2026-07-07</summary>

- [x] Phase 26 — Zero-Dependency Contract Fixes + Backlog Polish (7/7 plans) — completed 2026-07-06
- [x] Phase 27 — Adopted External Design Picks (5/5 plans) — completed 2026-07-07
- [x] Phase 28 — Design-System Token Upgrades (3/3 plans) — completed 2026-07-07

Full detail: [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md). Audit `tech_debt`, 0 gaps:
23/23 requirements + 18/18 integration seams (one FIX-02 primitive leak closed at audit e9faa55);
deferred: browser/OS visual checks + 1 pending todo (STATE.md → Deferred Items).

</details>

## Next

v1.4 shipped. Run `/gsd:new-milestone` to open the next milestone (candidates: 999.4 Design Engine,
999.5 Orchestration Visualizer, 999.7 editable genui panels — see Backlog).

## Backlog

- **999.1 — GenUI history per-importer authorization** (from Phase 16 code review, CR-01): `GET /v1/genui/history` returns all importers' rows when `importer_id` is omitted. Accepted for the current single-shared-key local/sandbox posture (auth enforced via `X-API-Key`; mirrors `/v1/genui/generate`). Enforce per-importer scoping (require `importer_id` or derive from auth context) if real multi-tenancy is introduced. Source: `.planning/phases/16-.../16-REVIEW.md`.
- **999.2 — Grid `colSpan` for asymmetric layouts** (from Phase 17 visual UAT, layout robustness): the `grid` primitive renders equal columns only — no per-child column spanning, so the model cannot express main+sidebar / asymmetric layouts (e.g. a 3/9 split). Phase 17 shipped the high-confidence clamp (`cols`→child-count, commit `75ca1b4`) + generator guidance, which fixes the common collapse; full `colSpan` support (per-node layout hint in the spec schema + interpreter wrapping each grid child in `grid-column: span N`) remains open. Also fold in the cross-file pytest event-loop test-isolation cleanup (migrate `get_event_loop().run_until_complete()` → `asyncio.run`/`pytest-asyncio`).
- **999.3 — v1.3 connected-env verification + measurement:** run the Phase-16 eval harness vs baseline on the v1.2 corpus (DEF-17-05-01/18-03-01/19-01/20-01), execute the Playwright code-island isolation spec (both engines), and add live-progress streaming to the studio (remove the silent spinner). Needs live Bedrock. (STREAM-01/02 in Phase 22 subsumes the studio live-progress-streaming item as part of the chat spine's streaming transport.)
- **999.4 — Design Engine (deferred, likely v1.5):** DSGN-01..04 (unify-vs-hybrid design-engine lock, rendered-visual-compare repair step, promptable design system, screenshot/URL→design-token extraction). Renamed from "v1.4" (2026-07-06) since v1.4 is now Chat & Studio Design Uplift, below. See REQUIREMENTS.md → Future Requirements.
- **999.5 — v1.5 Orchestration Visualizer (deferred):** ORCH-01 (live orchestration run-tree visualization on the canvas). Seams left open by v1.3 (SEAM-03/04, CANVAS-03). See REQUIREMENTS.md → Future Requirements.
- **999.6 — Chat & Studio Design Uplift — PROMOTED to v1.4 (2026-07-06).** UPLIFT-01..03 — a no-bloat visual/token-discipline polish pass on `/chat` + `/studio`'s own hand-built chrome (distinct from DSGN-01..04, which is about the *generative* engine's output quality). Full code-level audit + 5 external-resource verdicts (impeccable.style adopt-now, Magic UI adopt-now-narrow, agent design skills adopt-now-narrow, styles.refero.design adopt-later-reference-only, Tailark skip) + the 3-phase punch list (zero-dep fixes → adopted external picks → design-token upgrades) is now executing as **Phases 26–28** above (finer FIX/ADOPT/TOKEN requirement IDs supersede the coarse UPLIFT-01..03 IDs). Non-interference note: does not touch `GenuiPartBoundary`/`InteractiveWidgetBoundary`, already owned by Phase 24 (`24-03-PLAN.md`). Source: `.planning/research/CHAT-STUDIO-DESIGN-UPLIFT.md`.
- **999.7 — Editable genui panels / studio-on-canvas (raised 2026-07-06, user):** each canvas genui-panel becomes a live editing surface — per-panel controls to change UI tokens / `style_pack_id`, tweak spec parameters, and run studio-related tools (re-theme, regenerate variant, inspect) in place, instead of the current read-only render. Foundations already deliberately open: the versioned node-type registry (CANVAS-03) admits a richer "editable/studio panel" node type; `style_pack_id` is already threaded through chat + canvas (v1.3 locked decision); the Phase-17 DTCG style-pack engine + `/studio` token machinery already exist; the per-chat shared-state store can hold live params. Overlaps **999.4 Design Engine** — a promptable design system is the generation-side of the same tokens. NOT yet a requirement/phase; candidate for a milestone after v1.4 ("canvas as a live editing surface for genui artifacts").
- **999.8 — Declarative display-binding gap (found live 2026-07-06):** the declarative renderer binds values via a `dataRef` dotted-path field (`resolveDataRef`, SPEC-05) — it does NOT interpolate `{{mustache}}` inside a text node's `content`. The generator, prompted for a "counter bound to state", emitted `{"type":"text","content":"{{count}}"}`, which renders the literal string `{{count}}` and never updates, even though the button `onClick:{type:"setState",key:"count"}` DOES write to the (canvas) store. Two candidate fixes: (a) generator-prompt fix — teach it to emit a bound value node / `dataRef` for declared-state display (cheap, high-value), and/or (b) a small renderer affordance to resolve declared-state into text (bigger, touches the locked renderer — weigh carefully). Also note the model conflated `setState value:1` (absolute) with true increment semantics — a related generator-guidance nit. **Option (a) folded into v1.4 as POLISH-01 (Phase 26), 2026-07-06. Option (b) remains backlogged** — it touches the locked `SpecRenderer`, explicitly out of scope for v1.4.
- **999.9 — Canvas auto-layout stacking (cosmetic, 2026-07-06):** dagre lays new panels in a tall narrow vertical column; on a fresh canvas with several panels they stack cramped until fit-view + manual drag. Consider a horizontal/grid default direction or a smarter initial placement. Low priority. **Folded into v1.4 as POLISH-02 (Phase 26), 2026-07-06.**
- **999.10 — Knowledge-graph uplift: adopt graphify's *algorithms* (not its plumbing) onto our live store (theory captured 2026-07-07, user):** our knowledge system is structurally the same shape as a general-purpose knowledge-graph tool (typed nodes + graded edges + budget-aware graph retrieval + diffable evolution), but specialised three ways it can't be — live/multi-tenant, human-gated (suggest-only), OCR-token-grounded. Staged, honest cost/benefit (full analysis in `NOTE.md` in this phase dir): **(1) do regardless —** wire the scaffolded synthesis hook (`confirm_region.py:169`) so confirm materialises `knowledge_node_edges` (Phase 11 table, currently empty + read-only); this closes the correction flywheel, without which every graphify borrow is a no-op. **(2) cheap + defensible —** replace the ungraded `confidence real` on `knowledge_nodes`/`knowledge_node_edges` with an ordinal tier ladder (EXTRACTED | INFERRED | AMBIGUOUS; our `source` column already *is* the ladder), the tier doubling as the suggest-only **promotion gate** (only human-confirmed EXTRACTED edges are trusted for auto-injection) — makes suggest-only legible for the in-person design-case defense. **(3) defer until a real retrieval-miss is measured —** seed-then-expand BFS retrieval (BlendedRAG/RRF k=60 as the seeding fn → BFS-expand ≤2 hops), budget-aware tier-pruning, snapshot/diff + staleness. Cheaper 80% of the recall win first: inject the resolved entity's `aliases[]`/`identifiers` into few-shot (no BFS/migration) and check whether graph-expand still buys anything. **Honest gains are LATENT until correction volume exists** (cold-start ≈ nothing). Canvas fit: `/knowledge` React Flow graph (BFS = click-node-expand-neighbors; tier→edge style; budget-prune = detail slider); `/chat` 2D canvas = speculative v-next. **Do NOT borrow** graphify's rebuilt `graph.json` build model (fights the live transactional flywheel — Postgres+pgvector stays source of truth) or its LLM-from-prose extractor (our OCR→segment→classify→autofill funnel is superior); hyperedges premature. Candidate to land alongside/after the Phase-11 knowledge-synthesis work.
