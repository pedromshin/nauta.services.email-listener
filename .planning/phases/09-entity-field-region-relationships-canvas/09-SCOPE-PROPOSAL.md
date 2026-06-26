# Phase 9 Scope Proposal: App-Wide Redesign Decomposition

**Drafted:** 2026-06-13
**Author:** scope-synthesis (subagent)
**Status:** Proposal — for review before `/gsd:plan-phase 9`
**Inputs:** 09-CONTEXT.md (D-01..D-19), ROADMAP.md, and 4 parallel investigator reports
(web-shell, data-model, backend-read-apis, planning-docs).

---

## Summary

The user wants to grow Phase 9 from a **single-email canvas/region editor** (already
fully decided in D-01..D-19) into an **app-wide redesign** with six new asks:
a global app shell (R1), entity-type/property management CRUD (R2), an extracted-entity
gallery (R3), an individual-entity detail page (R4), a glassy Gmail-style home inbox with
entity columns (R5), and a knowledge-nodes graph view (R6).

The decisive split is **"does it need new backend (tables/endpoints) or does it reuse what
ships in Phase 9 + what already exists?"**

- **Belongs in Phase 9 (presentation-only over existing data):** **R1** (app shell/navbar)
  and **R5** (Gmail inbox layout) — both are pure frontend over data that already exists
  (`emails`, `email_components`, `extraction_records`, plus the Phase-9 `role`/
  `entity_type_id` columns this phase already adds). Phase 9 is *already* "the frontend
  refactor," and R1 is in fact a **structural prerequisite** for everything else to be
  navigable. I fold these in as **D-20..D-24**.

- **Must be their own phases (data-model / backend dependent):**
  - **R2** (entity-type + field CRUD) — the entity-types tRPC router and the FastAPI
    `EntityTypeRepository` are **read-only**; there is **zero write path**. New phase.
  - **R3 + R4** (entity gallery + entity detail) — there is **no first-class
    "extracted-entity" row**, no list/detail API, and the one candidate table
    (`entity_instances`) is an **external Nauta mirror keyed by `nauta_id`** and is
    **empty**. The populating pipeline is the explicitly-deferred "4c Entity Resolution"
    work. New phase, **blocked** on that resolution backend.
  - **R6** (knowledge graph) — `knowledge_nodes` is a **flat one-directional context table**
    with no node↔node / node↔entity-type edge table, is **unpopulated**, and has **no
    router and no graph-viz library installed**. This is the deferred "4e Knowledge Graph"
    moat. New phase, **blocked** on synthesis backend + an edges table + a graph dependency.

Net: **R1 + R5 join Phase 9**; **R2, {R3+R4}, and R6 become three new phases** (4c/4e are
effectively pre-written for two of them). Hard blockers are enumerated in their own section.

A note on scope discipline: 09-CONTEXT.md's own `<deferred>` section already names
"Entity-instance matching … its own phase," and the ROADMAP records no app-wide chrome.
Adding R1/R5 to Phase 9 is consistent with "this is a large redesign of the core surface";
pulling R2/R3/R4/R6 in would silently absorb the deferred 4c/4e backend into a frontend
phase, which is exactly the boundary 09-CONTEXT drew.

---

## Request-by-Request Decomposition

