---
phase: 05-review-ui-inbox-email-detail-with-document-preview-and-entit
verified: 2026-06-12T16:42:00Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open a real /emails/[id] URL in the browser (dev server running, at least one seeded email in DB)"
    expected: "Page renders with subject, metadata (From/To/Received/Importer/Status), plain-text body tab as default, HTML tab sanitized (or disabled when absent), Attachments card with View PDF / Download buttons, and Detected Regions card showing the intentional 'No detected regions yet' empty state (non-alarming, no error colour)"
    why_human: "Next.js React rendering, tRPC data fetch from live DB, and empty-state presentation require a browser — cannot verify visually with grep"
  - test: "Click 'View PDF' on a PDF attachment (dev server + seeded attachment with a real PDF in Supabase Storage)"
    expected: "PDF renders in-browser in the preview pane below the right panel; toolbar shows filename, page nav (← Prev / Next →), Page N / M counter, − + zoom buttons, 'Show regions' switch (on by default), and ✕ close button; the preview is fully usable with no overlay boxes in the default Bedrock-blocked state"
    why_human: "react-pdf Document/Page rendering, signed-URL fetch from /api/attachments/[id], and overlay zero-state require a running browser + real storage"
  - test: "Navigate the inbox list page and click an email row"
    expected: "Clicking the row navigates to /emails/[id] via next/link — not a full-page reload"
    why_human: "Client-side navigation behaviour requires browser confirmation"
---

# Phase 05: Review UI — Inbox Email Detail Verification Report

