---
phase: 56-research-canvas-backend-semantic-context-model
plan: 03
subsystem: api
tags: [trpc, drizzle, ownership, cross-tenant, research-canvas]

# Dependency graph
requires:
  - phase: 56-research-canvas-backend-semantic-context-model
    plan: 01
    provides: chat_context_edges table (migration 0037, unapplied), chat_source_ledger table, jsonb sourceRef discriminated union + sourceRefKey identity column
provides:
  - "assertSourceRefOwnership(db, userId, sourceRef) — the write-time cross-tenant ownership dispatcher (packages/db/src/ownership.ts), per sourceRef.type: knowledge_node, source_ledger, genui_panel, email_thread"
  - "chat.createContextEdge / chat.removeContextEdge / chat.listContextEdges tRPC procedures (packages/api-client/src/router/chat/context-edges.ts), registered into chatRouter"
  - "computeSourceRefKey — the server-side-only derived-key function backing the active-identity upsert-or-reactivate write"
  - "Decision D-56-A recorded in code + tests: knowledge_node ownership check is tier-agnostic (no trust-tier gate)"
affects: [56-04, 63]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.importActual to obtain the REAL (unmocked) function reference for direct dispatcher-logic testing in the SAME file that module-mocks the same import for router-level wiring tests"
    - "tableColumnExists gated once on the WRITE target (chat_context_edges) is sufficient for ALL sourceRef.type joins, since chat_context_edges and chat_source_ledger land in the same migration (0037) — avoids redundant per-type feature-detection"
    - "onConflictDoUpdate with a composite target + targetWhere (partial unique index) for upsert-or-reactivate against knowledge_node_edges-style active-identity indexes"

key-files:
  created:
    - packages/api-client/src/router/chat/context-edges.ts
    - packages/api-client/src/router/chat/__tests__/context-edges.test.ts
  modified:
    - packages/db/src/ownership.ts
    - packages/api-client/src/router/chat/index.ts

key-decisions:
  - "D-56-A confirmed and implemented exactly as specified in the plan: assertSourceRefOwnership performs OWNERSHIP resolution ONLY for knowledge_node — no knowledge_nodes.tier check. An explicit user-drawn edge injects regardless of trust tier; tier-gating is exclusively list_injectable_edges's concern (automatic injection), unrelated to this write path."
  - "The chat_context_edges tableColumnExists gate runs ONCE, before touching ANY sourceRef.type (including source_ledger, which reads the separately-unapplied chat_source_ledger table) — safe because 56-01 landed BOTH tables in a single combined migration (0037), so table-existence of one implies the other. This avoids a second feature-detection probe and avoids a raw 42P01 crash on the source_ledger join path."
  - "removeContextEdge resolves ownership via the edge's OWN targetConversationId (a two-step select-then-assertConversationOwnership, reusing the existing central helper) rather than adding a new joined ownership.ts helper — keeps ownership.ts's Task-1-scoped surface exactly to assertSourceRefOwnership, per the plan's stated artifact contract."
  - "No apps/web work, no api-client dist rebuild — matches the plan's explicit scope boundary (Phase 63 is the first apps/web consumer, 54-04 gotcha)."

requirements-completed: [RCNV-04]

# Metrics
duration: ~30min
completed: 2026-07-15
---

# Phase 56 Plan 03: Context-Edges tRPC Router + Write-Time Cross-Tenant Gate Summary

**RCNV-04's server seam — chat.createContextEdge/removeContextEdge/listContextEdges over chat_context_edges — lands with a proven write-time cross-tenant ownership dispatcher (assertSourceRefOwnership) and a 33-test adversarial suite showing user B cannot wire user A's knowledge node, ledger row, genui panel, or email thread into B's own conversation.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-15
- **Tasks:** 2/2 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- **`assertSourceRefOwnership`** (packages/db/src/ownership.ts) — a discriminated dispatcher over `sourceRef.type` added to the ONE central ownership module. `email_thread` delegates directly to the existing `assertThreadOwnership`; `knowledge_node` (join `knowledge_nodes` → `importers`), `source_ledger` (join `chat_source_ledger` → `chat_conversations`), and `genui_panel` (join `chat_messages` → `chat_conversations`) each do a single parameterized Drizzle join and throw the same `OwnershipError` shape every sibling assert throws on a foreign or missing resource. Per Decision D-56-A, the `knowledge_node` branch performs ownership resolution ONLY — no `tier` check.
- **`chat/context-edges.ts`** — `createContextEdge` / `removeContextEdge` / `listContextEdges`, mirroring `thread-link.ts`'s structure exactly: ownership asserted BEFORE any write (target conversation first, then per-sourceRef.type via `assertSourceRefOwnership`), `sourceRefKey` computed server-side only (never trusted from client input), upsert-or-reactivate via `onConflictDoUpdate` targeting the partial `UNIQUE(target_conversation_id, source_ref_key) WHERE is_active` index, and a `tableColumnExists` + live 42703/42P01 try/catch fail-open discriminated result (`{ created: false, reason: "linkage_unavailable" }`) since migration 0037 is authored but applied to no environment. `chatContextEdgeProcedures` registered into `chatRouter` (`chat/index.ts`).
- **Adversarial two-user suite** (`context-edges.test.ts`, 33 tests) — the acceptance bar: for every `sourceRef.type` (knowledge_node, source_ledger, genui_panel, email_thread), user B attempting to link user A's resource is rejected with `NOT_FOUND` and zero rows are written; the foreign-target-conversation case is rejected BEFORE any sourceRef work; the real (unmocked, via `vi.importActual`) `assertSourceRefOwnership` dispatcher logic is proven independently of the router-level mocks; the happy path, the upsert-identity `onConflictDoUpdate` wiring, and the table-unavailable fail-open path are all covered for all three procedures.

