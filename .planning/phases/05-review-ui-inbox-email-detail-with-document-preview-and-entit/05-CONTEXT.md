# Phase 5: Review UI — inbox email detail with document preview and entity-region overlays - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous run; recommended defaults from ROADMAP goal, 04-CONTEXT deferred/inbox-UX sections, 04-RESEARCH §8, and the verified mission briefing)

<domain>
## Phase Boundary

First real slice of the review UI on the shipped Next.js inbox (apps/web, tRPC
api-client, @nauta/ui):

1. **Email detail page** (`/emails/[id]`): body (text + sanitized HTML toggle),
   metadata (sender, recipients, received_at, parse_status, importer), attachment list.
2. **In-browser PDF preview** of attachments (the core user surface).
3. **Entity-region overlay boxes** drawn over the preview from `email_components`
   rows' normalized geometry (D-12: `location.page_index` + 0–1 `location.polygon`),
   labeled with detected entity identifiers from `extraction_records`/`entity_types`.

READ-ONLY against Phase 4's data model (04-RESEARCH §8 EmailView/EmailComponentView
shape). Region accept/redraw/split/merge/nest/reject and click-to-autofill are
LATER phases (6+) that build on this preview.

**Hard constraint:** AWS Bedrock Anthropic access is human-blocked (use-case form
not submitted) — region Components and extractions are EMPTY in every env. The UI
MUST degrade gracefully: detail page + PDF preview fully functional with zero
overlays, with an honest empty state ("no detected regions yet"). Do not block on
or simulate segmentation output.
</domain>

<decisions>
## Implementation Decisions

- **Data access = tRPC + Drizzle (packages/api-client + packages/db), NOT the
  FastAPI read API.** The shipped inbox already reads `emails` via
  `publicProcedure` + `ctx.db`; extend that pattern with `emails.detail`
  (bodies + attachments), and component/extraction queries. D-18 applies: no
  DEFAULT_IMPORTER_ID filter anywhere — list across importers, optional
  `importerId` input (the existing `emails.list` already does this; keep it).
- **Attachment bytes via server-side Supabase Storage** (bucket
  `email-attachments`, key = attachments.storage_key): a Next.js route handler
  (or tRPC query returning a short-lived signed URL) using the service-role key
  server-side only. Do NOT proxy through FastAPI (avoids X-API-Key exposure in
  the browser and a second hop).
- **PDF rendering: react-pdf (pdf.js)** — needed because overlays must scale with
  the rendered page size; native iframe viewers give no page geometry. Overlay
  layer = absolutely-positioned divs over each page: rect from polygon min/max ×
  rendered page dimensions (polygon is 0–1 normalized, top-left origin).
- **Overlay source**: `email_components` where `attachment_id` matches and
  `location.polygon` exists; one box per component on its `location.page_index`.
  Label: entity type label + key identifier from the component's latest active
  `extraction_records.extracted_fields` when present; fallback to
  `extraction_status` badge. Page-level components (full-page union polygons from
  the parser) should be visually distinguishable (or filterable) from region
  proposals so the preview isn't one giant box — recommended: render only
  `source_type="region"` components as overlay boxes; page components feed the
  text panel.
- **Detected-entities summary** on the detail page (from 04-CONTEXT "inbox UX"):
  a sidebar/section listing components + their extraction status; clicking scrolls
  the preview to that page and highlights the box (hover-highlight per §8 [C1]).
  Process/reprocess control buttons: OUT of scope this phase (reprocess endpoint
  exists in FastAPI but wiring controls is Phase 6+ territory) — show read-only
  status only.
- **HTML body must be sanitized** before render (e.g. DOMPurify or
  rehype-sanitize) — emails are untrusted input. Plain-text view is default.
- **Styling/components**: @nauta/ui (shadcn) exclusively, matching the existing
  inbox page idiom (Cards, Badges, Skeletons).
- **Testing**: follow repo conventions — unit tests for geometry mapping
  (polygon → CSS rect) and router queries; existing api-client __tests__ pattern.
</decisions>

<code_context>
## Existing Code Insights

- `apps/web/src/app/page.tsx` — shipped inbox list using `api.emails.list`
  (tRPC + @nauta/ui Cards/Badges/Skeleton). Phase 5 adds `/emails/[id]` route.
- `packages/api-client/src/router/emails/index.ts` — `list` (importer-optional,
  paginated) + `byId`. Extend with attachments/components/extractions joins.
- `packages/db/src/schema/` — Drizzle schema: emails, attachments
  (email_attachments, `storage_key`, `file_ext`), components (email_components,
  `location` jsonb, `content_text`, `extraction_status`, `source_type`),
  extractions (extraction_records incl. `confidence_breakdown`, `routing_reason`
  after migration 0011), entity-types.
- Geometry ground truth (04-13/04-14): `location.polygon` = 4-corner 0–1
  normalized, top-left origin; per-token geometry in `content_raw.tokens`.
  Region components carry token-grounded polygons once Bedrock unblocks.
- `apps/email-listener` FastAPI: GET /v1/emails(+/{id}, attachments download,
  reprocess) exist (D-18-consistent) but are NOT the UI's data path.
- Supabase Storage bucket `email-attachments`; local stack running
  (http://127.0.0.1:54321). Web env needs SUPABASE_URL + service key server-side.
</code_context>

<specifics>
## Specific Ideas

- Inbox row → `/emails/[id]`: keep list page, add Link.
- Detail layout: left = email body + metadata; right (or below) = attachments;
  attachment click → PDF preview pane with page navigation; overlay toggle.
- Empty-region state must say segmentation is pending (Bedrock gated), not error.
- Geometry mapping helper shared + unit-tested: `polygonToRect(polygon) ->
  {left, top, width, height}` in fractions; multiply by rendered page size at
  the component layer.
- importer_id visible as a small badge on detail (data partitioning visibility).
</specifics>

<deferred>
## Deferred Ideas

- Region edit ops (accept/redraw/split/merge/nest/reject) — Phase 6.
- Click-to-autofill + confirm flows (POST /v1/components/{id}/autofill, /confirm) — Phase 7.
- trgm key_terms extractor (backend, activates hybrid retrieval) — Phase 8.
- Process/reprocess control buttons on the detail page — with Phase 6/7 actions.
- Auth / per-user tenancy — future; D-18 documents the seam.
</deferred>
