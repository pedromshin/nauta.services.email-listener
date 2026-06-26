---
phase: "05-review-ui-inbox-email-detail-with-document-preview-and-entit"
plan: "01"
subsystem: "api-client"
tags: ["trpc", "drizzle", "geometry", "vitest", "tdd"]

dependency_graph:
  requires:
    - "packages/db/src/schema (Emails, EmailAttachments, EmailComponents, ExtractionRecords, EntityTypes)"
    - "packages/api-client/src/trpc.ts (publicProcedure, createTRPCRouter)"
  provides:
    - "emails.detail tRPC procedure — email + attachments + components join"
    - "polygonToRect geometry helper — normalized polygon → CSS-fraction rect"
    - "vitest runner for packages/api-client"
  affects:
    - "packages/api-client/src/router/emails/index.ts (emailsRouter extended)"
    - "packages/api-client/src/index.ts (polygonToRect re-exported)"

tech_stack:
  added:
    - "vitest 2.1.9 — test runner for packages/api-client"
  patterns:
    - "TDD RED/GREEN/REFACTOR cycle for geometry helper"
    - "Plain object spread to merge tRPC procedures (emailDetailProcedures)"
    - "Three-query pattern (email + attachments + components+joins) to avoid cartesian product"
    - "leftJoin for optional extraction records (candidate components have none yet)"

key_files:
  created:
    - "packages/api-client/src/geometry.ts"
    - "packages/api-client/src/geometry.test.ts"
    - "packages/api-client/vitest.config.ts"
    - "packages/api-client/src/router/emails/detail.ts"
  modified:
    - "packages/api-client/src/index.ts (re-export polygonToRect)"
    - "packages/api-client/src/router/emails/index.ts (spread emailDetailProcedures)"
    - "packages/api-client/package.json (vitest devDep + test scripts)"

decisions:
  - "Three-query pattern chosen over a single monster JOIN to avoid row multiplication when one email has N components each with M extractions; components+extractions is at most 1:1 in practice (superseded records are kept but status-filtered by consumer)"
  - "D-18 compliance: detail procedure filters by emailId only — no importerId filter anywhere in this plan"
  - "polygonToRect collapses any polygon to its min/max bounding box (handles non-axis-aligned quadrilaterals from Textract)"
  - "IEEE 754 float precision handled in tests with roundRect helper (10 decimal places) rather than changing production code"

metrics:
  duration: "~35 min"
  completed: "2026-06-12"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 3
---

# Phase 05 Plan 01: API data layer — geometry helper + emails.detail tRPC Summary

**One-liner:** vitest-bootstrapped TDD geometry helper + three-query emails.detail tRPC procedure projecting email/attachments/components with entity-type and extraction joins.

## Tasks

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | polygonToRect TDD (RED) | ecd6432 | Complete |
| 1 | polygonToRect GREEN + float fix | f6649a6 | Complete |
| 2 | emails.detail tRPC procedure | a786e4a | Complete |

## What Was Built

### Task 1 — polygonToRect geometry helper (TDD)

**RED phase (ecd6432):** Created `geometry.test.ts` (5 test cases), `vitest.config.ts`, and added vitest 2.1.9 to devDependencies. Tests failed as expected — no implementation.

**GREEN phase (f6649a6):** Implemented `geometry.ts` exporting `polygonToRect`. All 5 tests pass. Exported from `index.ts`. Auto-fix applied: IEEE 754 floating-point precision caused `0.6 - 0.2 === 0.39999999999999997` in the skewed-polygon test; added `roundRect` helper in test file to round to 10 decimal places before `toEqual`.

Test cases cover: axis-aligned rect, full-page rect, skewed (diamond bounding box), single-point degenerate (no NaN/throw), immutability (new object each call, input unchanged).

### Task 2 — emails.detail tRPC procedure (a786e4a)

`detail.ts` exports `emailDetailProcedures` (plain object, spread-merged into `emailsRouter`).

The `detail` procedure accepts `{ id: z.string().uuid() }` and runs three independent queries:

1. **Email row** — selects all display fields (subject, senderName, senderAddress, toAddresses, receivedAt, bodyText, bodyHtml, parseStatus, importerId). Returns `null` if absent.
2. **Attachments** — selects id, filename, contentType, storageKey, fileExt filtered by emailId.
3. **Components** — selects id, attachmentId, sourceType, contentText, extractionStatus, location from EmailComponents; `leftJoin(ExtractionRecords, componentId)` for extractedFields + confidenceScore; `leftJoin(EntityTypes, entityTypeId)` for label + slug.

D-18 enforced: no importerId filter anywhere. Zod uuid validation at boundary. All SQL via `eq()` parameterized builders.

## Verification Results

- `npm run typecheck` — exit 0, no errors
- `npm test` — 5/5 geometry tests pass (vitest 2.1.9)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] IEEE 754 float precision in geometry test**
- **Found during:** Task 1 GREEN phase
- **Issue:** `toEqual({ height: 0.4 })` failed — `0.6 - 0.2 === 0.39999999999999997` in JavaScript's IEEE 754 double arithmetic
- **Fix:** Added `roundRect` helper in the test file that rounds each field to 10 decimal places before comparison; no change to production `polygonToRect` (correct behavior, just floating-point rounding artifact)
- **Files modified:** `packages/api-client/src/geometry.test.ts`
- **Commit:** f6649a6

## Known Stubs

None — no placeholder/TODO/stub patterns in created files.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes. The `detail` procedure reads existing tables via Drizzle ORM (parameterized); no new trust boundaries introduced.

## Self-Check: PASSED

- packages/api-client/src/geometry.ts: FOUND
- packages/api-client/src/geometry.test.ts: FOUND
- packages/api-client/vitest.config.ts: FOUND
- packages/api-client/src/router/emails/detail.ts: FOUND
- Commit ecd6432: FOUND
- Commit f6649a6: FOUND
- Commit a786e4a: FOUND
