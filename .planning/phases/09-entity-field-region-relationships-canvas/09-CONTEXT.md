# Phase 9: Entity/Field Region-Relationship Model + Canvas Surface - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Reshape the review surface from a flat list of regions into a **relationship model**
and an **editor-grade (Photoshop/Figma/Word/Excel-style) canvas**. Every region is
one of three roles — **ENTITY**, **FIELD** (a possible value of one property of a
parent entity), or **UNRELATED** — all manually controllable by the user (the human
overrides the AI). With an entity box selected, "Autofill" auto-detects and fills the
sub-field boxes inside it; the user rapidly confirms/denies each. Builds on the
Phase 5–8 surface (overlay layer, region edit ops, autofill/confirm, classify
page/document) and the existing `email_components.parent_component_id` nesting.

Scope clarifies HOW to implement this model + surface; new capabilities belong in
other phases (see Deferred Ideas).

**Expanded 2026-06-13 (request 6):** Phase 9 also delivers the **app-wide chrome** this
editor lives in — a global **navbar/sidebar app shell** (R1), a **glassy Gmail-style home
inbox** that surfaces + links each email's extracted entities (R5), and an **entity-type /
property management** page (R2). The browseable **entity gallery + detail** (R3/R4) and the
**knowledge-node graph** (R6) are split into Phases 10 and 11 because they require backend
(entity-resolution and knowledge-synthesis pipelines + tables) that does not exist yet —
see Deferred Ideas + `09-SCOPE-PROPOSAL.md`.
</domain>

<user_requirements>
## Verbatim user requests (2026-06-13 live-UAT) — preserved source of truth

1. "for each entity/region i also want to see which properties/fields it detected. i
   dont need to see every single field it think exists, thats bloating the ui"

2. "only show selected regions and their subfields. a region should correspond to an
   entity, a field should correspond to a region that has been identified as possibly
   being a value of that entity. if it is detected a region that is not an entity or
   that also isnt a possible field of an entity, we leave it as unrelated. i need to be
   able to manually control if a region is an entity and control which entity or a
   field, and if a field to which region its related to."

3. "refactor detected regions menu layout ... document preview and actions menu more
   organized and looking more like photoshop, word, excel, figma style applications.
   needs to be easy and zero friction to click drag over area of document, select an
   entity to relate it to, with that box selected following boxes I create will be
   fields of that one. with the big entity box selected i click to autofill and inside
   that box it tries to find the smaller boxes and prefill them with what field/property
   it thinks each box represents of the parent/entity"

4. (Canvas nav, this session) "least friction but also think about whole user
   navigability, zooming in and out, dragging, selecting, drawing rectangles."

5. (Review loop, this session) "confirm should have a checkbox or x buttons in box
   itself to make it easy so user can just select the entity box, then shows up field
   boxes autodetected and autofilled, then user just click click click next to each box
   and mark everything as confirm or denies." + "discuss about behavior for when it denies"

6. (App-wide refactor, this session) "expand the frontend refactor scope so that there is
   a navbar, a page to manage entities and their properties, an entities visualization
   page, with table or mosaic or entities that have been extracted, and each individual
   entity page with details and related objects, a default/home inbox page, but with also
   columns showing and linking to the entities extracted. inspire in gmail layout, but
   cleaner and glassy effect. a page for seeing knowledge nodes and which entities or
   fields or anything else they can be related to."

**Scope split for request 6 (decided 2026-06-13, see `09-SCOPE-PROPOSAL.md`).** The six
surfaces split by the data-reuse test ("needs new backend vs reuses existing data"):
- **In Phase 9:** R1 app shell/navbar (D-20/21), R5 glassy Gmail inbox with entity chips
  (D-22/23/24), R2 entity-type/property management CRUD (D-25/26/27 — new write endpoints,
  no new tables).
