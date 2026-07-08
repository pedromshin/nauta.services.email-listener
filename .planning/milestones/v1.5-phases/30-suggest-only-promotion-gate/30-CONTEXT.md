# Phase 30: Suggest-Only Promotion Gate - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run — recommended answers auto-accepted per the user's standing
directive: never block, pick defaults, document)

<domain>
## Phase Boundary

Synthesis-generated relationships surface only as human-reviewable *suggestions* — never as
auto-trusted truth. Suggestions enter at INFERRED/AMBIGUOUS tier (never EXTRACTED); the
auto-injection query path returns ONLY active EXTRACTED edges (proven by a seeded three-tier test);
a human promote action raises a suggestion to EXTRACTED with promotion provenance recorded distinct
from synthesis provenance. Requirements: TIER-02, TIER-03. NO recall/prompt work (Phase 31), no
canvas styling (Phase 32 — but see the payload note below), no auto-merge of anything (hard
constraint).

</domain>

<decisions>
## Implementation Decisions

### Where suggestions come from (TIER-02)
- NO new background synthesis job is invented. The existing confirm-time
  `KnowledgeSynthesizerService` (Phase 29) is extended: alongside its EXTRACTED edges it ALSO emits
  suggestion edges with `source='synthesis'`:
  - INFERRED — plausible-but-unconfirmed relations (e.g. co-occurring entity components in the same
    email that are NOT yet human-confirmed)
  - AMBIGUOUS — weak signals (e.g. non-selected `component_entity_candidate_links` candidates for
    the confirmed component)
- Exact suggestion heuristics are Claude's discretion at planning — keep them deterministic
  (no new LLM calls; the "do NOT borrow LLM-from-prose extractor" rule applies), cheap, and
  clearly explainable for the design-case defense
- Suggestion edges are display-only: nothing anywhere acts on INFERRED/AMBIGUOUS truth

### Promotion action (TIER-03)
- Promotion is a FastAPI listener endpoint (writes stay in Python; the tRPC knowledge routers are
  read-only by design D-09). Shape: an authenticated (X-API-Key) POST that promotes ONE edge by id
  from INFERRED|AMBIGUOUS → EXTRACTED
- Guard semantics: only ACTIVE suggestion-tier edges are promotable; promoting an
  already-EXTRACTED edge or an inactive edge is a 4xx rejection (fail-closed, mirrors the
  Phase-24 CAS/double-submit posture)
- Promotion provenance recorded in a NEW nullable `promotion jsonb` column on
  `knowledge_node_edges` (migration 0027): at minimum `{promoted_at, from_tier, mechanism}` —
  distinct from the original synthesis `provenance` (ROADMAP SC4's literal wording)
- Optional "dismiss suggestion" (deactivate, never delete) is at Claude's discretion — nice
  audit-preserving symmetry, not required by the requirement text
- UI affordance for promote/dismiss belongs to Phase 32's canvas work — Phase 30 delivers the
  mechanic (endpoint + repo + tests), not chrome

### Auto-injection gate (TIER-02 / ROADMAP SC2)
- A repository-level query method (e.g. `list_injectable_edges`) that filters
  `tier='EXTRACTED' AND is_active=true` — THE single sanctioned read path for any future prompt
  injection (Phase 31 alias injection reads entity_instances directly, so its consumer arrives
  with stage-3; the gate still ships NOW with a seeded test proving INFERRED/AMBIGUOUS exclusion)
- Test shape per ROADMAP SC2: seed all three tiers, assert only EXTRACTED comes back

### Visibility of suggestions (ROADMAP SC1)
- "Visibly distinguished wherever edges are surfaced": Phase 30 exposes `tier` (and `isActive`)
  through the tRPC knowledge graph UNION seam payload (`packages/api-client/src/router/knowledge/
  graph.ts:505-532` — add the fields to the GraphEdge shape for kne-* edges) so the data layer
  distinguishes suggestions; full VISUAL tier encoding (solid/dashed/faint) is explicitly
  Phase 32 (GRAPH-01). A minimal label suffix for suggestion tiers is acceptable if cheap
- Inactive (dismissed/superseded) edges are excluded from the graph payload

### Claude's Discretion
- Suggestion heuristic details, relation_type strings for suggestions, promote endpoint path
  naming, whether dismiss ships
- Migration 0027 exact shape (follow 0026's idempotent hand-written style)
- Test strategy per repo convention (MagicMock call-shape for adapter, AsyncMock for use case,
  TestClient+dishka for endpoint)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (Phase 29 just built these)
- `app/application/use_cases/synthesize_knowledge.py` — `KnowledgeSynthesizerService`
  (node-per-region, deactivate-then-insert supersede; extend here for suggestions)
- `app/domain/ports/knowledge_graph_repository.py` +
  `app/infrastructure/supabase/knowledge_graph_repository.py` — add promote/list-injectable
  methods here
- `app/domain/ports/knowledge_synthesizer.py` — port contract
- `packages/db/migrations/0026_knowledge_trust_tier.sql` — style reference for 0027
- Schema now live: tier enum on both tables, `provenance jsonb` + `is_active` +
  `idx_knowledge_node_edges_active_identity` partial index on edges
- Endpoint conventions: `app/presentation/api/v1/components.py` (X-API-Key, typed rejections →
  4xx pre-stream, best-effort separation); Phase-24 `SubmitWidgetInteraction` for the fail-closed
  guard idiom
- `entity_instance_repository.py` — `find_co_occurring`/`find_selected_instance_for_component`
  reads added in 29-03; `component_entity_candidate_links` holds non-selected candidates

### Established Patterns
- Suggest-only is a HARD constraint (design-case deliverable): resolver read-only, promotion
  records provenance, never auto-merge
- Fail-closed rejections BEFORE any state flip (Phase-24 ordering discipline)
- Never DELETE — deactivate (`is_active=false`)
- Hexagonal: use cases import only app.domain.*; lint-imports enforces

### Integration Points
- `app/container.py` — `_provide_confirm_region_use_case` (29-04) wires the synthesizer; new
  promote use case needs its own provider + route registration in main.py
- tRPC graph UNION seam: `packages/api-client/src/router/knowledge/graph.ts:505-532`
- REQUIREMENTS traceability: TIER-02, TIER-03 → this phase

</code_context>

<specifics>
## Specific Ideas

- The design-case sentence this phase must make literally true: "synthesis emits suggestions;
  a human promotes; only human-confirmed EXTRACTED edges are ever trusted for auto-injection"
- Deterministic suggestion heuristics only — the explainability is the point

</specifics>

<deferred>
## Deferred Ideas

- Promote/dismiss UI affordances on `/knowledge` — Phase 32 (GRAPH-01..03)
- Any prompt-injection consumer of `list_injectable_edges` — stage 3 (KGX-01/02), gated by
  RECALL-02 measurement
- Suggestion-quality scoring beyond the tier — premature

</deferred>
