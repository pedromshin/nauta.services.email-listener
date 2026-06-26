# Phase 6: Region edit operations on the document preview - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous run; recommended defaults from D-09/D-16, Phase 4/5 architecture, and the mission brief)

<domain>
## Phase Boundary

Make proposed entity regions editable from the Phase 5 preview: **accept / redraw /
split / merge / nest / reject**, wired to `email_components`. Two halves:

1. **Backend (FastAPI, apps/email-listener)** — region edit use cases + endpoints.
   The Python service owns domain writes (it owns supersede semantics, D-16).
2. **Frontend (apps/web)** — interactions on the Phase 5 overlay layer: select a
   region box → action toolbar; redraw via pointer-drawn rectangle; split/merge/nest
   flows; optimistic refresh of the detail query.

Out of scope: field-level autofill/confirm UI (Phase 7), key_terms (Phase 8).
</domain>

<decisions>
## Implementation Decisions

- **Writes go through FastAPI; the browser never holds the X-API-Key.** apps/web adds
  server-side proxy routes (tRPC mutations or Next route handlers) that call the
  email-listener service with `EMAIL_LISTENER_URL` + `EMAIL_LISTENER_API_KEY`
  (server-side env, fail-fast guard like SUPABASE keys in 05-02). tRPC mutations are
  preferred (typed client, same pattern as queries).
- **Supersede, never mutate geometry (D-16):** redraw/split/merge create NEW
  component row(s) (source_type="region", token-grounded fields where possible) and
  mark originals `extraction_status="superseded"`. Accept/reject are status-only
  transitions on the existing row. Nest sets `parent_component_id` (no supersede).
- **Status model (existing enum values only — no migration):** proposed regions are
  `pending` (from ProposeRegionsUseCase). accept → `candidate` (a real region awaiting
  extraction — Phase 7 autofill operates on these). reject → `rejected`.
  Human-created regions (redraw/split/merge outputs) are born `candidate` — human
  regions are source of truth (D-09).
- **Endpoints (FastAPI, X-API-Key, tenant from component row per D-18):**
  - POST /v1/components/{id}/accept
  - POST /v1/components/{id}/reject
  - POST /v1/components/{id}/redraw  body: {polygon, page_index} (0–1, 4-corner)
  - POST /v1/components/{id}/split   body: {regions: [{polygon, page_index}, ...]} (≥2)
  - POST /v1/components/merge        body: {component_ids: [≥2], polygon?, page_index}
  - POST /v1/components/{id}/nest    body: {parent_component_id | null}
  Each returns the resulting component(s). ValueError → 404; invalid geometry → 422.
- **Geometry validation at the boundary (Pydantic):** polygon = exactly 4 [x,y]
  pairs, every coordinate clamped/validated in [0,1]; page_index ≥ 0 and must exist
  on the attachment. content_text for human-drawn regions: best-effort token capture
  — select tokens from the parent page component's content_raw whose bboxes
  intersect the new polygon (reuse 04-14 union/grounding helpers); empty is OK.
- **Frontend interactions (build on Phase 5 components, @nauta/ui only):**
  - Click overlay box (or entities-list row) → selection state → action toolbar
    (Accept / Reject / Redraw / Split / Merge / Nest).
  - Redraw: drawing mode — pointer down/drag/up over the page canvas → normalized
    rect (reuse rendered-page-size math inverse of polygonToRect). Esc cancels.
  - Split: draw N sub-rects inside the selected region, then confirm.
  - Merge: multi-select (shift-click or checkbox in entities list) → merge button.
  - Nest: select child then "Nest into…" picker of regions on the same page.
  - After any mutation: invalidate/refetch emails.detail; superseded/rejected boxes
    disappear (or render struck-through behind a "show history" toggle — optional).
- **Empty-data reality:** with Bedrock still blocked there may be zero proposed
  regions. Redraw-from-scratch ("Add region" — draw a new region on a page with no
  proposals, born candidate) MUST work so the feature is usable/demoable today.
  Implement as the same draw mode bound to a page-level "Add region" button
  (internally a create endpoint: POST /v1/components/{page_component_id}/regions).
- **Tests:** Python: use-case unit tests per op (status transitions, supersede,
  lineage, validation rejects) + endpoint tests; extend the real-Postgres
  integration test with one region-edit round-trip. Web: vitest for the
  rect-normalization inverse helper; typecheck + build gates.
</decisions>

<code_context>
## Existing Code Insights

- `apps/email-listener/app/application/use_cases/propose_regions.py` — how regions
  are created (token grounding, polygon union); reuse its helpers for redraw/split
  content capture.
- `apps/email-listener/app/presentation/api/v1/components.py` — endpoint idiom
  (autofill/confirm; D-18 tenancy: derive importer from component row).
- `apps/email-listener/app/infrastructure/supabase/component_repository.py` —
  save_many/update patterns; will need a status-update + supersede method.
- `packages/db/src/schema/enums.ts` — component_source_type has "region";
  extraction_status has pending/candidate/rejected/superseded already.
- `apps/web/src/app/emails/[id]/_components/` — overlay-layer, region-overlay-box,
  pdf-preview-pane (controlled page nav), email-detail (selection state hoisted).
- `packages/api-client/src/router/emails/detail.ts` — detail query to invalidate;
  excludes superseded extraction records (CR-03 fix) — region filtering must also
  exclude superseded/rejected components for the default view.
- 05-02 route handler — server-side env guard idiom for new EMAIL_LISTENER_* vars.
</code_context>

<specifics>
## Specific Ideas

- Component lineage: store `superseded_by`/origin in `content_raw.lineage` (jsonb)
  rather than new columns — no migration; auditable.
- Merge polygon default = union of merged polygons (reuse _union_polygon).
- Keyboard: Esc cancels draw mode; Delete = reject selected.
- Toolbar copy and styles follow 05-UI-SPEC tokens; destructive variant for Reject.
</specifics>

<deferred>
## Deferred Ideas

- Click-to-autofill + confirm flows — Phase 7 (the accept→candidate transition feeds it).
- key_terms extraction — Phase 8.
- Undo/redo stack; multi-page regions; polygon (non-rect) drawing.
- Realtime multi-user editing.
</deferred>
