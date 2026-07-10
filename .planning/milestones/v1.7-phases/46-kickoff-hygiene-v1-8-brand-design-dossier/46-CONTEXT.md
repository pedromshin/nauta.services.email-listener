# Phase 46: Kickoff Hygiene + v1.8 Brand & Design Dossier - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning
**Mode:** Autonomous smart discuss — 3 grey areas proposed, all recommendations auto-accepted per autonomous contract

**Scheduling note:** This phase is PARALLELIZABLE with the 43→44→45 chain (roadmap dependency note) and runs as a parallel track once Phase 42's rename lands. Its dossier deliverables are v1.8's kickoff inputs — producing them here is how the next milestone is initiated in parallel.

<domain>
## Phase Boundary

Three strands: (1) HYGN-01 — execute the locally-feasible 999.3 connected-env verifications with recorded evidence; (2) HYGN-02 — land the 999.2 folds (pytest event-loop cleanup, grid colSpan); (3) DSSR-01/02 — produce the decision-ready v1.8 brand-identity options document and design-pattern research dossier. NOT in this phase: acting on the dossier (v1.8), any re-skin work, non-locally-feasible 999.3 items.

</domain>

<decisions>
## Implementation Decisions

### HYGN-01 — connected-env evidence
- Run the Phase-16 eval harness vs baseline on the v1.2 corpus via live Bedrock (existing IAM transport — no ANTHROPIC_API_KEY, per LLM-transport memory); record raw numbers
- Execute the Playwright code-island isolation spec on BOTH engines
- Evidence lands as a phase artifact document (e.g. `46-EVIDENCE.md`) with commands, outputs, and pass/fail per DEF item; if a run is blocked by env/creds, record the blocker as evidence rather than faking results

### HYGN-02 — small debt folds
- pytest event-loop cleanup: migrate `get_event_loop().run_until_complete()` patterns → `asyncio.run()` / current `pytest-asyncio` idioms; resolves the pending todo `2026-07-08-genui-retrieval-provider-py313-asyncio.md` (tagged `resolves_phase: 46`) — verify the production provider doesn't share the deprecated call
- Grid `colSpan`: per-node layout hint in the spec schema + interpreter wraps grid children in `grid-column: span N`; tests included; touches the genui spec schema — keep the change additive (existing specs stay valid)

### DSSR-01/02 — v1.8 dossier
- Brand-identity options doc: 3–5 named directions for polytoken (naming/voice/logo direction, domain posture), each with rationale + a recommendation — decision-ready, not exhaustive
- Design-pattern dossier: web-researched mapping of Claude/ChatGPT/Perplexity-class product flows (chat, canvas, panels, knowledge surfaces, mobile-responsive answers) onto the v1.4 token system — produced by researcher agents the way v1.6's research ran during v1.5
- Both live under `.planning/research/` (v1.8-design or similar) so the v1.8 new-milestone picks them up directly

### Claude's Discretion
- Evidence doc format, research agent split for the dossier, colSpan schema field naming, exact pytest-asyncio fixture strategy

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase-16 eval harness + v1.2 corpus exist; Playwright code-island isolation spec exists (Phase 20, iframe-srcdoc jail — Playwright chosen over jsdom for isolation proof)
- v1.4 DTCG token system + style-pack engine are the dossier's mapping target
- `.claude/skills/nauta-design-system/SKILL.md` documents the current design-system state (note: file is dirty in the user's working tree — do NOT modify it)

### Established Patterns
- Grid primitive currently renders equal columns with the Phase-17 clamp fix (commit 75ca1b4); colSpan is the remaining half
- Failing tests are all in `tests/test_genui_retrieval_provider.py` (10, Python 3.13 asyncio) — confirmed pre-existing, byte-identical pre/post Phase 36

### Integration Points
- packages/genui spec schema + interpreter (colSpan); apps/email-listener tests (pytest); eval harness CLI; `.planning/research/` for dossier output

</code_context>

<specifics>
## Specific Ideas

- The dossier is v1.8's research input — write it the way GSD project research reads (STACK/FEATURES-style rigor, decision-ready tables)
- HYGN evidence must be honest: blocked ≠ passed; record what actually ran

</specifics>

<deferred>
## Deferred Ideas

- Acting on the dossier (re-skin, brand adoption) — v1.8
- Non-locally-feasible 999.3 items (studio live-progress streaming already subsumed by Phase 22)
- 999.12 Tailwind v4/React 19 migration — stays backlog, likely a v1.8 precursor decision

</deferred>