## Task Commits

Each task was committed atomically:

1. **Task 1: assertSourceRefOwnership dispatcher (per-type cross-tenant gate)** - `aff542e` (feat)
2. **Task 2: context-edges tRPC router + registration + adversarial two-user test** - `b9f0320` (feat)

## Files Created/Modified

- `packages/db/src/ownership.ts` - added `ContextEdgeSourceRef` type + `assertSourceRefOwnership` dispatcher
- `packages/api-client/src/router/chat/context-edges.ts` - `contextEdgeSourceRefSchema`, `computeSourceRefKey`, `chatContextEdgeProcedures` (createContextEdge/removeContextEdge/listContextEdges)
- `packages/api-client/src/router/chat/index.ts` - registered `chatContextEdgeProcedures` into `chatRouter`
- `packages/api-client/src/router/chat/__tests__/context-edges.test.ts` - 33 tests: dispatcher logic (12), computeSourceRefKey (4), session requirement (2), cross-tenant adversarial suite (5), happy path/upsert/fail-open (3), removeContextEdge (4), listContextEdges (3)

## Decisions Made

- **D-56-A confirmed in code**: `assertSourceRefOwnership`'s `knowledge_node` branch does NOT check `knowledge_nodes.tier` — ownership only. Comment in `ownership.ts` and the router's module doc comment both record the rationale (explicit user-drawn edge is itself the "selection" suggest-only requires; `list_injectable_edges`'s EXTRACTED-only gate governs a structurally different concern — automatic injection).
- **Single feature-detection gate covers both 0037 tables**: `createContextEdge` checks `tableColumnExists("chat_context_edges", "source_ref_key")` ONCE, before calling `assertSourceRefOwnership` at all — since 56-01 landed `chat_context_edges` and `chat_source_ledger` in the SAME migration (0037_serious_sugar_man.sql), confirming one confirms the other. This avoids a second probe and avoids a raw 42P01 crash on a `source_ledger`-typed sourceRef's join before the table exists.
- **removeContextEdge ownership**: resolved via a plain select of the edge's own `targetConversationId`, then the EXISTING `assertConversationOwnership` — no new joined ownership.ts helper added, keeping Task 1's `ownership.ts` surface exactly to `assertSourceRefOwnership` per the plan's artifact contract.

## Deviations from Plan

None — plan executed exactly as written. The test file's dual strategy (real dispatcher logic via `vi.importActual` alongside module-mocked router-level wiring tests, all in one file) was necessary to satisfy Task 1's literal `<verify>` command (`cd packages/api-client && npm test -- context-edges -t "ownership"`, which requires the ownership dispatcher's own tests to live inside `context-edges.test.ts` rather than a separate `packages/db/src/ownership.test.ts` addition) while still proving the REAL join logic, not just wiring — this is an implementation-detail choice within the plan's stated scope, not a deviation from any must-have.

## Issues Encountered

None. `npm run typecheck` clean for both `@polytoken/db` and `@polytoken/api-client`. Full `@polytoken/api-client` suite (438 tests, 36 files) and `@polytoken/db` suite (21 tests) both green after this plan's changes — no regressions in any sibling router's tests.

## User Setup Required

None. No new environment variables, no new external service configuration. Migration 0037 remains AUTHORED but NOT APPLIED to any environment (56-01's posture, unchanged this plan) — every procedure in `context-edges.ts` feature-detects via `tableColumnExists` and degrades to `linkage_unavailable` / `[]` rather than throwing until 0037 is applied.

## Next Phase Readiness

- The RCNV-04 write/read seam is callable, registered, and provably cross-tenant-safe — ready for 56-04's Python read path (`RunChatTurn._execute_turn`'s linked-context injection) to consume `chat_context_edges` rows once written, and for Phase 63's canvas UI to call `chat.createContextEdge` directly once React Flow edge-drawing lands.
- Decision D-56-A (tier-agnostic knowledge_node ownership check) must be mirrored consistently in 56-04's Python-side node resolver, per the plan's own instruction ("Recorded here and mirrored in 56-04").
- No blockers. Applying migration 0037 to a live environment remains a separate, later step (56-01's explicit "authored vs applied" distinction, unchanged).

---
*Phase: 56-research-canvas-backend-semantic-context-model*
*Completed: 2026-07-15*

## Self-Check: PASSED

All created files verified present on disk (context-edges.ts, context-edges.test.ts, this
SUMMARY.md). Both task commits (aff542e, b9f0320) verified present in `git log --oneline --all`.
Full test suites (packages/db: 21/21, packages/api-client: 438/438) and both packages'
typecheck confirmed green in this session.
