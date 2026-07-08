# Phase 29: Tier Ladder + Edge Materialization - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run — recommended answers auto-accepted per the user's standing
directive: never block, pick defaults, document)

<domain>
## Phase Boundary

Confirming a region in the review UI durably materializes provenance-carrying knowledge-graph rows —
`knowledge_nodes` + EXTRACTED-tier `knowledge_node_edges` (the Phase-11 table, currently empty and
read-only) — and every node/edge carries an ordinal trust tier (EXTRACTED | INFERRED | AMBIGUOUS)
from the first row written. Re-confirm/supersede updates edges without duplicates or orphans.
Requirements: TIER-01, SYNTH-01, SYNTH-02, SYNTH-03. NO suggest-only promotion mechanics (Phase 30),
no recall/prompt work (Phase 31), no `/knowledge` UI (Phase 32).

</domain>

<decisions>
## Implementation Decisions

### Tier column shape (TIER-01)
- Real Postgres enum `knowledge_trust_tier` = `EXTRACTED | INFERRED | AMBIGUOUS` — matches the repo's
  existing enum idiom (`knowledge_node_scope`, `component_source_type`); ordinal semantics documented
  in the TS schema comment
- Tier column added to BOTH `knowledge_nodes` and `knowledge_node_edges` (requirement text: "every
  knowledge node and edge")
- `NOT NULL DEFAULT 'AMBIGUOUS'` — fail toward least trust; EXTRACTED is only ever set explicitly by
  the human-confirm path (both tables are empty today, so no backfill concern)
- Tier is an INDEPENDENT column; the existing `source` column ('manual' | 'synthesis' |
  'learned_from_correction') stays as mechanism-provenance. The confirm path writes
  source='learned_from_correction' + tier='EXTRACTED' consistently (the NOTE.md mapping)
- `confidence real` stays untouched as the intra-tier score (locked by requirement)
- Migration continues the numbering (next = 0026), hand-written descriptive-name style
  (like `0016_entity_identity.sql`), idempotent `IF NOT EXISTS` guards, `--> statement-breakpoint`
  separators; RLS already deny-all on both tables (0020) — service-role writer bypasses it

### Materialization wiring (SYNTH-01)
- Follow the scaffolded D-13 intent at `confirm_region.py:169-189`: a `KnowledgeSynthesizer` domain
  port (no infrastructure imports — the hook comment's own contract) injected into
  `ConfirmRegionUseCase`, invoked after the embedding persists
- Best-effort semantics: the synthesis call is wrapped so confirm NEVER fails because synthesis
  failed (mirrors the `PromoteEntityOnConfirmUseCase` best-effort convention in
  `presentation/api/v1/components.py:250-257`); failures are logged server-side (structlog)
- New Supabase adapter(s) follow the `component_repository.py` idiom (module-level `_to_row`/
  `_from_row`, `.table(...).upsert/update(...).execute()`, NUL-sanitized). There is NO existing
  knowledge_nodes writer or Python adapter — this phase creates the first one
- DI: wire the new port in `container.py` next to the existing providers (~line 763)
- Minimum edge set materialized on confirm: node→confirmed-component (the provenance anchor) and
  node→entity-instance (when the confirm resolved one), plus co-occurrence edges between entity
  instances confirmed in the same email. Exact relation_type strings at Claude's discretion —
  they surface as labels in the `/knowledge` router UNION seam with zero router changes
- `knowledge_node_edges` has no importer_id — tenant scoping holds ONLY via
  `source_node_id → knowledge_nodes.importer_id`; every materialized edge must have a valid
  source node with correct importer_id

### Provenance shape (SYNTH-02)
- New `provenance jsonb` column on `knowledge_node_edges` holding at minimum
  `{component_id, page_index, polygon, tokens}` — inspectable on the edge row (the success
  criterion's literal wording)
- Token provenance is re-derived from the parent page's `content_raw.tokens` intersected with the
  region's `location.polygon` — the exact `_capture_text` pattern in `edit_region.py:35-62`.
  Extract a shared helper rather than duplicating that logic
- Nodes do not need their own polygon provenance (they carry scope refs + content); provenance
  lives on edges per SYNTH-02

### Supersede semantics (SYNTH-03)
- Add `is_active boolean NOT NULL DEFAULT true` to `knowledge_node_edges` (matches
  `knowledge_nodes.isActive` convention; entity_instances uses the same model)
- Re-confirm/supersede deactivates the prior confirmation's edges and writes fresh ones — never
  DELETE (audit trail preserved), consistent with the repo's "supersede is a status transition,
  not a mutation" convention
- Duplicate prevention: deterministic edge identity on (source_node_id, target_ref_id,
  relation_type) among active edges — app-level upsert semantics; a partial unique index is at
  Claude's discretion if it doesn't fight the polymorphic-target pattern

### Claude's Discretion
- Exact `relation_type` vocabulary, node title/content composition, and whether node reuse (upsert
  by scope+ref) vs always-new-node is used per scope — decide during planning against the real
  confirm data shapes (`component`, `candidate`, `confirmed_record`, `effective_fields`)
- Whether a `KnowledgeRepository` port is split from the `KnowledgeSynthesizer` domain service
- Test strategy follows repo convention: unittest.mock call-shape tests for the adapter,
  AsyncMock-port tests for the use case, TestClient + dishka override for the endpoint path

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `confirm_region.py:169-189` — comment-only D-13 synthesis hook; in scope at that point:
  `component`, `importer_id`, `candidate` (may be None), `confirmed_record` (ONLY on the
  candidate-present branch), `corrected_fields`, `effective_fields`, `embedding`
- `edit_region.py:35-62` `_capture_text` — page-token ∩ polygon intersection (the provenance
  derivation to extract/reuse); `_merge_lineage` (edit_region.py:21-32) — lineage jsonb idiom
- `component_repository.py` — the Supabase adapter idiom to copy (upsert on_conflict, targeted
  updates, `.rpc()` for atomic ops); `entity_instance_repository.py` — second reference (is_active
  + merged_into supersede model)
- `packages/db/migrations/0016_entity_identity.sql` — hand-written migration style to copy;
  `0012` — `ALTER TYPE ... ADD VALUE IF NOT EXISTS` enum idiom; `0019/0020` — the edges table +
  RLS baseline
- tRPC UNION seam `packages/api-client/src/router/knowledge/graph.ts:505-532` — populated edges
  appear on `/knowledge` with ZERO router changes (id `kne-*`, label = relation_type)

### Established Patterns
- Strict hexagonal: use cases import only `app.domain.*`; lint-imports enforces it
- Supabase Python client (sync PostgREST wrapped in async adapters); no transactions — safe
  ordering instead (persist new first, then supersede old)
- Offline pytest: MagicMock client call-shape assertions; `asyncio.run()` (no pytest-asyncio);
  dishka test-container overrides for endpoint tests
- Migrations: `packages/db/migrations/`, next number 0026, journal in `meta/_journal.json`;
  RESTRICTIVE deny-all RLS on every table; service-role bypasses

### Integration Points
- `container.py:763` — ConfirmRegionUseCase provider (add the new port binding here)
- `presentation/api/v1/components.py:221-257` — confirm endpoint (best-effort pattern reference)
- `knowledge_nodes` columns today: importerId FK, title, content, scope enum, scopeRefId/Type
  (polymorphic), source, confidence real, embedding halfvec nullable, isActive, timestamps
- `knowledge_node_edges` columns today: sourceNodeId FK→knowledge_nodes (cascade), targetRefId/Type
  (polymorphic, no FK), relationType default 'related', confidence real, source, createdAt —
  NO tier, NO provenance, NO is_active yet (all three added by this phase)

</code_context>

<specifics>
## Specific Ideas

- The design-case narrative matters as much as the runtime: "a confidence-graded knowledge graph
  with a suggest-only promotion gate, grounded in OCR token provenance" must be literally true of
  the schema after this phase (tier + provenance visible on the row)
- Source of scope: backlog 999.10 NOTE.md (stages 1–2). Its "do NOT borrow" list is binding:
  no static graph.json build, no LLM-from-prose extractor, no hyperedges

</specifics>

<deferred>
## Deferred Ideas

- Suggest-only promotion mechanics (INFERRED/AMBIGUOUS suggestions + promote action) — Phase 30
- Auto-injection query path filtering by tier — Phase 30 (TIER-02/03)
- Few-shot prompt rendering gap discovered during scouting: `autofill_adapter.py` `_generate`
  accepts `examples` but never renders them into the Bedrock messages — Phase 31 must close this
  as part of RECALL-01 (noted here so the planner of Phase 31 sees it)
- Tier → edge visual styling on `/knowledge` — Phase 32 (no per-tier styling exists yet;
  `toFlowEdges` in `knowledge-graph.tsx:127-147` is the touch point)

</deferred>
