# Phase 11: Knowledge-node graph view (4e knowledge graph) - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

A graph/relationship visualization at `/knowledge` that makes the importer's knowledge
network visible — entity types, their fields, resolved entity instances, the
emails/components those instances occur in, and (when present) knowledge nodes layered
over the network. Realizes Phase 9 request-6 **R6** and makes the deferred **"4e
knowledge graph"** moat *visible*.

**The shipped scope is the SIMPLE, shippable-today version** built entirely from data
that already exists (existing FKs) — explicitly architected and documented so the
"for real" 4e knowledge-synthesis backend (correction→rule learning) drops in later
with **no rework**. The graph reads; the synthesis path (a future phase) writes.

**In scope:** a read-only `knowledge` tRPC router (`graph` + `list` + `byId`); the
`/knowledge` route (importer-wide network, pan/zoom/focus, deep-links); a graph-viz
dependency; an **empty** `knowledge_node_edges` table as the documented 4e write-seam;
the sidebar nav flip (Knowledge → live); graceful empty/sparse states.

**Out of scope (deferred to the real 4e phase):** the correction→knowledge-node
synthesis LLM call, nightly synthesis batch, the human rule-approval queue, population
of `knowledge_node_edges`, embedding/similarity-based related-node discovery, any
knowledge-node write endpoints (FastAPI or tRPC), and cross-importer rule sharing.
</domain>

<decisions>
## Implementation Decisions

### Data source — what the graph is made of (the reversed decision)
- **D-01:** **Ship the SIMPLE version now; document + seam the "for real" version.**
  The user explicitly reversed an initial "build the 4e synthesis backend now" choice:
  build the smallest genuinely-useful graph that ships today against existing data, and
  make the codebase *prepared and open* for the real 4e synthesis moat later. The simple
  graph reads existing data; the real moat (correction→rule learning) is a future phase.
- **D-02:** **Full concept graph — not knowledge-node-only.** The graph shows the whole
  network: `entity_type → entity_type_field → entity_instance → email_component → email`,
  with `knowledge_node`s layered in **when present**. Rationale: staging has **0
  knowledge nodes** today (verified live: `knowledge_nodes=0`), so a knowledge-only graph
  would render an empty screen until 4e ships. A full concept graph renders **real,
  demoable data today** (the 8-type taxonomy + ~35 fields now; Phase 10 entity instances
  + occurrence edges as they populate) and the knowledge nodes "light up" automatically
  once 4e writes them.
