---
phase: "05"
plan: "04"
subsystem: web/email-detail
tags: [react-pdf, pdf-preview, overlay, region-detection, ui]
dependency_graph:
  requires: [05-03]
  provides: [pdf-preview-pane, region-overlay-boxes, overlay-layer]
  affects: [email-detail]
tech_stack:
  added: [react-pdf@9.2.1, pdfjs-dist@4.10.38]
  patterns: [pdfjs-worker-module-url, geometry-subpath-export, css-display-none-overlay-preserve]
key_files:
  created:
    - apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx
    - apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx
    - apps/web/src/app/emails/[id]/_components/overlay-layer.tsx
  modified:
    - apps/web/src/app/emails/[id]/_components/email-detail.tsx
    - apps/web/package.json
    - packages/api-client/package.json
    - packages/db/src/client.ts
decisions:
  - "polygonToRect imported from @nauta/api-client/geometry subpath (not barrel) to prevent postgres from entering the client bundle"
  - "Overlay layer hidden via CSS display:none (not unmounted) to preserve bidirectional sync state per §7.3"
  - "NEXT_PHASE=phase-production-build added to skipValidation in db/client.ts for build-time env-less builds"
  - "confidenceScore typed as unknown (Drizzle numeric columns return string at runtime)"
metrics:
  duration_minutes: 35
  completed_date: "2026-06-12"
  tasks_completed: 3
  files_created: 3
  files_modified: 4
---

# Phase 05 Plan 04: PDF Preview Pane + Region Overlay Boxes Summary

**One-liner:** react-pdf v9 PDF preview with toolbar, per-page region overlay boxes positioned from polygonToRect, and bidirectional sync wiring into email-detail.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | react-pdf install + PdfPreviewPane | b06b533 | pdf-preview-pane.tsx, email-detail.tsx, package.json |
| 2 | RegionOverlayBox | 0eb6167 | region-overlay-box.tsx |
| 3 | OverlayLayer + phase gates | cdb3a29 | overlay-layer.tsx |
| — | Fix: client bundle isolation | 4b364b3 | region-overlay-box.tsx, api-client/package.json, db/client.ts |

## Phase Gate Results

| Gate | Result |
|------|--------|
| api-client vitest (5 tests) | PASS |
| api-client typecheck | PASS |
| web typecheck | PASS |
| next build | PASS (no DB env vars required) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Client bundle pulled in postgres/fs/perf_hooks via @nauta/api-client barrel**
- **Found during:** Task 3 (next build)
- **Issue:** `region-overlay-box.tsx` imported `polygonToRect` from `@nauta/api-client` index, which re-exports `appRouter` + server-side tRPC, pulling postgres (Node.js-only) into the browser bundle.
- **Fix:** Added `./geometry` subpath export to `packages/api-client/package.json`; changed import to `@nauta/api-client/geometry`.
- **Files modified:** packages/api-client/package.json, region-overlay-box.tsx
- **Commit:** 4b364b3

**2. [Rule 2 - Missing critical functionality] next build failed with env validation at build time**
- **Found during:** Task 3 (next build phase gate)
- **Issue:** `packages/db/src/client.ts` calls `createEnv` at import time; during `collectPageData`, Next.js imports the tRPC route handler which imports db/client.ts, triggering Zod validation on missing `POSTGRES_URL`.
- **Fix:** Added `process.env.NEXT_PHASE === "phase-production-build"` to `skipValidation` in db/client.ts. This is the T3 App standard pattern for runtime-only env guards.
- **Files modified:** packages/db/src/client.ts
- **Commit:** 4b364b3

**3. [Rule 1 - Bug] confidenceScore typed as number | null in Component interfaces**
- **Found during:** Task 1 typecheck verification
- **Issue:** Drizzle returns numeric(5,4) columns as `string` at runtime; API response type is `string | null`. All three new Component interfaces had `confidenceScore: number | null`.
- **Fix:** Changed to `confidenceScore: unknown` (consistent with `location: unknown` and `extractedFields: unknown` pattern used throughout).
- **Files modified:** pdf-preview-pane.tsx, region-overlay-box.tsx, overlay-layer.tsx

## Known Stubs

None. The PDF preview pane displays an intentional empty overlay state (no region boxes) when no components with sourceType="region" are present — this is by design per the plan spec: "Empty overlay state is the DEFAULT (Bedrock blocked): preview with zero region components must look intentional per UI-SPEC."

## Threat Flags

None. This plan adds only client-side rendering components. No new network endpoints, auth paths, or schema changes were introduced. The `/api/attachments/[id]` route already existed from plan 05-03.

## Self-Check: PASSED

- [x] pdf-preview-pane.tsx exists and exports `PdfPreviewPane`
- [x] region-overlay-box.tsx exists and exports `RegionOverlayBox`
- [x] overlay-layer.tsx exists and exports `OverlayLayer`
- [x] Commits b06b533, 0eb6167, cdb3a29, 4b364b3 verified in git log
- [x] All phase gates pass (api-client test+typecheck, web typecheck+build)
