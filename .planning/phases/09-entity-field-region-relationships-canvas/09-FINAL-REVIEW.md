---
status: ship_with_followups
resolution: Both confirmed HIGH defects + all genuine MEDIUM/LOW + backend test-debt fixed in Bundle D1 (backend) + D2 (frontend). Remaining items are documented deferrals (frontend test harness, perf memoization, god-component split, staging migration push). Gates green: pytest 458 / 87.96% cov; web build 0; api-client 56/56.
phase: 09-entity-field-region-relationships-canvas
source: full final review — 6 dimension reviewers (backend/frontend correctness, security, perf, conventions, tests) + adversarial verification of high/critical findings + synthesis (15 agents)
generated: 2026-06-14
resolved: 2026-06-14 (Bundle D1 + D2)
scope: entire Phase-9 changeset (10 plans + gap-fixes A/B/C), base adce7a1..HEAD
---

# Phase 9 — Full Final Review

**Verdict (as-found): NEEDS-FIX before deploy; READY for human browser UAT.** **Post Bundle D: SHIP-WITH-FOLLOWUPS** — the 2 HIGH + genuine MEDIUM/LOW fixed (see 09-REVIEW-FIX.md Bundles D1/D2); deferrals are non-blocking (frontend test harness is the #1 follow-up).
(Original verdict detail below; both HIGHs degraded gracefully — no crash.)
Security = PASS. Adversarial verification refuted 3 originally-"high" findings (autofill-pacing false alarm — backoff already exists; over-fetch + hover-rerender downgraded to medium).

## Confirmed HIGH (fixing in Bundle D)
1. **Autofill double-processes auto-detected children** — `autofill_fields.py:312-317,472-479`. `_existing_field_children` excludes only rejected/superseded, not `candidate`, so freshly-persisted auto-detected boxes are re-read and autofilled twice (2× LLM cost, duplicate ExtractionRecords/relationship writes/UI entries). Unit test masks it with a static mock. → de-dup `all_children` by `child.id`; regression test with a mock that reflects saved rows.
2. **`CreateEntityTypeUseCase` slug-uniqueness inoperative for system defaults** — `manage_entity_types.py:71-76` + `migrations/0000_real_garia.sql:82` (`nullsNotDistinct:false`). NULL importer_id ⇒ duplicates never collide; the 23505/409 path is dead. → app-level `find_by_slug(None, slug)` pre-check + partial unique index `ON entity_types (slug) WHERE importer_id IS NULL`.

## HIGH (documented deferral, not auto-fixed)
3. **apps/web has zero tests + no test tooling** (`apps/web/package.json`) — pre-existing across the whole web app (no prior phase added web tests). Standing up vitest/testing-library/playwright + covering ~5–8.7k lines is its own work item. **Top recommended follow-up.** Backend correctness-sensitive logic (CRIT-1/CRIT-2, slug pre-check, delete-guard) IS covered with real-row tests.

## MEDIUM (fixing the genuine/cheap ones in Bundle D)
- Field slug uniqueness has no DB constraint (TOCTOU) — `entity_type_repository.py:237-243` → add `UNIQUE(entity_type_id, slug)` index. [fix]
- Denial-memo full-row read-modify-upsert (lost-update under concurrency) — `deny_field.py:146-159` → atomic jsonb append. [fix]
- `EntityChips <a>` nested in `InboxRow <button>` (invalid HTML + a11y) — `inbox-row.tsx`/`entity-chips.tsx`. [fix]
- Drag-to-draw silent no-op on pages w/o resolvable page component — `email-detail.tsx:539-558` → gate/toast. [fix]
- Dead D-27 deactivate-vs-delete dialog copy (`referenceCount` never passed) — `entity-type-detail.tsx:320-334`. [fix]
- `emails.list` over-fetch (SELECT *) — `emails/index.ts:35-43` → explicit projection. [fix]
- ComponentRepository write methods + 4 new FastAPI routes are mock-only — add real-row-shape + thin-integration tests (the CRIT-1 bug class). [fix]
- Canvas hover re-render / OverlayLayer O(n×m) / un-memoized derivations — `email-detail.tsx`, `overlay-layer.tsx`. [DEFER — perf, involved]
- `confirmAllFields` N×N invalidations — `use-autofill-fields.ts:72-80` → single trailing invalidate. [fix]
- `CanvasShell` unused `emailId` prop; large files near 800 cap (`email-detail.tsx` 763, `pdf-preview-pane.tsx` 746) — [emailId fix; god-component split DEFER]

## LOW / INFO
`_coerce_page_index` float→0 [fix]; dead duplicate autofill machine in `use-role-mutations.ts` + dead `use-canvas-state` API [fix]; layers-tree deny lacks undo toast; reorder_fields non-transactional; 3 client `console.error`; ReorderFieldsRequest list[str] not list[UUID] (defense-in-depth) [DEFER/note].

## Accepted follow-ups (non-blocking)
Server-side deny restore (optimistic-only); staging `0013` + the Bundle-D `0014` index push before deploy; Bedrock RPM quota (infra); frontend test harness (#3 above); perf memoization; god-component split.
