### Phase 11: Knowledge-node graph view (4e knowledge graph)

**Goal:** A graph/relationship visualization (`/knowledge`) of knowledge nodes and what they relate to (entity types, fields, instances, other nodes). Realizes Phase 9 request-6 **R6** and the deferred "4e Knowledge Graph" moat. Ships the SIMPLE, demoable-today version from existing FKs (D-01), with documented seams (empty `knowledge_node_edges` table, source-agnostic edge provider, tenant-by-data, documented synthesis trigger) so the real 4e synthesis backend drops in with no rework.
**Requirements**: Decision-driven (11-CONTEXT.md D-01..D-13; seams D-05/D-10..D-13 mandatory); no REQ-IDs mapped
**Status:** Planned (3 plans, 3 waves — 2026-06-15; backend Wave 1 → frontend foundation Wave 2 → frontend surface + human-verify Wave 3; READ-ONLY surface, D-09; knowledge_node_edges stays EMPTY, D-05)
**Depends on:** Phase 9 (shell) + Phase 10 (so the graph relates to real entity instances)
**Prerequisites (hard):** a NEW empty `knowledge_node_edges` table (the 4e write-seam, D-05); a knowledge tRPC router (`graph` + `list` + `byId`); a graph-viz dependency (`@xyflow/react` + `@dagrejs/dagre`). NOTE: knowledge-node SYNTHESIS/write path is explicitly DEFERRED to the future 4e phase (D-09) — this phase reads existing data + documents the injection point only (D-13).
**Plans:** 3/3 plans complete

Plans:
**Wave 1**
- [x] 11-01-PLAN.md — Backend: empty knowledge_node_edges table + [BLOCKING] migration 0019 + knowledge tRPC router (graph/list/byId) behind the inferred edge-provider seam + D-13 synthesis-trigger doc (D-02/04/05/06/09/10/11/12/13)
**Wave 2** *(depends on 11-01)*
- [x] 11-02-PLAN.md — Frontend foundation: @xyflow/react + @dagrejs/dagre install + /knowledge route (dynamic ssr:false client island) + dagre TB layout + 6 custom node types + edge styling + sidebar nav flip (D-02/04/07/08/11)
**Wave 3** *(depends on 11-02)*
- [x] 11-03-PLAN.md — Frontend surface: three-zone shell (filter rail / canvas / detail pane) + toolbar + taxonomy banner + per-type detail with /entities + /emails deep-links + all states + a11y + browser human-verify (D-02/03/08/09)

---
