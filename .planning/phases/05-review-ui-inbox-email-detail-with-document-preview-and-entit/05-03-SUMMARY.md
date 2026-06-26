---
phase: 05-review-ui-inbox-email-detail-with-document-preview-and-entit
plan: "03"
subsystem: web-ui
tags: [next-js, trpc, email-detail, dompurify, accessibility]
dependency_graph:
  requires: ["05-01", "05-02"]
  provides: ["email-detail-route", "email-body-sanitized", "inbox-links", "detected-regions-list"]
  affects: ["05-04"]
tech_stack:
  added: ["dompurify ^3", "@types/dompurify ^3"]
  patterns: ["Next.js 15 async params", "DOMPurify client-only guard", "JSONB unknown narrowing", "immutable state updaters"]
key_files:
  created:
    - apps/web/src/app/emails/[id]/page.tsx
    - apps/web/src/app/emails/[id]/_components/email-detail.tsx
    - apps/web/src/app/emails/[id]/_components/metadata-card.tsx
    - apps/web/src/app/emails/[id]/_components/body-card.tsx
    - apps/web/src/app/emails/[id]/_components/attachments-card.tsx
    - apps/web/src/app/emails/[id]/_components/entities-list.tsx
  modified:
    - apps/web/src/app/page.tsx
    - apps/web/package.json
decisions:
  - "DOMPurify client-only guard: typeof window !== 'undefined' check prevents SSR crash; empty string fallback on server"
  - "location JSONB narrowed via getPageIndex() helper instead of cast — trusts unknown, narrows explicitly (CLAUDE.md: use unknown and narrow)"
  - "storageKey typed as string|null to match Drizzle schema; storageKey is only used for display, not for download URL"
  - "EntitiesList onHoverComponent wired to setActiveComponentId — adequate for Phase 5 read-only; separate hover state arrives in 05-04"
  - "api-client dist rebuild required: dist was stale (lacked detail procedure) because dist/ is gitignored and not rebuilt on install"
metrics:
  duration: "~30 min"
  completed: "2026-06-12"
  tasks_completed: 3
  files_count: 8
---

# Phase 05 Plan 03: Email Detail Page — Non-PDF Surface Summary

Email detail route with real `emails.detail` tRPC data: subject/metadata/body-tabs/attachments/detected-regions wired end-to-end, DOMPurify HTML sanitization, and non-alarming empty state for Bedrock-blocked regions.

## What Was Built

### Task 1: Route shell + EmailDetail container + inbox links

- `apps/web/src/app/emails/[id]/page.tsx`: Next.js 15 server component with `await params` pattern (both `generateMetadata` and the default export), mounts `<EmailDetail emailId={id} />`.
- `apps/web/src/app/emails/[id]/_components/email-detail.tsx`: `"use client"` component owning the `api.emails.detail.useQuery` call and all §8 shared state (activeAttachmentId, activeComponentId, currentPage, numPages, scale, pageSize, showOverlays, signedUrls). Renders 4 states: loading (Skeletons), error (role="alert" Card), not-found (Card), and the live two-panel grid.
- `apps/web/src/app/page.tsx`: each inbox row wrapped in `<Link href={/emails/${email.id}}>` with `hover:bg-muted/50 transition-colors`.

### Task 2: MetadataCard + BodyCard + AttachmentsCard

- `metadata-card.tsx`: `<dl>/<dt>/<dd>` semantic rows for From, To (truncated to 2 + "+N more"), Received, Importer (Badge outline), Status (Badge variant from parseStatusVariant).
- `body-card.tsx`: `<Tabs defaultValue="text">` with Plain text tab (pre role="region") and HTML tab (disabled when no HTML). DOMPurify.sanitize called with `typeof window !== "undefined"` guard; `dangerouslySetInnerHTML` with Biome ignore comment documenting T-05-10 threat mitigation.
- `attachments-card.tsx`: per-attachment row with file glyph, filename, content-type Badge, and "View PDF" (calls onView) or "Download" (fetch /api/attachments/[id] + window.open). Immutable signedUrls cache update: `(prev) => ({ ...prev, [id]: url })`. Inline fetch error message for user-friendly display.
- `apps/web/package.json`: `dompurify ^3` + `@types/dompurify ^3` added.

### Task 3: EntitiesList — Detected Regions + intentional empty state

- `entities-list.tsx`: filters `components` to `sourceType === "region"`. Empty state (zero regions OR no region components) renders `text-muted-foreground py-8 text-center text-sm space-y-2` with "No detected regions yet" heading and pending-processing message — NO `role="alert"`, NO destructive color.
- Non-empty state: `<ul role="list">` / `<li role="listitem">` with button rows showing entityTypeLabel (or extractionStatus fallback), Badge, and attachment filename + page number. `aria-pressed` for active component.
- `location` JSONB column narrowed via `getPageIndex(unknown)` helper (Drizzle returns `unknown` for JSON columns).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] api-client dist stale — detail procedure missing from compiled types**

- **Found during:** Typecheck after creating email-detail.tsx
- **Issue:** `apps/web/tsc --noEmit` produced `Property 'detail' does not exist on type '...'` because `packages/api-client/dist/root.d.ts` was compiled before the `emailDetailProcedures` spread was added in 05-01. The dist is gitignored and not rebuilt on `npm install`.
- **Fix:** Ran `cd packages/api-client && npx tsc` to regenerate dist with updated type definitions.
- **Files modified:** `packages/api-client/dist/` (gitignored, not committed)

**2. [Rule 1 - Type mismatch] Component.location typed as structured object but Drizzle returns unknown**

- **Found during:** Second typecheck pass
- **Issue:** EntitiesList interface had `location: { page_index?: number; ... } | null` but the API type for JSONB columns is `unknown`.
- **Fix:** Changed interface to `location: unknown` and introduced `getPageIndex(location: unknown): number` narrowing helper.
- **Files modified:** `entities-list.tsx`

**3. [Rule 1 - Type mismatch] Attachment.storageKey typed as string but DB allows null**

- **Found during:** Second typecheck pass
- **Issue:** AttachmentsCard interface had `storageKey: string` but the Drizzle column is nullable.
- **Fix:** Changed to `storageKey: string | null`.
- **Files modified:** `attachments-card.tsx`

## Known Stubs

None — all components are wired to real `emails.detail` data.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: xss | body-card.tsx | HTML body rendered via dangerouslySetInnerHTML — mitigated by DOMPurify.sanitize before render (T-05-10) |

## Self-Check: PASSED

- `apps/web/src/app/emails/[id]/page.tsx` — FOUND
- `apps/web/src/app/emails/[id]/_components/email-detail.tsx` — FOUND
- `apps/web/src/app/emails/[id]/_components/metadata-card.tsx` — FOUND
- `apps/web/src/app/emails/[id]/_components/body-card.tsx` — FOUND
- `apps/web/src/app/emails/[id]/_components/attachments-card.tsx` — FOUND
- `apps/web/src/app/emails/[id]/_components/entities-list.tsx` — FOUND
- Commit 51e4ff7 (Task 1) — FOUND
- Commit 0eadfaa (Task 2) — FOUND
- Commit b46de35 (Task 3) — FOUND
