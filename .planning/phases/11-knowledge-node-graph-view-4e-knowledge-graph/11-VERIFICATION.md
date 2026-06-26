---
phase: 11-knowledge-node-graph-view-4e-knowledge-graph
verified: 2026-06-15T13:20:00Z
status: passed
score: 17/17 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 11: Knowledge-node graph view (4e knowledge graph) Verification Report

**Phase Goal:** A graph/relationship visualization (`/knowledge`) of knowledge nodes and what they relate to (entity types, fields, instances, other nodes). Realizes Phase 9 R6 and the deferred "4e Knowledge Graph" moat. Ships the SIMPLE, demoable-today version from existing FKs (D-01), with documented seams (empty `knowledge_node_edges` table, source-agnostic edge provider, tenant-by-data, documented synthesis trigger) so the real 4e synthesis backend drops in with no rework.

**Verified:** 2026-06-15T13:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

The ROADMAP exposes no `success_criteria` array and no REQ-IDs map to Phase 11 (decision-driven phase; seams D-05/D-10..D-13 mandatory). Must-haves were therefore taken from the three PLAN frontmatter `truths`/`artifacts`/`key_links` blocks (11-01, 11-02, 11-03) plus the governing decisions in 11-CONTEXT.md (D-01..D-13). All were checked against the live codebase and the live local DB — not against SUMMARY claims.

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | Empty `knowledge_node_edges` table exists as the 4e write-seam, 0 rows, no migration needed for 4e (D-01/D-05/D-10) | ✓ VERIFIED | Schema `knowledge-node-edges.ts` defines all 8 columns + polymorphic `target_ref_id` (no `.references()`) + 2 indexes; migration `0019_cold_energizer.sql` has exact `CREATE TABLE` + FK ON DELETE cascade + both btree indexes; live-DB assertion `assert-knowledge-node-edges.ts` exits 0; live count query `knowledge_node_edges=0` |
| 2  | `api.knowledge.graph` returns `{ nodes, edges }` unioning derived-FK edges with the (empty) edges table behind one provider boundary (D-04/D-06/D-11) | ✓ VERIFIED | `graph.ts` section (5) selects `KnowledgeNodeEdges` and maps rows to the same `GraphEdge` shape via `shapeGraphResponse`; empty table → 0 extra edges today; all 8 derived edge types emitted (has_field, instance_of, component↔instance, component→type, belongs_to_email, nested_in, component↔knowledge_node, knowledge_node→scope) |
| 3  | Graph is importer-wide (always entity_type + entity_type_field; instance/component/email/knowledge added on request or when present) (D-02/D-03/D-04) | ✓ VERIFIED | `graph.ts` (1) ALWAYS selects EntityTypes + EntityTypeFields + has_field edge; (2)/(3) gated on includeInstances/includeEmails; (4) knowledge nodes only when `rows.length > 0`; live data: 8 entity_types + 20 fields render with zero instances → never blank |
| 4  | `api.knowledge.list` paginated feed + `api.knowledge.byId` node + (empty today) edges (D-06) | ✓ VERIFIED | `list.ts` limit+1 + offset + optional importerId eq + `{ items, hasMore, nextOffset }`; `detail.ts` byId returns null-on-missing (never throws), reads KnowledgeNodeEdges by sourceNodeId → `{ node, edges }` |
| 5  | Every knowledge query scopes importerId from a data filter (never a trusted caller claim) and writes 0 rows to the edges table (D-09/D-12) | ✓ VERIFIED | `importerId` appears only as an optional `eq(*.importerId, input.importerId)` filter in graph/list; no header/session tenant read; grep for `.mutation(`/`insert(`/`update(`/`delete(` in the knowledge router → 0 matches; live count `knowledge_node_edges=0` |
| 6  | Python confirm/correction use case documents the future synthesis-trigger injection point with no code path (D-13) | ✓ VERIFIED | `confirm_region.py` lines 170-189: `knowledge_synthesizer` is `None` today (no-op), `source="learned_from_correction"` documented, "must be a domain port (no infrastructure imports here)", comment-only — no constructor param/import/branch |
| 7  | Visiting `/knowledge` renders the entity-type + field taxonomy as a hierarchical React Flow graph from real data — never blank (D-02/D-08) | ✓ VERIFIED | `page.tsx` → `KnowledgeGraphIsland` → `dynamic(ssr:false)` → `knowledge-graph.tsx` calls `api.knowledge.graph.useQuery`; live data 8 types + 20 fields; web build green, `/knowledge` route in output |
| 8  | Graph is a client island via `dynamic(..., { ssr: false })` so Canvas/SSR never collide (D-08) | ✓ VERIFIED | `knowledge-graph-island.tsx` ("use client") holds `dynamic(() => import("./knowledge-graph")..., { ssr: false, loading })`; resolves the Next.js 15 Server-Component constraint correctly |
| 9  | `@xyflow/react` v12 + `@dagrejs/dagre` installed; 6 custom node types + edge styling per UI-SPEC (D-07) | ✓ VERIFIED | `apps/web/package.json` `@xyflow/react ^12.11.0` + `@dagrejs/dagre ^3.0.0`; `graph-nodes.tsx` exports `nodeTypes` with 6 keys; web build resolves them |
| 10 | Nodes laid out top-to-bottom by dagre (rankdir TB, ranksep 64, nodesep 32, edgesep 16) (D-07) | ✓ VERIFIED | `graph-layout.ts` setGraph `rankdir: "TB", ranksep: 64, nodesep: 32, edgesep: 16`; pure, immutable; consumed by knowledge-graph.tsx `layoutGraph(...)` |
| 11 | Knowledge sidebar item is a live `/knowledge` link, removed from Soon | ✓ VERIFIED | `app-sidebar.tsx` LIVE_NAV_ITEMS includes `{ href: "/knowledge", label: "Knowledge", icon: Share2 }`; `SOON_NAV_ITEMS = []` |
| 12 | Clicking a node focuses it + opens the detail pane (per-type content); canvas click deselects (D-08) | ✓ VERIFIED | `knowledge-graph.tsx` owns `selectedNodeId` useState; composes `<NodeDetailPane>`; pane click + Escape deselect; node-detail-pane has 6 per-type branches (browser human-verify approved per 11-03 Task 4) |
| 13 | Entity-instance nodes deep-link to `/entities/[id]`; email/component to `/emails/[id]` (D-08) | ✓ VERIFIED | `node-detail-pane.tsx`: `/entities/${node.id}`, `/entities?type=${node.id}`, `/emails/${emailId}`, `/emails/${node.id}` next/link hrefs present |
| 14 | Filter rail toggles node-type visibility + "Show all instances" switch re-fetches (D-08) | ✓ VERIFIED | `filter-rail.tsx` 6 checkboxes + Switch; `knowledge-graph.tsx` `includeInstances` derived from `showInstances` OR visibleTypes membership (not a constant false) → drives `useQuery` input |
| 15 | Dismissible taxonomy explainer banner shows schema counts, persisted in localStorage | ✓ VERIFIED | `taxonomy-banner.tsx` role="status" aria-live="polite" + X dismiss; parent persists `nauta.knowledge.taxonomy-banner-dismissed` (lazy-init from localStorage in knowledge-graph.tsx) |
| 16 | Loading / error / no-schema states + keyboard/aria contracts hold | ✓ VERIFIED | `graph-states.tsx` exports `GraphErrorState` (role="alert") + `GraphNoSchemaState`; `knowledge-graph-skeleton.tsx` role="status"; conditionally rendered in knowledge-graph.tsx canvas zone (browser human-verify approved) |
| 17 | Whole surface stays read-only — no node create/edit, no edges-table write, DB text escaped (no dangerouslySetInnerHTML) (D-09/T-11-05) | ✓ VERIFIED | grep for `useMutation`/`.mutate(` in `_components/` → only a D-09 explanatory comment; grep for `dangerouslySetInnerHTML` → only comments naming the prohibition, zero real usages |

