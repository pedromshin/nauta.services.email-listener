# Phase 11: Knowledge-node graph view — Discussion Log

> **Audit trail only.** Not consumed by downstream agents (researcher, planner,
> executor). Decisions live in `11-CONTEXT.md`.

**Date:** 2026-06-15
**Phase:** 11-knowledge-node-graph-view-4e-knowledge-graph
**Mode:** discuss

## Pre-discussion grounding

- **Init:** phase found, no existing CONTEXT/plans/checkpoint, no SPEC, no blocking
  anti-patterns. Discuss mode = `discuss`.
- **Prior context loaded:** ROADMAP (Phase 11 = R6 / deferred "4e knowledge graph",
  marked BLOCKED), PROJECT.md, STATE.md (Phase 10 5/6 complete), 09-SCOPE-PROPOSAL.md
  (R6 hard blockers 5/6/7/8), 10-CONTEXT.md (suggest-only stance, server-proxy idiom,
  tenant-from-row).
- **Schema scout:** `knowledge_nodes` = flat one-directional `scope_ref_id` attach, no
  edge table; `component-links.ts` has the occurrence + audit link tables.
- **Live staging check (Supabase fyfwkjvbcrmjqjysdyqw):** `knowledge_nodes=0`,
  `entity_instances=0`, `component_*_links=0`, `entity_types_active=8`. **Everything
  empty** — the single most decision-shaping fact.
- **Lib check:** only `recharts` present — no graph-viz library anywhere.
- **Sidebar:** "Knowledge" is a `SOON_NAV_ITEMS` placeholder.

## Areas selected for discussion

User selected ALL four offered: Data source · Edges · Graph-viz library + interactions ·
Scope discipline / deferral.

## Decisions

### Area 1 — Data source (the pivotal one, with a reversal)
- **First answer:** "Build the 4e synthesis backend now."
- **User reversal (mid-discussion):** *"actually, make the simpler version we can ship
  today, while still documenting and making it prepared and open for when we want to
  build the 'for real' version."*
- **Resolved:** ship the SIMPLE graph from existing data (D-01); **full concept graph**
  not knowledge-only (D-02), because staging has 0 knowledge nodes and a knowledge-only
  graph would render blank; **importer-wide** scope (D-03).

### Research fan-out
A 4-investigator + synthesis workflow researched the three remaining areas against the
real codebase + context docs (edges model, graph-viz library, deferral seams, data-layer
reuse). Findings drove the option sets below.

### Area 2 — Edges + 4e write-seam
- **Q:** Where does future 4e write node↔node edges? **Options:** (A) empty
  `knowledge_node_edges` table now / (B) JSONB marker on `knowledge_nodes` / (C)
  pure-derived, decide later.
- **User chose:** **(A) empty `knowledge_node_edges` table** (D-05). Graph computes edges
  from existing FKs this phase (D-04); query unions the empty table behind a provider
  seam (D-06/D-11).

### Area 3 — Graph-viz library
- **Recommended by research:** `@xyflow/react` (React Flow v12) — App-Router-native,
  React custom nodes (on-brand glass/teal), deep-link friendly, right-sized. Accepted as
  Claude's-discretion-backed-by-research (D-07). Runner-ups: `react-force-graph-2d`,
  `sigma.js + graphology`. Client island via `dynamic(..., {ssr:false})` (D-08).

### Area 4 — Graph content / scope / write path
- **Graph content — Q:** knowledge-only vs full concept graph. **User chose:** full
  concept graph (D-02).
- **Scope — Q:** per-email vs importer-wide. **User chose:** importer-wide (D-03).
- **Write path — Q:** read-only vs minimal manual-create. **User chose:** strictly
  read-only (D-09); cold-start via optional manual seed.

### Forward-compat seams (the user's "documented + prepared + open" ask)
Captured as mandatory deliverables: empty edges table (D-10), edge-provider interface
(D-11), tenant-by-data-derivation (D-12), documented synthesis trigger hook + existing
`source` discriminator (D-13).

## Deferred to the real 4e phase
Correction→synthesis LLM call, nightly synthesis, human rule-approval queue,
`knowledge_node_edges` population, embedding-similarity related-node discovery, knowledge
write endpoints, cross-importer rule sharing.

## Scope-creep traps flagged
No synthesis/LLM write path; don't populate the edges table; no node CRUD UI; don't reach
for a GPU graph lib before data needs it.

## Claude's discretion (delegated)
Edge column types/indexes; layout algorithm; exact router I/O shapes + join SQL;
node-detail-pane contents; seed-as-fixture-vs-script; empty-state copy.