**Phase Goal:** Build the first real slice of the review UI on the shipped Next.js inbox: an email detail page (body + metadata + attachment list), in-browser PDF preview of attachments, and entity-region overlay boxes drawn over the preview from the `components` table's normalized geometry, labeled with detected entity identifiers. Read-only. Degrades gracefully while region Components are empty.
**Verified:** 2026-06-12T16:42:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `emails.detail` returns email row, attachments, and components joined to entity-type label/slug and latest extraction fields | VERIFIED | `detail.ts` — three-query pattern; leftJoin(ExtractionRecords) + leftJoin(EntityTypes); projects entityTypeLabel, entityTypeSlug, extractedFields, confidenceScore; D-18 satisfied (no importerId filter in SQL, only doc-comment reference) |
| 2 | `polygonToRect` converts a 0-1 four-corner polygon to `{left, top, width, height}` fractions and is unit-tested | VERIFIED | `geometry.ts` exists with pure min/max implementation; `geometry.test.ts` has exactly 5 tests covering axis-aligned, full-page, skewed/diamond, single-point degenerate, and immutability; `npm run test` exits 0 (5/5 pass) |
| 3 | vitest runs in packages/api-client and the geometry suite passes | VERIFIED | `vitest.config.ts` present; `package.json` has `"test": "vitest run"` script; live run confirmed 5/5 pass |
| 4 | `GET /api/attachments/[id]` returns `{ url }` JSON with a 60s signed URL; validates UUID (400), handles missing attachment (404), guards missing secrets (500) | VERIFIED | `route.ts`: UUID_RE validation returns 400; missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY returns 500 with `console.error`; missing row returns 404; `createSignedUrl(storageKey, 60)` returns `{ url: data.signedUrl }`; service-role key never in response body |
| 5 | Service-role key is read from process.env server-side only, never exposed in response body | VERIFIED | `route.ts` reads from `process.env.SUPABASE_SERVICE_ROLE_KEY`; no `NEXT_PUBLIC_` prefix; response shapes are only `{ url }` or `{ error }`; no `console.log` in file |
| 6 | Visiting `/emails/[id]` renders email subject, metadata, body, and attachments list from real `emails.detail` data | VERIFIED | `email-detail.tsx` calls `api.emails.detail.useQuery({ id: emailId })`; renders MetadataCard, BodyCard, AttachmentsCard, EntitiesList; handles loading (skeletons), error (role="alert" card), and null (not-found card) states |
| 7 | Each inbox row links to its `/emails/[id]` detail page | VERIFIED | `apps/web/src/app/page.tsx` line 73: `<Link key={email.id} href={\`/emails/${email.id}\`} className="block">` wraps each Card row |
| 8 | HTML body is sanitized with DOMPurify before render; plain-text is the default tab | VERIFIED | `body-card.tsx`: `DOMPurify.sanitize(bodyHtml)` with `typeof window !== "undefined"` client-only guard; `<Tabs defaultValue="text">`; HTML tab disabled when bodyHtml null; `dangerouslySetInnerHTML={{ __html: safeHtml }}` only in HTML tab |
| 9 | The detected-regions list shows the intentional non-alarming empty state when no region components exist | VERIFIED | `entities-list.tsx`: when `regionComponents.length === 0` renders `<p className="text-foreground font-semibold">No detected regions yet</p>` and `<p>Document segmentation is pending…</p>`; no `role="alert"`, no `border-destructive`; no accept/reject/redraw controls |
| 10 | Region components (`sourceType === "region"`) with a polygon on the current page render as overlay boxes scaled to rendered page pixel size via `polygonToRect` | VERIFIED | `overlay-layer.tsx` filters `c.sourceType !== "region"`, checks `hasPolygon(c.location)`, and `page_index === currentPage - 1`; passes filtered list to `<RegionOverlayBox>`; `region-overlay-box.tsx` imports `polygonToRect` from `@nauta/api-client/geometry` subpath and scales by `pageSize.width/height` |
| 11 | All phase gates pass: api-client tests, api-client typecheck, web typecheck, next build | VERIFIED | Live runs: `npm run test` = 5/5 pass; `api-client npm run typecheck` = exit 0; `apps/web npm run typecheck` = exit 0; `.next/` build directory exists with `app-build-manifest.json` (build confirmed from SUMMARY + artifact) |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api-client/src/router/emails/detail.ts` | emails.detail tRPC procedure | VERIFIED | 112 lines; exports `emailDetailProcedures`; three-query pattern; D-18 compliant |
| `packages/api-client/src/geometry.ts` | polygonToRect pure geometry helper | VERIFIED | 33 lines; named export only; pure min/max; returns new object per call |
| `packages/api-client/src/geometry.test.ts` | Unit tests for polygonToRect | VERIFIED | 5 tests; uses vitest describe/it/expect; all pass |
| `packages/api-client/vitest.config.ts` | vitest runner config | VERIFIED | Present; defineConfig; node environment; includes src/**/*.test.ts |
| `apps/web/src/app/api/attachments/[id]/route.ts` | signed-URL route handler (GET) | VERIFIED | 91 lines; UUID validation; missing-secret guard; createSignedUrl 60s TTL; no console.log |
| `apps/web/src/app/emails/[id]/page.tsx` | Next.js detail route shell | VERIFIED | Server component; exports generateMetadata + default EmailDetailPage |
| `apps/web/src/app/emails/[id]/_components/email-detail.tsx` | Client component owning emails.detail query + shared state | VERIFIED | 237 lines; all §8 state hoisted; PdfPreviewPane wired; four render states |
| `apps/web/src/app/emails/[id]/_components/body-card.tsx` | Plain-text/HTML body tabs with DOMPurify | VERIFIED | DOMPurify.sanitize with window guard; defaultValue="text"; HTML tab disabled when absent |
| `apps/web/src/app/emails/[id]/_components/entities-list.tsx` | Detected Regions list + empty state | VERIFIED | "No detected regions yet" exact copy; role="list"; no edit controls |
| `apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx` | react-pdf Document/Page pane + toolbar | VERIFIED | 248 lines; GlobalWorkerOptions.workerSrc set; onRenderSuccess captures pageSize; toolbar with nav/zoom/show-regions/close |
| `apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx` | Single overlay box from a region component | VERIFIED | imports polygonToRect from @nauta/api-client/geometry subpath; role="region"; sync handlers; label chip; tooltip |
| `apps/web/src/app/emails/[id]/_components/overlay-layer.tsx` | Per-page overlay container filtering region components | VERIFIED | sourceType==="region" + hasPolygon + page_index filter; role="group"; pointer-events-none container |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/api-client/src/router/emails/index.ts` | emailDetailProcedures | `...emailDetailProcedures` spread | VERIFIED | Line 15: `...emailDetailProcedures,` |
| `packages/api-client/src/index.ts` | polygonToRect | re-export from geometry.ts | VERIFIED | Line 23: `export { polygonToRect } from "./geometry";` |
| `apps/web/src/app/page.tsx` | /emails/[id] | next/link on each inbox row | VERIFIED | Line 73: `<Link key={email.id} href={\`/emails/${email.id}\`}>` |
| `apps/web/src/app/emails/[id]/_components/email-detail.tsx` | emails.detail | `api.emails.detail.useQuery` | VERIFIED | Line 39: `api.emails.detail.useQuery({ id: emailId })` |
| `apps/web/src/app/emails/[id]/_components/body-card.tsx` | DOMPurify | `DOMPurify.sanitize` before dangerouslySetInnerHTML | VERIFIED | Line 29-31: sanitize with window guard |
| `apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx` | polygonToRect | import from @nauta/api-client/geometry | VERIFIED | Line 3: `import { polygonToRect } from "@nauta/api-client/geometry"` (subpath export — avoids pulling postgres into client bundle) |
| `apps/web/src/app/api/attachments/[id]/route.ts` | email-attachments bucket | createSignedUrl(storageKey, 60) | VERIFIED | Line 79: `supabase.storage.from("email-attachments").createSignedUrl(storageKey, 60)` |
| `apps/web/src/app/emails/[id]/_components/overlay-layer.tsx` | region components on current page | filter sourceType==="region" && page_index===currentPage-1 | VERIFIED | Lines 66-71: filter on sourceType, hasPolygon, and page_index |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `email-detail.tsx` | `data` (email, attachments, components) | `api.emails.detail.useQuery` → Drizzle three-query joins against Postgres | Yes — real DB selects from Emails, EmailAttachments, EmailComponents | FLOWING |
| `overlay-layer.tsx` | `overlays` (filtered components) | Passed from email-detail via props; filtered by sourceType/polygon/page_index | Yes — filters a real prop array; empty in Bedrock-blocked state by design | FLOWING (intentionally empty default) |
| `route.ts` | `storageKey` | Drizzle `db.select({ storageKey }).from(EmailAttachments).where(eq(...id...))` | Yes — real DB lookup before signed-URL call | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| geometry vitest suite (5 tests) | `cd packages/api-client && npm run test` | 5/5 passed (exit 0) | PASS |
| api-client typecheck | `cd packages/api-client && npm run typecheck` | exit 0, no errors | PASS |
| apps/web typecheck | `cd apps/web && npm run typecheck` | exit 0, no errors | PASS |
| next build artifact | `.next/app-build-manifest.json` exists | file present | PASS |
| No DEFAULT_IMPORTER_ID in detail.ts (D-18) | grep for DEFAULT_IMPORTER_ID in code | only in doc-comment (line 7), no SQL filter | PASS |
| No autofill/reprocess/accept/reject in emails/ components | grep -i "autofill\|reprocess\|accept\|reject" | 0 matches | PASS |
| No console.log in route.ts | grep "console.log" | 0 matches | PASS |