| Request | Verdict | Why | Prereqs |
|---|---|---|---|
| **R1 — global navbar / app shell** | **Phase 9 (add D-20, D-21)** | Pure presentation. Root `layout.tsx` is bare (only `TRPCReactProvider` + `Toaster`); no nav exists. Needs no new tables/endpoints (data-model investigator: "no data-model gap"). It is the **structural prerequisite** for R2–R6 to be reachable, and Phase 9 is already the frontend refactor. | Add a `sidebar`/`navigation-menu` primitive to `@nauta/ui` (none exist today); wire `next-themes` into root layout (dep present, unwired). Reuse existing `sidebar-*` HSL tokens + `lucide-react`. |
| **R2 — manage entity types + properties (CRUD)** | **New phase (Phase 10)** | READ exists (`entityTypes.list`, system-defaults only) but **WRITE is entirely absent**: no tRPC create/update/delete, no FastAPI routes, and `EntityTypeRepository` exposes only `find_by_slug`/`list_active`. Schema (`entity_types` + `entity_type_fields`) fully supports it — the gap is the **write path**, which is backend work, not frontend. | New tRPC mutations (via `getListenerConfig` proxy), new FastAPI write endpoints + a write repository/use cases. Decide `is_identifier` (lives in `entity_type_fields.config` jsonb today). importer-scoped overrides currently unused. |
| **R3 — extracted-entities gallery (table/mosaic)** | **New phase (Phase 11), BLOCKED** | **No first-class extracted-entity row exists.** Today an "entity" is implicit (`email_components` + `extraction_records`). `entity_instances` is an **external Nauta mirror** (`nauta_id`-keyed), **unpopulated**, with **no router**. No cross-email aggregation, no list API, no index for a role-based gallery query. | The **deferred "4c Entity Resolution"** backend (populate entity identity), an `entityInstances.list` query, and an index. See Hard Blockers. |
| **R4 — individual entity page + related objects** | **New phase (Phase 11), BLOCKED** | Depends on R3's identity. "Related objects" (same PO across emails) have **no join table** for extracted entities — `parent_component_id` only nests field→entity *within one document* and isn't even a declared FK. `component_entity_candidate_links` *could* model occurrences but is **empty and external-keyed**. | Same 4c backend as R3; an `entityInstances.byId` detail query joining candidate-links / extraction-records / scoped knowledge nodes. Ships with R3. |
| **R5 — glassy Gmail inbox with entity columns** | **Phase 9 (add D-22, D-23, D-24)** | Inbox already exists (`/` + `emails.list`); surfacing detected entities per email was **always the intent** (04-CONTEXT "inbox UX"). The three-pane layout + glass is pure CSS (`resizable.tsx` + `backdrop-blur` both available). The per-email entity rollup uses the **same `email_components → extraction_records → entity_types` join** Phase 9 already ships in `detail.ts` — no new table. | Enrich `emails.list` (or add a parallel summary query) to aggregate entity-type labels/counts per email_id. Deep-link target for R3/R4 can degrade to the existing `/emails/[id]` until those pages exist. |
| **R6 — knowledge-nodes graph view** | **New phase (Phase 12), BLOCKED** | `knowledge_nodes` is a **flat one-directional polymorphic attach** (single `scope_ref_id`), **not a node+edge graph**: no node↔node table, no node↔entity-type/field many-to-many. It is **unpopulated**, has **no router**, and **no graph-viz library is installed anywhere** (no reactflow/@xyflow/d3/cytoscape — only recharts). | The **deferred "4e Knowledge Graph"** synthesis backend (populate nodes), a NEW `knowledge_node_edges` table, a graph tRPC router, and a graph-viz dependency. See Hard Blockers. |

---

## Proposed Phase 9 Additions (D-20+)