**Score:** 17/17 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/db/src/schema/knowledge-node-edges.ts` | Empty 4e write-seam table + inferred types | ✓ VERIFIED | 71 lines; KnowledgeNodeEdges + KnowledgeNodeEdgeRow + InsertKnowledgeNodeEdge; polymorphic target_ref_id |
| `packages/db/src/schema/index.ts` | Barrel export | ✓ VERIFIED | `export * from "./knowledge-node-edges"` (line 23) |
| `packages/db/migrations/0019_cold_energizer.sql` | CREATE TABLE knowledge_node_edges | ✓ VERIFIED | 8 cols + FK cascade + 2 indexes; applied locally, asserted present in live DB |
| `packages/db/scripts/assert-knowledge-node-edges.ts` | information_schema gate | ✓ VERIFIED | Queries information_schema.tables via POSTGRES_URL_NON_POOLING; exits 0 (table present) |
| `packages/api-client/src/router/knowledge/graph.ts` | graph procedure + provider seam | ✓ VERIFIED | 473 lines; exports knowledgeGraphProcedures, graphInputSchema, shapeGraphResponse; references ComponentEntityCandidateLinks + KnowledgeNodeEdges |
| `packages/api-client/src/router/knowledge/list.ts` | limit+1 feed | ✓ VERIFIED | knowledgeListProcedures, limit+1, optional importerId eq |
| `packages/api-client/src/router/knowledge/detail.ts` | byId node + edges | ✓ VERIFIED | knowledgeDetailProcedures, null-on-missing, reads edges |
| `packages/api-client/src/router/knowledge/index.ts` | composed router | ✓ VERIFIED | knowledgeRouter spreads graph+list+detail |
| `packages/api-client/src/root.ts` | knowledge registration | ✓ VERIFIED | `knowledge: knowledgeRouter` (line 11) |
| `apps/web/package.json` | graph-viz deps | ✓ VERIFIED | @xyflow/react ^12.11.0 + @dagrejs/dagre ^3.0.0 |
| `apps/web/src/app/knowledge/page.tsx` | server page → island | ✓ VERIFIED | metadata + KnowledgeGraphIsland mount |
| `apps/web/src/app/knowledge/_components/knowledge-graph-island.tsx` | ssr:false wrapper | ✓ VERIFIED | dynamic(ssr:false) in a "use client" wrapper (Next.js 15 fix) |
| `apps/web/src/app/knowledge/_components/knowledge-graph.tsx` | three-zone composition | ✓ VERIFIED | ResizablePanelGroup 18/57/25 + all chrome + useQuery + layoutGraph |
| `apps/web/src/app/knowledge/_components/graph-layout.ts` | dagre TB util | ✓ VERIFIED | rankdir TB/64/32/16, pure |
| `apps/web/src/app/knowledge/_components/graph-nodes.tsx` | 6 node components | ✓ VERIFIED | exports nodeTypes with 6 keys |
| `apps/web/src/app/knowledge/_components/filter-rail.tsx` | filter rail | ✓ VERIFIED | 6 checkboxes + Show-all-instances switch + footer counts |
| `apps/web/src/app/knowledge/_components/node-detail-pane.tsx` | per-type pane + deep-links | ✓ VERIFIED | 6 per-type branches + /entities + /emails next/link |
| `apps/web/src/app/knowledge/_components/graph-toolbar.tsx` | toolbar | ✓ VERIFIED | zoom-to-fit + disabled layout-toggle + node count |
| `apps/web/src/app/knowledge/_components/taxonomy-banner.tsx` | banner | ✓ VERIFIED | localStorage-persisted, role=status |
| `apps/web/src/app/knowledge/_components/graph-states.tsx` | error + no-schema | ✓ VERIFIED | GraphErrorState + GraphNoSchemaState |
| `apps/web/src/components/app-sidebar.tsx` | nav flip | ✓ VERIFIED | Knowledge live, Soon empty |
| `apps/email-listener/.../confirm_region.py` | D-13 doc | ✓ VERIFIED | comment-only injection point, knowledge_synthesizer None today |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| root.ts | knowledge/index.ts | `knowledge: knowledgeRouter` | ✓ WIRED | import + registration both present |
| graph.ts | KnowledgeNodeEdges | provider-seam union read | ✓ WIRED | imported + selected in section (5) |
| graph.ts | ComponentEntityCandidateLinks | component↔instance derived edge | ✓ WIRED | innerJoin EntityInstances, wasSelected filter |
| page.tsx | knowledge-graph (island) | dynamic ssr:false | ✓ WIRED | via knowledge-graph-island.tsx wrapper |
| knowledge-graph.tsx | api.knowledge.graph | useQuery | ✓ WIRED | includeInstances bound to state |
| knowledge-graph.tsx | graph-layout.ts | dagre import | ✓ WIRED | layoutGraph(flowNodes, filteredEdges) |
| app-sidebar.tsx | /knowledge | LIVE_NAV_ITEMS entry | ✓ WIRED | href "/knowledge" present |
| node-detail-pane.tsx | /entities/[id] + /emails/[id] | next/link | ✓ WIRED | both hrefs present |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| knowledge-graph.tsx | `data` (nodes/edges) | `api.knowledge.graph.useQuery` → graph.ts Drizzle selects | Yes — live DB has 8 entity_types + 20 entity_type_fields | ✓ FLOWING (taxonomy real today) |
| graph.ts knowledge_node nodes | knowledgeNodeRows | KnowledgeNodes select | 0 rows today (knowledge_nodes=0) — by design; nodes "light up" when 4e writes | ✓ FLOWING (correct empty-today behavior per D-02) |
| graph.ts D-11 seam | explicitEdgeRows | KnowledgeNodeEdges select | 0 rows today — intentional empty seam (D-05) | ✓ FLOWING (seam live, 0 edges as designed) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Edges table exists in live DB | `with-env -- tsx scripts/assert-knowledge-node-edges.ts` | "ASSERTION PASSED ... exists" exit 0 | ✓ PASS |
| Edges table empty (D-05) | live count query | `knowledge_node_edges=0` | ✓ PASS |
| Graph data source non-empty | live count query | `entity_types=8`, `entity_type_fields=20`, `entity_instances=3`, `emails=15` | ✓ PASS |
| api-client tests (incl. knowledge graph/list) | `npm run test` | 102/102 passing (graph.test 11 + list.test 7) | ✓ PASS |
| /knowledge route compiles | `npm run web:build` | exit 0; /knowledge in route table (1.7 kB) | ✓ PASS |
| Read-only invariant | grep .mutation/insert/update/delete in knowledge router | 0 matches | ✓ PASS |
| XSS mitigation | grep dangerouslySetInnerHTML in _components | 0 real usages (comments only) | ✓ PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes are declared for this phase. The 11-01 plan defines a live-DB assertion gate (`assert-knowledge-node-edges.ts`), executed above with exit 0. Not applicable beyond that.

### Requirements Coverage

No REQ-IDs map to Phase 11. The ROADMAP states: "Decision-driven (11-CONTEXT.md D-01..D-13; seams D-05/D-10..D-13 mandatory); no REQ-IDs mapped". REQUIREMENTS.md contains no Phase-11 entries (grep returned no matches). Coverage is therefore tracked via the D-01..D-13 decisions, all of which are honored:

| Decision | Status | Evidence |
| -------- | ------ | -------- |
| D-01 ship-simple/seam-real | ✓ | derived FKs today + empty seam table |
| D-02 full concept graph, never blank | ✓ | taxonomy renders from 8 types/20 fields |
| D-03 importer-wide view | ✓ | graph reads whole network, not per-email |
| D-04 8 derived edge types | ✓ | all 8 emitted in graph.ts |
| D-05 empty edges table | ✓ | 0 rows, migration 0019 |
| D-06 union derived + table | ✓ | section (5) provider union |
| D-07 @xyflow/react + dagre | ✓ | installed + TB layout |
| D-08 interactions + client island | ✓ | ssr:false island, click/filter/deep-link |
| D-09 read-only | ✓ | no mutation anywhere |
| D-10 edges table = 4e write target | ✓ | table present |
| D-11 edge-provider seam | ✓ | single mapper for derived + table rows |
| D-12 tenant-by-data | ✓ | importerId optional eq filter only |
| D-13 documented synthesis trigger | ✓ | confirm_region.py comment-only |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| graph-toolbar.tsx | 63 | "placeholder" in a comment | ℹ️ Info | Comment about a disabled toolbar button's missing icon spec — not a code stub |
| knowledge-graph-skeleton.tsx | 4 | "placeholder" in a docstring | ℹ️ Info | Describes a legitimate loading skeleton (intended state), not an unimplemented stub |

No debt markers (TODO/FIXME/XXX/TBD/HACK) in any phase-modified file. No empty-data stubs flowing to render. The two "placeholder" hits are benign comments.

### Human Verification Required

None outstanding. The single human-verify gate in this phase — 11-03 Task 4 (browser visual/functional pass of the /knowledge surface) — was already executed and approved by the user (recorded in 11-03-SUMMARY.md "Browser Verification (Task 4): User-approved" and confirmed in the verification context). No new human-verification items were surfaced by this verification; all remaining checks were verifiable programmatically and passed.

### Gaps Summary

No gaps. The phase goal is achieved in the codebase:

- The read-only knowledge tRPC router (`graph`/`list`/`byId`) exists, is read-only, importer-filtered by data, unions the empty edges table through one provider seam, and is registered in `root.ts`.
- The empty `knowledge_node_edges` 4e write-seam exists with migration 0019 applied and asserted present in the live DB (0 rows, honoring D-05).
- The `/knowledge` route + React Flow surface (three-zone shell, filter rail, detail pane, toolbar, taxonomy banner, all states) renders real taxonomy data (8 types + 20 fields) and never blanks; web build is green with the route present.
- Decisions D-05/D-09/D-10/D-11/D-12/D-13 are all honored — most notably read-only (no mutation anywhere) and tenant-by-data (importerId is an optional eq filter, never a trusted caller claim).
- 102/102 api-client tests pass including the knowledge graph/list suites.

One PENDING DEPLOY follow-up is documented (not a phase gap): `migrate:staging` / `migrate:prod` to apply migration 0019 to staging+prod Supabase before the next deploy (per 11-01-SUMMARY). This is operational deploy work outside the phase's codebase-completion boundary.

---

_Verified: 2026-06-15T13:20:00Z_
_Verifier: Claude (gsd-verifier)_