### Probe Execution

Step 7c: No `scripts/*/tests/probe-*.sh` files exist for this phase. SKIPPED — phase is a UI/tRPC build with no declared probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| D-18 (no DEFAULT_IMPORTER_ID filter) | 05-01, 05-CONTEXT | tRPC reads are cross-importer — no importerId filter | SATISFIED | detail.ts filters by emailId only; verified in code + confirmed no importerId SQL clause |
| D-12 (page_index + 0-1 bbox polygon geometry) | 05-04, 05-CONTEXT | overlay boxes use normalized polygon × rendered page size | SATISFIED | polygonToRect + OverlayLayer + RegionOverlayBox implement this end-to-end |
| Graceful empty-overlay degradation | 05-CONTEXT hard constraint | UI works with zero region components (Bedrock blocked) | SATISFIED | OverlayLayer renders zero boxes when filter returns empty; EntitiesList shows non-alarming empty state |
| HTML sanitization (T-05-10) | 05-03, 05-CONTEXT | DOMPurify sanitizes bodyHtml before dangerouslySetInnerHTML | SATISFIED | body-card.tsx: DOMPurify.sanitize with client-only guard; plain-text is default tab |
| Service-role key not browser-exposed (T-05-05) | 05-02 | SUPABASE_SERVICE_ROLE_KEY server-side only; no NEXT_PUBLIC_ prefix | SATISFIED | route.ts reads from process.env; response shapes only { url } or { error } |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | No TBD/FIXME/XXX markers; no stub return null patterns; no hardcoded empty arrays in rendering paths | — | — |

