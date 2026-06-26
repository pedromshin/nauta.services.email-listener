---
phase: 10-extracted-entity-identity-gallery-detail-4c-entity-resolutio
plan: 06
status: complete
completed: 2026-06-15
---

# 10-06 SUMMARY — Entity detail page + inbox chip deep-link (D-18..D-21, D-24)

## What was built (Tasks 1–3, commits 06a5580 / f2dcf3d / 154289f / 57d674d)
- `/entities/[id]` detail page: header + four regions (occurrences, fields with
  D-19 conflict flagging, knowledge nodes, pending duplicate-merge suggestions).
- Optimistic curation hook (`use-entity-curation`) + reject/unmerge AlertDialogs
  (confirm/reject/unmerge → tRPC proxy to FastAPI, snapshot/revert) — D-20/D-21.
- `emails.entitySummary` surfaces `entityInstanceId`; inbox entity chips deep-link
  to `/entities/[id]` with a `/emails` fallback — Phase-9 D-24 activation.

## Task 4 — human-verify checkpoint (resolved through iteration)
The browser walkthrough surfaced real, live-only defects (fake-repo tests had
masked them). All found, fixed, and verified against the live DB/Bedrock:
- `d3dc6f0` — `record_candidate_link` missing NOT-NULL `entity_type_id`; skip
  self-candidate; UTF-8 log hardening.
- `08fab53` — schema drift: added `entity_instances.merged_into` +
  `component_entity_candidate_links.was_dismissed` (migration 0018).
- `cfa589b` — promote enrichment: occurrence links, identifiers, and a legible
  `display_name` ("Bill of Lading · MD002") from confirmed field values.
- `653f993` / `756a169` / `3863af3` — **B: auto entity-type identification on
  extraction** (suggest-only, one Bedrock call/document; classifies PENDING
  regions; active model).
- UI: extraction-summary panel in the editor + "Confirm → add to gallery"
  action (`894a3fc`, `785f559`).
- `6f420cc` — green CI (asyncio loop isolation, confirm-endpoint DI in tests,
  resolution-repo domain port) so the ECS deploy could ship.

## Deploy
Migrations 0016/0017/0018 applied to staging + prod. Listener (ECS) + web
(Vercel) deployed to **staging and prod**; smoke tests passed; prod
`/entities` returns 200. Phase 10 entity identity / gallery / detail /
resolution / auto-classification is live.

## Self-Check: PASSED