- **D-03:** **Importer-wide network view.** `/knowledge` shows the importer's entire
  knowledge/entity network — "the moat made visible" — not a per-email subgraph. It is a
  standalone route (matches the roadmap's standalone-page intent + the sidebar nav item),
  not an email-detail feature.

### Edges — what relationships to draw + the 4e write-seam
- **D-04:** **Edges are COMPUTED from existing FKs this phase** (no edge write path).
  The shippable edge set, all verified against the schema:
  1. `entity_type → entity_type_field` (`entity_type_fields.entity_type_id`) — taxonomy,
     always present even with zero instances
  2. `entity_instance → entity_type` (`entity_instances.entity_type_id`)
  3. `component ↔ entity_instance` (`component_entity_candidate_links`,
     `component-links.ts:75-92`; carries `match_type`, `was_selected`)
  4. `component → entity_type` (`component_entity_candidate_links.entity_type_id`)
  5. `component → email` (`email_components.email_id`)
  6. `component → component` nesting (`email_components.parent_component_id` self-FK)
  7. `component ↔ knowledge_node` (`component_knowledge_node_links`, `component-links.ts:38`)
  8. `knowledge_node → polymorphic scope` (`knowledge_nodes.scope_ref_id` +
     `scope_ref_type`, `knowledge-nodes.ts:54-55`)
- **D-05:** **Add an EMPTY `knowledge_node_edges` table now as the 4e write-seam.** New
  schema file `packages/db/src/schema/knowledge-node-edges.ts`:
  `(id, source_node_id FK→knowledge_nodes, target_ref_id, target_ref_type [polymorphic],
  relation_type default 'related', confidence real, source, created_at)` + indexes on
  `source_node_id` and `target_ref_id`. **This phase writes 0 rows to it and the graph
  reads 0 rows from it** — it exists so 4e can write node↔node / node→instance edges
  later with no migration. Polymorphic `target_ref_type` mirrors the existing
  `knowledge_nodes.scope_ref_type` idiom. Use `real` for `confidence` to match
  `knowledge_nodes.confidence` (`knowledge-nodes.ts:60`).
- **D-06:** **Query unions derived edges + the (empty) edges table** behind one provider
  seam (D-09). Today: derived FKs only. When 4e populates the table, those edges appear
  with no UI change.

### Graph-viz library + interactions
- **D-07:** **Library = `@xyflow/react` (React Flow v12).** Chosen for: native Next.js
  App Router fit; 100% React custom nodes (renders shadcn `Badge`/`Card` + Tailwind teal
  tokens `bg-primary/10` + `backdrop-blur-md` directly, so it's on-brand with the glass
  aesthetic with no second accent hue); node-click → `router.push()` deep-linking with no
  serialization; ~85-100KB gzipped; right-sized for a curated dozens-to-hundreds-node
  graph. Runner-ups (not chosen): `react-force-graph-2d` (Canvas → harder shadcn styling
  + deep-linking), `sigma.js + graphology` (GPU, for 1000s of nodes — overkill). Install
  in **`apps/web`** (domain-specific), not `packages/ui`.
- **D-08:** **Interactions:** pan/zoom, click-a-node → focus + open the right-hand detail
  pane, node-click deep-links (entity instance → `/entities/[id]`; email/component →
  `/emails/[id]`), filter by node type / scope / source, and a graceful empty/sparse
  state. The graph is a **client island**: the `/knowledge` server-component page loads it
  via `dynamic(() => import('./_components/knowledge-graph'), { ssr: false, loading: …Skeleton })`
  — a single `"use client"` boundary (Canvas/WebGL break SSR).

### Write path
- **D-09 (write path):** **Strictly read-only this phase.** No knowledge-node create
  UI or endpoint. Cold-start ("front-load manual rule capture", `context/11`) is handled
  by an **optional onboarding seed** of a few `source='manual'` nodes (fixture/seed, not
  a UI). Rationale: a create UI pulls in auth gates, audit trail, validation, and a form
  (a phase's worth of work) and blurs the **manual-seed vs learned-from-correction**
  boundary that 4e's human-approval gate depends on. A constrained `knowledge.create`
  (manual-only, create-only) is a documented small follow-on if feedback demands it.

### Forward-compatibility seams (the user's explicit "documented, prepared, open" ask)
These are the concrete hooks that let the real 4e synthesis backend drop in without
rework. They are MANDATORY deliverables of this phase.
- **D-10 (seam: edges table):** the empty `knowledge_node_edges` table (D-05) is 4e's
  dedicated write target.
- **D-11 (seam: edge provider interface):** the `knowledge.graph` procedure reads edges
  through a single source-agnostic provider boundary. The **inferred** provider (derived
  FKs) ships now; a **populated** provider (reads `knowledge_node_edges`) is the 4e swap —
  the graph UI never changes. Lives in the new
  `packages/api-client/src/router/knowledge/` dir.
- **D-12 (seam: tenant by data-derivation):** the graph query derives `importer_id` from
  a **data row** (e.g. the importer/email the request resolves), never from the caller —
  same rule as Phase 9 D-18 / Phase 10 D-21.
- **D-13 (seam: synthesis trigger, documented only):** the future correction→synthesis
  call hooks into the existing confirm/correction flow (the Python
  `ConfirmRegion`/confirm use case in `apps/email-listener`); this phase only **documents
  the injection point** (an optional `knowledge_synthesizer` dependency, `None` today).
  The `source` discriminator already exists on `knowledge_nodes`
  (`knowledge-nodes.ts:59`, `default 'manual'`; the design-case enum also allows
  `learned_from_correction` / `learned_from_confirmation`) — **no schema change** is
  needed for 4e to write learned rows.

### Claude's Discretion
- Exact `knowledge_node_edges` column types/nullability beyond the shape in D-05;
  index choices; whether `relation_type` is a text default or a pgEnum.
- Graph layout algorithm (dagre/elk vs React Flow's built-in); node visual design within
  the glass/teal token set; how deep the default graph renders before requiring
  expand-on-click (perf budget for large importers).
- Exact `knowledge.graph` / `knowledge.list` / `knowledge.byId` input+output shapes and
  join SQL; whether `graph` is one query or a few unioned reads.
- Node-detail-pane contents beyond the reused `KnowledgeNode` shape; filter UI specifics.
- Whether the onboarding seed (D-09) ships as a DB seed fixture or a one-off script.
- Empty/sparse-state copy and the "what we extract" explainer.
</decisions>

<specifics>
## Specific Ideas

- **"Make the simpler version we can ship today, while documenting and preparing it for
  the 'for real' version."** This is the governing instruction for the whole phase: ship
  a real, demoable graph from existing data; leave clean, documented seams so the 4e
  synthesis moat is a drop-in later, not a rewrite.
- **The graph must render something real on day one.** Because `knowledge_nodes` is empty
  in staging (verified), the graph leans on the entity-type taxonomy + Phase-10 instances
  so the demo is never a blank screen — it's a progressive "what we extract" map that
  fills in as data (and later, knowledge nodes) arrive.
- **The real moat is correction→rule-learning** (`context/6` §6, `context/8`): a human
  correction spawns an isolated-LLM synthesis call that proposes a `knowledge_node`, which
  a human approves before it activates. That whole loop is the deferred 4e work this phase
  prepares for — it is NOT built here.
- Visual language stays consistent with the rest of the app: glass (`backdrop-blur`,
  translucent surfaces), the single teal primary accent (`164 39% 22%`), no second hue —
  matches the 09-UI-SPEC and the Phase 9/10 surfaces.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### What the "real" 4e moat is (so the seams are correct) — READ FIRST
- `context/6 - email-processing-pipeline-part-1.md` §2.6 (knowledge-node definition,
  the `knowledge_node_scope` enum, example rules) and §6 (the correction→synthesis loop:
  separate isolated LLM call, `source='learned_from_correction'`, never derived from raw
  email content — the security isolation [S14/S15]). This defines what Phase 11 is
  *preparing for* and must not break.
- `context/8 - architecture-intuition.md` — "Corrections create knowledge nodes",
  "rule activation requires human approval", and "The Minimum Working Version" /
  "what you add next" (why knowledge nodes come after entity candidates).
- `context/11 - where-this-breaks.{html,pdf}` — the knowledge-node top-k retrieval
  failure mode and the cold-start fixes (seed cross-importer priors; front-load manual
  rule capture) — the rationale behind the read-only + optional-seed decision (D-09).

### Phase split + this phase's mandate
- `.planning/phases/09-entity-field-region-relationships-canvas/09-SCOPE-PROPOSAL.md` —
  R6 verdict + **Hard Blockers 5/6/7/8** (no edge table, no synthesis path, no router,
  no graph-viz lib) and the **Design Direction** (Gmail/glass layout, teal accent,
  reuse-vs-add inventory). The blockers this phase resolves (read-side) vs defers (4e).

### Patterns to mirror (verified locations)
- `packages/api-client/src/router/entities/` (`gallery.ts` list+`limit+1`, `detail.ts`
  byId, `index.ts` compose) — the tRPC router idiom for the new
  `packages/api-client/src/router/knowledge/` dir.
- `packages/api-client/src/root.ts:6-10` — where to register `knowledge: knowledgeRouter`
  (alongside `emails` / `entityTypes` / `entities`).
- `apps/web/src/app/entities/page.tsx` + `apps/web/src/app/entities/[id]/page.tsx` —
  server-component-wrapper + `"use client"` shell + `metadata`/`generateMetadata`
  conventions for the `/knowledge` page.
- `apps/web/src/components/app-sidebar.tsx:36-44` — move the `Knowledge` item from
  `SOON_NAV_ITEMS` into `LIVE_NAV_ITEMS` (mirror how Phase 10 promoted "Entities"); set
  `href: "/knowledge"`; update the D-20 nav-order comment.
- `apps/web/src/app/entities/[id]/_components/entity-knowledge.tsx:13-20` — reuse the
  `KnowledgeNode` interface (`id, title, content, source, confidence, createdAt`) + its
  card rendering for the graph's node-detail pane (keep it consistent with the
  entity-detail page).

### Schema (verified)
- `packages/db/src/schema/knowledge-nodes.ts` — `knowledge_nodes` (the `source` default,
  scope enum, `scope_ref_id`/`scope_ref_type`, `confidence real`).
- `packages/db/src/schema/component-links.ts` — `component_entity_candidate_links` +
  `component_knowledge_node_links` (occurrence + audit edges).
- `packages/db/src/schema/entity-instances.ts`, `entity-types.ts`, `components.ts`,
  `emails.ts` — the node sources + FKs the derived edges (D-04) read.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **tRPC router idiom:** `packages/api-client/src/router/entities/` (split list/detail/
  index; `limit+1` pagination; exported input schemas for DB-free tests). The new
  `knowledge` router mirrors this and registers in `root.ts:6-10`.
- **Page convention:** `apps/web/src/app/entities/{page.tsx,[id]/page.tsx}` — server
  component + `"use client"` shell + skeleton; the graph itself loads behind
  `dynamic(..., { ssr: false })`.
- **`KnowledgeNode` shape + card:** `entity-knowledge.tsx:13-20` — reuse for the node-
  detail pane.
- **@nauta/ui primitives present** (reuse, invent nothing): `Card`, `Badge`, `Resizable`
  (graph ↔ detail split), `Sheet`/`Dialog`, `ScrollArea`, `Tabs`, `Select`, `Skeleton`,
  `Command` (optional ⌘K node search). Teal primary + `--sidebar-*` tokens + `backdrop-blur`
  already wired.
- **Sidebar nav flip:** `app-sidebar.tsx:36-44` (Phase 10 already did this for Entities).

### Established Patterns
- Read-side tRPC reads Drizzle directly (the gallery/detail pattern); **writes** go
  through FastAPI via the `getListenerConfig` + server-side `X-API-Key` proxy — but this
  phase is **read-only**, so no proxy/write is added.
- Tenant isolation derives `importer_id` from a data row, never the caller (Phase 9 D-18 /
  Phase 10 D-21) — applies to the graph query (D-12).
- Client islands for Canvas/WebGL: `dynamic(..., { ssr: false })` (new for this phase;
  same idea as react-pdf preview in Phase 5).

### Integration Points
- **New schema:** `packages/db/src/schema/knowledge-node-edges.ts` (empty table, D-05) +
  a Drizzle migration (generate + apply local/staging/prod per the deploy playbook —
  migrations-first).
- **New router dir:** `packages/api-client/src/router/knowledge/` → registered in
  `root.ts`.
- **New route:** `apps/web/src/app/knowledge/` (+ `_components/knowledge-graph.tsx`
  client island).
- **New dep:** `@xyflow/react` in `apps/web/package.json`.
- **Documented (not built) hook:** the synthesis-trigger injection point in the Python
  confirm/correction use case in `apps/email-listener` (D-13).
</code_context>

<deferred>
## Deferred Ideas

These belong to the **real "4e knowledge synthesis" phase** (a future phase), which this
phase's seams (D-05, D-10..D-13) are explicitly preparing for:

- **Correction→knowledge-node synthesis LLM call** — isolated Bedrock call on human
  correction; writes `source='learned_from_correction'` nodes (`context/6` §6).
- **Nightly / batched synthesis** (pgmq / pg_cron) and the **human rule-approval queue**
  (rules propose → human approves → activate).
- **Population of `knowledge_node_edges`** (node↔node, node→instance) by the synthesizer.
- **Embedding/similarity-based related-node discovery** (top-k over `knowledge_nodes.embedding`).
- **Knowledge-node write endpoints** (FastAPI `POST/PATCH/DELETE /v1/knowledge-nodes`)
  and a tRPC create/edit path — including any minimal `knowledge.create` follow-on.
- **Cross-importer "universal rule" sharing** (seed cross-importer priors at scale).

### Scope-creep traps for THIS phase (do NOT do here)
- Building any synthesis/LLM write path "while we're in here."
- Populating `knowledge_node_edges` from derived FKs (it must stay empty — D-05).
- A general node CRUD/editing UI.
- Reaching for a GPU graph lib / 1000s-of-nodes scale before there's data to need it.
</deferred>

---

*Phase: 11-knowledge-node-graph-view-4e-knowledge-graph*
*Context gathered: 2026-06-15*