- **Deferred to their own phases (hard backend blockers):** R3 entity gallery + R4 entity
  detail → **Phase 10** (the deferred "4c entity-resolution" pipeline — no first-class
  extracted-entity row exists yet); R6 knowledge-node graph → **Phase 11** (deferred "4e
  knowledge synthesis" + a node-edge table + a graph-viz lib). See Deferred Ideas.

(Already shipped, NOT Phase 9 scope: "make preview open by default" — eea4e80,
auto-open first PDF attachment.)
</user_requirements>

<decisions>
## Implementation Decisions

### Relationship model & persistence (FIRST-CLASS, with migration)
- **D-01:** Three region **roles** — `entity`, `field`, `unrelated` — plus an
  **unclassified** state (a freshly drawn standalone box not yet assigned). Manual
  override ALWAYS wins over the AI's guess.
- **D-02:** Persist role as a **first-class column**, not jsonb. Add a NEW Drizzle
  pgEnum `component_role` = (`entity`, `field`, `unrelated`) and a **nullable `role`
  column on `email_components`** (NULL = unclassified/standalone). One migration in
  `packages/db`. Rationale: role is the core queryable concept of this phase and a
  new axis orthogonal to `extraction_status`; it must be indexable/auditable.
- **D-03:** An **ENTITY** region records its entity type via a new **nullable
  `entity_type_id` column on `email_components`** (FK → `entity_types.id`). Today the
  entity type lives only on `extraction_records`; Phase 9 makes "this region IS an
  entity of type X" first-class on the component itself.
- **D-04:** A **FIELD** region links to its parent ENTITY region via the **existing
  `parent_component_id`** (reuse Phase 6 nest plumbing) AND records WHICH property it
  maps to via a new **nullable `entity_type_field_id` column on `email_components`**
  (FK → `entity_type_fields.id`). FK chosen over a slug string for referential
  integrity and clean joins to label/type/required.
- **D-05:** **UNRELATED** regions are explicitly marked (`role='unrelated'`) and are
  excluded from the entity/field display by default (anti-bloat, D-12).

### Canvas / editor shell (FULL redesign)
- **D-06:** **Full editor-grade rebuild** of `/emails/[id]`: top **toolbar** (tools +
  Autofill/Confirm actions + zoom control), left **LAYERS panel** (entity→field tree,
  Figma-style — replaces the cramped `entities-list`), center **canvas** (PDF +
  overlays + draw), right **INSPECTOR** panel. Reuse the existing overlay/draw/geometry
  primitives (`overlay-layer`, `draw-overlay`, `region-overlay-box`, `geometry.ts`)
  inside the new frame; `@nauta/ui` (shadcn) only.
- **D-07:** **Canvas navigation:** zoom via Cmd/Ctrl+scroll (zoom to cursor) + toolbar
  control (`−ㅤ100%ㅤ+`, **Fit width**, **Fit page**) + trackpad pinch; **pan** via
  **Space+drag** (hand cursor) and wheel / two-finger scroll; reset-to-100% key.
- **D-08:** **Drawing model = least-friction default.** Drag on empty document area
  **draws a rectangle** (no tool to pick); **click a box selects** it; **Shift-click
  multi-selects**. Pan lives on Space-drag/scroll so it never collides with draw. A
  **Select/Move ⟷ Draw tool toggle** is available in the toolbar for users who prefer
  marquee-select, but the default needs no mode switch. **Esc** cancels an in-progress
  draw.
- **D-09:** **Moving** a box (drag body) or **resizing** (drag handles) reuses Phase 6
  **redraw** semantics — supersede, never mutate geometry (D-16).

### Role & relationship control (UX)
- **D-10:** **Active-parent model** (verbatim req): select an ENTITY box → boxes drawn
  next are auto-created as FIELDS of that entity (`role='field'`,
  `parent_component_id`=entity, awaiting property mapping). Draw with no entity selected
  → a standalone **unclassified** region.
- **D-11:** The right **INSPECTOR is the single place** to set/change a region's role
  and relationships: Entity → entity-type picker (reuse `entity-type-picker.tsx`);
  Field → parent-entity picker + property picker (property options = the parent entity
  type's `entity_type_fields`; `nest-picker.tsx` is the analog for parent selection);
  Unrelated → no extra controls.
- **D-12:** **Anti-bloat visibility:** by default the canvas + layers show **ENTITY
  boxes**; selecting an entity **reveals its FIELD boxes**; **UNRELATED boxes hidden
  behind a toggle**. The field list shows only **populated/related** fields, never every
  possible schema field.

### Sub-field autofill (NEW use case, entity-scoped)
- **D-13:** New use case **"Auto-detect & autofill fields within an entity":** given a
  selected ENTITY region (+ its entity type), the LLM scans the entity's **bbox**,
  detects likely value regions, **creates token-grounded FIELD boxes** for them (reuse
  `propose_regions.py` grounding helpers + `geometry.ts` containment), and maps each to
  a **property** (`entity_type_field_id`) + a **candidate value**. It ALSO incorporates
  any FIELD boxes the user already drew inside the entity.
- **D-14:** Autofill results land as **CANDIDATES** (record `status='candidate'`) with
  **per-field confidence** shown; nothing auto-confirms. Confirmation is explicit (D-16).
- **D-15:** **Writes go through FastAPI** (browser never holds `X-API-Key`); a new
  components-router endpoint (e.g. `POST /v1/components/{entity_id}/autofill-fields`)
  proxied by a new tRPC mutation (reuse `mutations.ts` `getListenerConfig` idiom).

### Rapid review — confirm / deny loop
- **D-16:** **Inline ✓ (confirm) / ✗ (deny) controls render directly on each candidate
  field box** (small floating control at the box corner), enabling "click-click-click"
  review without opening the inspector. Inspector is for corrections/details.
- **D-17:** **✓ confirm** promotes the field's candidate to `confirmed` (value +
  property + box), feeding the few-shot flywheel (embedding-on-confirm, D-15/D-16 from
  Phases 4/7).
- **D-18:** **✗ deny is ORIGIN-AWARE:** on an **auto-detected** field box → **soft-reject
  the box** (`extraction_status='rejected'`, kept in history, removed from default view —
  it was a machine guess). On a **user-drawn** field box → **keep the box, clear the
  wrong candidate value/property** so the user can re-fill or type it. Rule: the user's
  own boxes never vanish on deny; the AI's wrong guesses do.
- **D-19:** **Denials are remembered** — a denied auto-detected box is recorded so a
  re-run of Auto-detect on the same entity does **not** re-propose the same rejected box
  (e.g. exclude regions overlapping a rejected auto-detected field for that entity).

### App-wide shell & navigation (R1 — added 2026-06-13)
- **D-20:** **Global app shell wraps the whole web app.** Convert the bare root
  `apps/web/src/app/layout.tsx` (today only `TRPCReactProvider` + `Toaster`) into an
  app-shell layout: a persistent **left sidebar / navbar** with links to **Inbox (`/`)**,
  **Entity Types (`/entity-types`, ships this phase)**, and **Entities (`/entities`) +
  Knowledge (`/knowledge`)** shown as nav targets but **disabled / "coming soon"** until
  their phases (10/11) land. `{children}` renders in the shell content slot between the
  existing providers and `Toaster`. The Phase-9 `/emails/[id]` editor keeps its
  full-viewport canvas but paints below/right of the shell chrome (resolves the 09-UI-SPEC
  "below the application header (if any)" hedge).
- **D-21:** **Add the missing nav primitive(s) to `@nauta/ui` + wire theming.** No
  `sidebar.tsx` / `navigation-menu.tsx` exists in `packages/ui/src` — add the canonical
  shadcn **`sidebar`** block, reusing the **already-defined `--sidebar-*` HSL tokens** in
  `globals.css` and `lucide-react` icons. Wire **`next-themes`** (present in `@nauta/ui`,
  unwired) into the root layout for the glassy light/dark toggle. No new design tokens are
  invented (brand primary `164 39% 22%` + the sidebar tokens already exist).

### Glassy Gmail-style inbox (R5 — added 2026-06-13)
- **D-22:** **Rebuild `/` as a three-pane, glassy Gmail-style inbox.** Replace the
  single-column `Card` list with a **resizable three-pane** layout via the existing
  `resizable.tsx` (react-resizable-panels): folder/filter rail · message list · reading
  preview. Glass = `backdrop-blur-md` + translucent `bg-background/70` + hairline
  `border-border/50` (see UI-SPEC). `emails.list`'s existing `{items, hasMore, nextOffset}`
  pagination is reused verbatim. "Cleaner than Gmail" — generous spacing on the committed
  4px grid; **no second accent hue**.
- **D-23:** **Per-email "extracted entities" column/chips, derived from existing joins.**
  Each inbox row surfaces the **distinct entity-type labels (+ counts)** extracted from that
  email, reusing the **same `email_components ⟕ extraction_records [status ≠ superseded] ⟕
  entity_types` join** already in `emails/detail.ts` (dedupe-preferring-`confirmed`), lifted
  to a per-`email_id` aggregate (an enriched `emails.list` projection OR a parallel
  `emails.entitySummary` batch query keyed by the visible page of `email_id`s). Phase 9's
  own `role` / `entity_type_id` columns make this cheaper. **No new table.**
- **D-24:** **Entity chips are forward-compatible deep-links.** Chips link toward the future
  `/entities/[id]` (R3/R4); **until Phase 10 ships**, a chip deep-links to the source
  `/emails/[id]` editor where the region lives. Only the `href` changes later — keeps R5
  shippable inside Phase 9's no-new-backend boundary while honoring "columns that link to
  the entities."

### Entity-type & property management CRUD (R2 — added 2026-06-13)
- **D-25:** **New management surface at `/entity-types`** (under the shell): list all entity
  types; **create / rename / edit description / activate-deactivate** an entity type; and
  **create / edit / delete / reorder** its **fields/properties** (`label`, `slug`,
  `field_type`, `is_required`, `sort_order`, `is_identifier`). Built from `@nauta/ui`
  `form` / `input` / `select` / `checkbox` / `dialog` / `table`. This manages the *schema*
  of entity types, not per-email field display, so anti-bloat (D-12) is unaffected.
- **D-26:** **Writes go through NEW FastAPI endpoints** (browser never holds `X-API-Key`),
  proxied by **new tRPC mutations** following the `getListenerConfig` + server-side
  env-guard idiom (`mutations.ts`, Phases 6/7). Requires making the read-only
  `EntityTypeRepository` (`find_by_slug` / `list_active` today) **write-capable** (create /
  update / delete entity types and fields) plus new use cases. This is the **only backend
  expansion** in Phase 9 beyond the relationship migration — **no new tables** (`entity_types`
  + `entity_type_fields` already exist and are seeded with 8 system types).
- **D-27:** **Validation & integrity:** `field_type` is constrained to the allowed set
  (`string | number | date | array | object`) at the Zod/Pydantic boundary (free-text in the
  DB today); `slug` uniqueness per entity type is enforced; deleting a field already
  referenced by an `entity_type_field_id` on a confirmed component must be **guarded** (block
  or soft-deactivate, never orphan the D-04 FKs). System-default entity types
  (`importer_id` NULL) are editable; per-importer overrides remain out of scope.

### Claude's Discretion
- Exact migration column nullability/defaults; whether to promote `parent_component_id`
  to a declared FK now (it is currently a plain self-referential uuid).
- Structure of the sub-field autofill LLM call (one call per entity returning
  box→property→value vs per-box). Constraint: must yield token-grounded boxes + property
  mapping + per-field confidence.
- Mechanism for "remember denials" (rejected component + `content_raw` lineage flag, the
  Phase 6 pattern, vs a dedicated structure).
- Toolbar iconography, exact keybindings, zoom min/max, layers-tree affordances.
- Optimistic-update strategy for the new mutations (reuse the `use-region-edit.ts` idiom).
- Optional entity-level **"Confirm all"** affordance + per-entity completion state (all
  fields resolved) — include only if cheap.
- (R2) Whether `is_identifier` is promoted from `entity_type_fields.config` jsonb to a real
  column now or kept in jsonb; exact deactivate-vs-hard-delete semantics for entity
  types/fields with existing references; whether field reordering is drag-and-drop or numeric.
- (R1/R5) Sidebar collapse behavior + breakpoints; whether a ⌘K command palette ships now;
  exact glass opacity steps (`/60` vs `/70`) and which surfaces get `backdrop-blur`.
</decisions>

<specifics>
## Specific Ideas

- "Photoshop/Figma/Word/Excel feel" — real toolbar + panels + canvas, not a restyled
  sidebar.
- "Zero friction to click-drag over area" — **drag = draw by default**; pan/zoom on
  modifier keys so they never steal the draw gesture.
- The target review loop: **select entity → its field boxes appear auto-detected &
  autofilled → ✓ ✓ ✗ ✓ down the list** via inline controls.
- Origin-aware deny mantra: **"your boxes never disappear; the AI's guesses do."**
- Entities-first canvas: structure is legible at a glance; fields appear on demand.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase
- `.planning/phases/09-entity-field-region-relationships-canvas/09-CONTEXT.md` — this
  file (decisions + verbatim user requests, source of truth for Phase 9).
- `.planning/phases/09-entity-field-region-relationships-canvas/09-SCOPE-PROPOSAL.md` —
  request-6 decomposition (R1/R5/R2 in Phase 9; R3/R4 → P10; R6 → P11), hard blockers, and
  the Gmail + glass design direction. Investigated against the live schema/routers 2026-06-13.
- `.planning/ROADMAP.md` — Phase 9 entry (goal, dependencies on Phases 5–8).

### Prior-phase context the planner must honor
- `.planning/phases/05-review-ui-inbox-email-detail-with-document-preview-and-entit/05-CONTEXT.md`
  — tRPC+Drizzle data path, react-pdf overlay model, `polygonToRect`, source_type=region rule.
- `.planning/phases/06-region-edit-operations-on-the-document-preview-accept-redraw/06-CONTEXT.md`
  — supersede-never-mutate (D-16), status model, region edit endpoints, draw-mode math,
  nest = `parent_component_id`.
- `.planning/phases/07-click-to-autofill-ui-on-the-review-surface-selecting-a-regio/07-CONTEXT.md`
  — autofill/confirm proxy pattern, fields panel, entity-type picker, Bedrock-degradation rule.
- `.planning/phases/04-email-intelligence/04-CONTEXT.md` — Phase 4 backend contracts
  (autofill use case, extraction records, geometry/D-12) the new use case extends.

### UI design tokens / idioms (editor-grade surface)
- `.planning/phases/05-review-ui-inbox-email-detail-with-document-preview-and-entit/05-UI-SPEC.md`
- `.planning/phases/06-region-edit-operations-on-the-document-preview-accept-redraw/06-UI-SPEC.md`
- `.planning/phases/07-click-to-autofill-ui-on-the-review-surface-selecting-a-regio/07-UI-SPEC.md`
  — toolbar/badge/dialog tokens to extend into the editor shell. (Recommend a
  `/gsd:ui-phase 9` run to produce 09-UI-SPEC for the full editor layout.)

No external (non-planning) specs/ADRs — requirements are captured in the decisions above
plus the prior-phase context files.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (file:line)
- Frontend surface (`apps/web/src/app/emails/[id]/_components/`): `overlay-layer.tsx`,
  `draw-overlay.tsx`, `region-overlay-box.tsx`, `draw-mode-bar.tsx`, `pdf-preview-pane.tsx`,
  `entities-list.tsx` (→ becomes layers tree), `fields-panel.tsx` (→ moves to inspector),
  `action-toolbar.tsx` (→ becomes top toolbar), `entity-type-picker.tsx`, `nest-picker.tsx`
  (→ parent/property pickers), `reject-dialog.tsx`, `use-region-edit.ts`, `use-autofill.ts`.
- Geometry: `packages/api-client/src/geometry.ts` — `polygonToRect`,
  `clientXYToNormalized`, `normalizedRectToPolygon` (immutable, clamped [0,1]). Bbox
  containment for "is field box inside entity box?" derives from `polygonToRect`.
- Backend: `apps/email-listener/app/application/use_cases/autofill.py` (per-component
  autofill to extend), `confirm_region.py` (embedding-on-confirm flywheel),
  `edit_region.py` (accept/reject/redraw/split/merge/nest/create — incl. `_capture_text`,
  `_union_polygon`), `propose_regions.py` (token-grounded box creation — reuse for
  auto-detect), `infrastructure/supabase/component_repository.py`.
- API: `apps/email-listener/app/presentation/api/v1/components.py` (endpoint idiom,
  D-18 tenancy from component row).
- Data path: `packages/api-client/src/router/emails/detail.ts` (component+extraction
  join; dedupe; superseded filter), `.../emails/mutations.ts` (server-side FastAPI proxy).

### Data model (verified `packages/db/src/schema/`)
- `components.ts` `email_components`: has `parent_component_id` (plain self-ref uuid),
  `source_type` enum (incl. `region`), `location` jsonb (`page_index`, `polygon`),
  `content_raw` jsonb (lineage lives here per Phase 6), `embedding` halfvec(1536),
  `extraction_status` enum (default `candidate`). **NO `role`, NO `entity_type_id`,
  NO `entity_type_field_id`** → Phase 9 adds all three (D-02/03/04).
- `enums.ts`: `extraction_status` already has `rejected`+`superseded` (reuse for deny/
  supersede); **`component_role` is new**. `extractions.ts`: `extracted_fields`,
  `corrected_fields`, `confidence_score`, `confidence_breakdown`, `status`, `routing_reason`.
- `entity-types.ts`: `entity_types.id` and `entity_type_fields.id` (slug/label/field_type/
  is_required/sort_order) — FK targets for D-03/D-04.

### Established Patterns (constraints)
- **Supersede, never mutate geometry** (D-16) — moves/resizes/denied-detections become
  new rows or status transitions, not in-place edits.
- **Writes via FastAPI**; browser never holds `X-API-Key`; tRPC mutation proxy.
- **Status-gated UI** + optimistic updates (`use-region-edit.ts` snapshot/revert).
- **Tenant isolation (D-18):** importer_id derived from the component/page row, never the caller.
- **Bedrock reality:** live autofill may 404 until model access lands — degrade
  gracefully (toast, leave regions untouched, keep fully testable via mocks).

### Integration Points
- New migration in `packages/db` (role enum + 3 columns) → regenerate types.
- New backend use case + components endpoint (auto-detect/autofill fields within entity).
- New/extended tRPC mutations + `detail.ts` exposure of role / entity_type_id /
  entity_type_field_id per component.
- Full `/emails/[id]` layout rebuild around the existing primitives.
</code_context>

<deferred>
## Deferred Ideas

- **Entity gallery + individual-entity detail pages (R3/R4) → Phase 10.** Requires a
  first-class, cross-email "extracted entity" identity + the deferred **4c entity-resolution**
  pipeline to populate it (today entities are implicit `email_components` + `extraction_records`;
  `entity_instances` is an empty external Nauta mirror keyed by `nauta_id`). No list/detail
  API exists. Subsumes the original "entity-instance matching" deferral (backend `match_type`
  in research, no implementation).
- **Knowledge-node graph page (R6) → Phase 11.** Requires the deferred **4e knowledge
  synthesis** write path (`knowledge_nodes` is empty), a NEW node-edge table (today only a
  one-directional `scope_ref_id` attach, not a graph), a knowledge tRPC router, and a
  graph-viz dependency (none installed — only `recharts`, which cannot render a node graph).
- **Multi-page entity spanning** beyond the existing classify-document whole-attachment
  case (a single entity whose fields live across pages) — note, revisit if needed.
- **Bulk / cross-entity autofill** (auto-detect across all entities on a page at once).
- **Undo/redo stack** for canvas edits; **realtime multi-user** editing.
- **Negative few-shot learning** from denials (beyond "don't re-propose this box").
- **Non-rectangular polygon drawing**.

None of these are required to deliver the Phase 9 relationship model + canvas.
</deferred>

---

*Phase: 09-entity-field-region-relationships-canvas*
*Context gathered: 2026-06-13*