These extend the existing D-01..D-19 single-email editor scope. They are limited strictly
to surfaces that reuse data already present (or already added by Phase 9's own migration)
and need **no new backend tables and no new FastAPI endpoints**. They DO require a couple
of net-new **frontend** `@nauta/ui` primitives (a sidebar/nav), which are presentation, not
data.

### App shell (R1)

- **D-20 — Global app shell wraps the whole web app.** Convert the bare root
  `apps/web/src/app/layout.tsx` into an app-shell layout: a persistent **left sidebar /
  top navbar** (links: Inbox `/`, the future Entities/Entity-Types/Knowledge routes shown
  as nav targets even before their pages land — degrade to "coming soon"/disabled until
  their phases ship), wrapping `{children}` between the existing `TRPCReactProvider` and
  `Toaster`. The current per-page centered `<main>` (inbox `max-w-3xl`, detail
  `max-w-7xl`) moves *inside* the shell's content slot. The Phase-9 `/emails/[id]` editor
  keeps its full-viewport canvas but now paints **below/right of** the shell chrome
  (resolves the 09-UI-SPEC hedge "below the application header (if any)").

- **D-21 — Add the missing nav primitive(s) to `@nauta/ui` + wire theming.** There is
  **no** `sidebar.tsx`/`navigation-menu.tsx`/`navbar.tsx` in `packages/ui/src`. Add the
  canonical shadcn **`sidebar`** block (and/or `navigation-menu`) to `@nauta/ui`, reusing
  the **already-defined `--sidebar-*` HSL tokens** in `globals.css` (background/foreground/
  primary/accent/border/ring) and `lucide-react ^0.364.0` icons. Wire **`next-themes
  ^0.3.0`** (present in `@nauta/ui`, unwired) into the root layout so the glassy light/dark
  toggle works app-wide. No new design tokens are invented — the brand primary
  (`164 39% 22%` teal) and sidebar tokens already exist.

### Glassy Gmail inbox (R5)

- **D-22 — Rebuild `/` as a three-pane, glassy Gmail-style inbox.** Replace the single-
  column `Card`-list inbox with a **resizable three-pane** layout using the existing
  `resizable.tsx` (react-resizable-panels): folder/filter rail (left) · message list
  (center) · reading preview (right). Reuse the existing status `Badge` + sender/date row
  pattern. Glass is achieved with `backdrop-blur` + translucent `bg-*/NN` (see Design
  Direction). `emails.list`'s existing `{items, hasMore, nextOffset}` cursor-less
  pagination is reused verbatim.

- **D-23 — Per-email "extracted entities" column/chips, derived from existing joins.**
  Surface, per inbox row, the **distinct entity-type labels (+ counts)** extracted from
  that email. This reuses the **exact join already in `emails/detail.ts`**
  (`email_components` ⟕ `extraction_records` [status ≠ superseded] ⟕ `entity_types`,
  dedupe-preferring-`confirmed`) — lifted into a per-`email_id` aggregate. After Phase 9's
  own migration, `email_components.role='entity'` + `entity_type_id` make this cheaper and
  cleaner (no reliance on the indirect extraction-record join). **No new table.** Provide
  this either as an enriched `emails.list` projection or a small parallel
  `emails.entitySummary` batch query keyed by the visible page of `email_id`s.

- **D-24 — Entity chips are forward-compatible deep-links that degrade gracefully.** Each
  entity chip links toward the future `/entities/[id]` (R3/R4); **until that phase ships**,
  the chip deep-links to the source `/emails/[id]` editor (where the region lives) so R5 is
  shippable **without** R3/R4. When the entities phase lands, only the chip's `href`
  changes. This keeps R5 inside Phase 9's no-new-backend boundary while honoring the user's
  "columns that surface and link to the entities."

**Explicitly NOT added to Phase 9:** any write path for entity types (R2), any
extracted-entity identity/aggregation table or list/detail API (R3/R4), and any
knowledge-node graph (R6) — all require new backend per the Hard Blockers below.

---

## Recommended New Phases

The investigators confirm the long-designed 04-RESEARCH §11 phase-boundary table (4a–4e)
already enumerates most of this work. I map the requests onto it:

### Phase 10 — Entity-Type & Property Management (CRUD)

- **Scope:** A management surface (route under the new shell, e.g. `/entity-types`) to
  create/update/deactivate **entity types** and create/update/delete/reorder their
  **fields/properties**. Backed by NEW write endpoints.
- **Covers:** R2.
- **Prerequisites (hard):**
  - New **FastAPI write endpoints** + a **write-capable** entity-type repository + use
    cases (today `EntityTypeRepository` is read-only: `find_by_slug` / `list_active`).
  - New **tRPC mutations** (`entityTypes.create/update/delete`, `fields.*`) following the
    `getListenerConfig` + `X-API-Key` server-side proxy idiom (never client-side).
  - Decide where **`is_identifier`** lives (currently inside `entity_type_fields.config`
    jsonb — promote to a column or keep in jsonb). `field_type` is free-text today;
    enforce the allowed set (`string|number|date|array|object`) in app code/Zod.
  - Decide **importer-scoped overrides** (schema supports `importer_id NULL = system
    default`, but nothing writes overrides; current `list` ignores `importerId`).
- **No new tables required** — schema (`entity_types`, `entity_type_fields`) is complete
  and seeded (8 system types). This is purely a missing **write path** + UI.
- **Depends on:** Phase 9 (app shell to host the route).

### Phase 11 — Extracted-Entity Identity, Gallery & Detail (4c Entity Resolution)

- **Scope:** Promote "extracted entity" to a **first-class, browseable, cross-email
  identity**, then build the **gallery** (`/entities`, table OR mosaic) and the
  **individual-entity page** (`/entities/[id]` with related emails/components/fields/
  knowledge). This is the deferred **"4c Entity Resolution"** sub-phase made real.
- **Covers:** R3 + R4 (they share the same identity model and ship together).
- **Prerequisites (hard):**
  - A **populated entity-identity store.** Decide between (a) **repurpose
    `entity_instances`** away from "external Nauta mirror" to also hold email-extracted
    identities (it has `display_name`/`identifiers`/`aliases`/`embedding` already), or
    (b) a **new `extracted_entities` aggregation table** for cross-email identity. Either
    way a **resolution/matching pipeline** must populate it (the deferred `match_type`
    work: `semantic | identifier_exact | identifier_fuzzy | alias`).
  - **Occurrence edges:** populate `component_entity_candidate_links`
    (component ↔ entity_instance, `was_selected`, `match_type`) — currently empty — so the
    detail page can show "which emails/components reference this entity."
  - New **tRPC `entityInstances` router**: `list` (filter by `entityTypeId`/`importerId`,
    search over `displayName`/`identifiers`, `limit+1` pagination) and `byId` (entity +
    occurrences + scoped `knowledge_nodes` where `scope='entity_instance'`).
  - An **index** on the gallery query path (e.g. `email_components(role, entity_type_id)`
    or the chosen identity table).
- **Reuse:** `entity_instances`/`component-links` schema (built, indexed, just unread);
  `groupEntityTypeRows` join-collapse pattern; `emails.detail` dedupe-preferring-confirmed
  logic; `@nauta/ui` `table` + `card` (mosaic) + the `email-detail.tsx` header+grid
  structural template for the detail layout.
- **Depends on:** Phase 9 (shell) and the 4c resolution backend. **This is the hard
  blocker** — R3/R4 cannot show real data until extracted entities are populated.

### Phase 12 — Knowledge-Node Graph View (4e Knowledge Graph)

- **Scope:** A **graph/relationship visualization** (`/knowledge`) of knowledge nodes and
  what they relate to (entity types, fields, instances, other nodes). This is the deferred
  **"4e Knowledge Graph"** moat made visible.
- **Covers:** R6.
- **Prerequisites (hard):**
  - A **knowledge-node synthesis/write path** to populate `knowledge_nodes` (today: zero
    rows, no write code; the "nightly synthesis / learning loop" is explicitly deferred).
  - A **NEW edges table** (e.g. `knowledge_node_edges(source_node_id, target_ref_type,
    target_ref_id, relation_type)`). `knowledge_nodes` today has only a **single nullable
    `scope_ref_id`** — one directional attach, not a many-to-many graph. The graph view
    requires real edges.
  - A new **graph-viz dependency** — none is installed (`@xyflow/react` /
    `react-force-graph` / `cytoscape` are all absent; only `recharts`, which cannot render
    a node graph).
  - A new **tRPC `knowledgeNodes` router** (`list` + a `graph` query returning nodes +
    edges).
- **Reuse:** `knowledge_nodes` schema (title/content/scope/embedding/confidence),
  `component_knowledge_node_links` audit edges (component ↔ node) once populated.
- **Depends on:** Phase 9 (shell), likely **after** Phase 11 (so the graph can relate to
  real entity instances), and on the 4e synthesis backend.

**Sequencing recommendation:** Phase 9 (shell + inbox) → Phase 10 (entity-type CRUD, fully
unblocked, smallest) → Phase 11 (4c entities, unblocks R3/R4/R5-deep-links) → Phase 12
(4e graph, the moat, last). R1's shell must land first because R2/R3/R4/R6 have nowhere to
live otherwise.

---

## Hard Blockers

Each is a concrete missing table/endpoint/dependency, with the request it gates.

1. **No entity-type WRITE path (gates R2 / Phase 10).** `entityTypes` tRPC router is
   `list`-only; FastAPI `EntityTypeRepository` exposes only `find_by_slug` / `list_active`
   (read). No create/update/delete mutation or endpoint anywhere. *Tables exist; the write
   layer does not.*

2. **No first-class extracted-entity row (gates R3+R4 / Phase 11).** Extracted entities are
   **implicit** (`email_components` + `extraction_records`). The only candidate identity
   table, `entity_instances`, is an **external Nauta MIRROR keyed by `nauta_id`** and is
   **unpopulated** — it is explicitly "not a second source of truth." There is no
   cross-email aggregation row.

3. **No entity-resolution / population pipeline (gates R3+R4 / Phase 11).** The deferred
   "4c Entity Resolution" backend (`match_type` population into
   `component_entity_candidate_links`, vector + `pg_trgm` identifier matching) does not
   exist. Both that link table and `entity_instances` are empty. *Without it R3/R4 render
   nothing real.*

4. **No entity list/detail API (gates R3+R4 / Phase 11).** No tRPC procedure reads
   `entity_instances` or `component_entity_candidate_links`; no FastAPI endpoint returns
   entity instances or cross-email rollups.

5. **No knowledge-node EDGE table (gates R6 / Phase 12).** `knowledge_nodes` has a single
   nullable polymorphic `scope_ref_id` (one-directional attach). There is **no** node↔node
   table and **no** node↔entity-type/field many-to-many — i.e. no graph edges to draw.

6. **No knowledge-node population/synthesis path (gates R6 / Phase 12).** `knowledge_nodes`
   has zero rows and no write code; the "knowledge-node learning loop / nightly synthesis"
   is explicitly deferred ("the moat").

7. **No knowledge API (gates R6 / Phase 12).** No tRPC/FastAPI router reads `knowledge_nodes`
   or `component_knowledge_node_links`.

8. **No graph-visualization library installed (gates R6 / Phase 12).** Grep of the lockfile
   found **zero** of reactflow/@xyflow/d3/d3-force/cytoscape/react-force-graph/vis-network/
   sigma/graphology/@visx/dagre/elkjs. Only `recharts` is present, which cannot render a
   node-edge graph. A new dependency is required.

**Non-blockers worth noting (so they aren't mistaken for blockers):**

- **R1** has *no data blocker* — only the missing `@nauta/ui` `sidebar`/`navigation-menu`
  **frontend** primitive (net-new component, not a table).
- **R5** has *no table blocker* — the email→entity join path already exists; Phase 9's own
  `role`/`entity_type_id` columns merely make it cheaper. The only "new" work is an
  aggregate projection on an existing query.

---

## Design Direction (Gmail layout + glass)

Grounded entirely in the **actual** Tailwind 3.4 + `@nauta/ui` (shadcn) setup the
investigators found — no new design system, no invented tokens.

### Layout skeleton (Gmail three-pane, cleaner)

- **App shell (R1 / D-20):** a **persistent left rail** built from the shadcn `sidebar`
  block (to be added to `@nauta/ui`), using the **already-present `--sidebar-*` HSL
  tokens** so it themes for free in light/dark. Nav items use `lucide-react` icons (Inbox,
  Entities, Entity Types, Knowledge). The rail collapses to icons on narrow widths (shadcn
  sidebar supports this natively).
- **Inbox (R5 / D-22):** the classic **three panes** via the existing
  `resizable.tsx` (`react-resizable-panels`): *rail/filters · message list · reading
  preview*. This mirrors Gmail without copying its density — generous spacing on the
  existing **4px grid** the 09-UI-SPEC already standardized.
- **Entity gallery (Phase 11):** `@nauta/ui` `table` for the table view and a `card` grid
  for the mosaic/gallery toggle (the heavier `spreadsheet-grid` ag-grid is available if a
  data-dense table is wanted).
- **Entity detail (Phase 11):** reuse the **`email-detail.tsx` structural template**
  (header + responsive left/right grid) for consistency with the editor.

### Glassy / frosted aesthetic (feasible, currently unused)

The repo has **essentially zero app-level glass today** (the only `backdrop-filter:blur` is
inside the ag-grid theme). Tailwind ships `backdrop-blur-*` utilities by default and
`tailwindcss-animate` is configured, so glass is a styling decision, not new tooling:

- **Frosted chrome panels:** sidebar, top bar, and the inbox reading-pane header use
  `bg-background/70` (or `/60`) + `backdrop-blur-md` + a hairline `border-border/50`. This
  gives the translucent "frosted" feel while keeping shadcn token semantics.
- **Brand accent:** the existing **teal primary `164 39% 22%`** is the single accent for
  active nav, selected rows, and the Phase-9 armed-tool/active-parent state — consistent
  with the 09-UI-SPEC "armed-tool accent" and "2 font weights" constraints already
  committed. Do **not** add a second accent hue.
- **Entity chips (R5 / D-23):** small translucent `Badge`s tinted by entity-type, echoing
  the canvas overlay tint idiom already in the codebase (`bg-primary/10`-style opacity
  tints used by region overlay boxes) — so the inbox and the editor share a visual
  language for "this is an entity of type X."
- **Depth, not heaviness:** rely on `backdrop-blur` + subtle translucency + the existing
  border tokens for separation rather than heavy drop-shadows; keep the surface "cleaner
  than Gmail" as requested. Light/dark both come from `next-themes` (D-21) over the
  existing `:root`/`.dark` token sets — glass `/NN` opacities work in both because they
  reference the themed `--background`/`--card` variables.

### What to add vs reuse (design-system inventory)

- **Add to `@nauta/ui` (net-new, frontend only):** `sidebar` (canonical app-shell block)
  and optionally `navigation-menu`; wire `next-themes` ThemeProvider into the root layout.
- **Reuse as-is:** `resizable`, `table`, `card`, `tabs`, `sheet`, `dialog`, `command`
  (a Gmail-style ⌘K search/palette), `scroll-area`, `avatar`, `popover`, `separator`,
  `badge`, `breadcrumb`, `skeleton`, `form`/`input`/`select`/`textarea`/`checkbox`
  (R2 CRUD forms), and the `spreadsheet-grid` (heavy data tables). All confirmed present.
- **Tokens:** the full HSL token set incl. `--sidebar-*` and brand `primary` is already in
  `globals.css` and wired in `tailwind.config` — **reuse directly**, invent nothing.

---

*Phase: 09-entity-field-region-relationships-canvas*
*Proposal drafted: 2026-06-13*