**Notable decision:** `region-overlay-box.tsx` imports `polygonToRect` from `@nauta/api-client/geometry` (subpath export), NOT from the barrel `@nauta/api-client`. This was a deliberate auto-fix during plan 05-04 execution: the barrel re-exports `appRouter` which pulls postgres/Node.js-only modules into the client bundle. The subpath export was added to `packages/api-client/package.json` to isolate the pure geometry helper. This is correct and clean.

### Human Verification Required

#### 1. Email Detail Page Full Render

**Test:** With dev server running (`npm run dev` in apps/web) and at least one email in the database, open `http://localhost:3000` (inbox), then click an email row.
**Expected:** Navigation to `/emails/[id]`; page renders subject (h1), "← Back to inbox" link, parseStatus badge, MetadataCard (From/To/Received/Importer/Status in a dl), BodyCard with "Plain text" tab selected by default, Attachments card, and Detected Regions card showing "No detected regions yet" / "Document segmentation is pending…" in muted non-error styling.
**Why human:** React hydration, tRPC fetch from live database, and visual layout/copy presentation require a browser.

#### 2. PDF Preview Pane Render

**Test:** With a PDF attachment available in Supabase Storage, click "View PDF" on an attachment in the detail page.
**Expected:** PDF renders inline below the right panel using react-pdf; toolbar shows truncated filename, page navigation buttons (← Prev / Next →) disabled at boundaries, Page 1 / N counter, − / + zoom buttons with disabled states at 0.5x and 3.0x, "Show regions" Switch (on by default), and ✕ close button. With zero region components (Bedrock blocked), no overlay boxes appear — the preview is fully usable and looks intentional, not broken.
**Why human:** react-pdf Document/Page rendering, signed-URL round-trip to Supabase Storage, zoom/nav interactivity, and visual overlay-empty state require a live browser session.

#### 3. Inbox Row Navigation

**Test:** On the inbox list page (`/`), click any email card row.
**Expected:** Client-side navigation (no full-page reload) to `/emails/[id]` via next/link.
**Why human:** next/link client-side navigation behavior requires browser confirmation.

---

### Gaps Summary

No gaps. All 11 must-have truths are verified against the actual codebase:
- The geometry helper is substantive, tested, and re-exported correctly.
- The tRPC detail procedure does real three-query joins with no forbidden importer filter.
- The signed-URL route handler is fully implemented with all required guards.
- The detail page and all sub-components exist, are wired to real data, contain no stubs, and use DOMPurify correctly.
- The PDF preview pane, overlay layer, and region box are all substantive implementations — not placeholders.
- All four phase gates (api-client test, api-client typecheck, web typecheck, next build) confirmed passing.

The only unresolved items are visual/behavioral checks that require a running browser (human UAT items above). These are expected for a UI phase and were anticipated in the phase context.

---

_Verified: 2026-06-12T16:42:00Z_
_Verifier: Claude (gsd-verifier)_
