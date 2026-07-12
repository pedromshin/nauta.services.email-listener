---
phase: 54-email-cluster-workflow-e3
plan: 06
subsystem: ui
tags: [trpc, drizzle, react, tanstack-query, radix, chat, knowledge-graph]

# Dependency graph
requires:
  - phase: 54-email-cluster-workflow-e3 (Plan 01)
    provides: "chat.getConversationThreadId + emails.threadCard (both feature-detected against migration 0036) — the linkage read + single-thread projection this plan's UI consumes"
  - phase: 54-email-cluster-workflow-e3 (Plan 03)
    provides: "SourceCaptureHandler's exact literal contract (source=\"web_search_capture\", scope_ref_type=\"web_source\", knowledge_node_edges.target_ref_type=\"chat_conversation\") this plan's clusterSummary query re-reads"
provides:
  - "chat.clusterSummary — real, ownership-scoped sibling-chat + captured-source counts for a thread-linked conversation's cluster, degrading cleanly when migration 0036 is unapplied"
  - "ThreadClusterIndicator — the CLUS-02 linked-thread + CLUS-06 cluster-context popover, additive-only, mounted in ConversationView's top bar"
  - "web_search tool-round copy-map entries (LABEL_BY_TOOL_NAME + COPY_BY_TOOL_NAME) — CLUS-03's UI surface, zero new components"
  - "invalidateOnChatTerminal now also invalidates chat.clusterSummary"
affects: [54-07 (morning §H live header render + live web_search round verification)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-step edge->node select (rather than a single JOIN) for a dedupe-sensitive count query — lets a node attached to more than one cluster conversation still count exactly once, via a JS Set on the intermediate sourceNodeId list"
    - "Additive-only conditional-mount component: takes only conversationId, reads its own linkage/data queries internally, renders null for the null/pending threadId case — the host page mounts it unconditionally, no caller-side branching needed"

key-files:
  created:
    - packages/api-client/src/router/chat/cluster-summary.ts
    - packages/api-client/src/router/chat/__tests__/cluster-summary.test.ts
    - apps/web/src/app/chat/_components/thread-cluster-indicator.tsx
    - apps/web/src/app/chat/_components/__tests__/thread-cluster-indicator.test.tsx
    - apps/web/src/app/chat/_components/__tests__/web-search-tool-copy.test.tsx
  modified:
    - packages/api-client/src/router/chat/index.ts
    - apps/web/src/app/chat/page.tsx
    - apps/web/src/app/chat/_hooks/use-conversation-controller.ts
    - apps/web/src/app/chat/_hooks/__tests__/use-conversation-controller-invalidate.test.ts
    - apps/web/src/app/chat/__tests__/chat-mobile-feed.test.tsx
    - apps/web/src/app/chat/_components/tool-round-activity-row.tsx
    - apps/web/src/app/chat/_components/tool-invocation-result-row.tsx
    - .planning/phases/54-email-cluster-workflow-e3/deferred-items.md

key-decisions:
  - "clusterSummary's captured-source count queries knowledge_node_edges/knowledge_nodes directly via Drizzle (packages/db, TypeScript-side) rather than waiting for a Python read path — both services write/read the SAME Postgres tables, and the edge's target_ref_id=conversation_id (54-03's design, since chat_conversations.thread_id has no Python read path yet) is exactly the join key this resolver needs; no new seam required"
  - "Two-step select (edges, then nodes) instead of a single innerJoin — keeps the fake-db test harness identical in shape to thread-link.ts's existing plain select/update chains, and makes the node-id dedupe (a node can be attached to more than one sibling conversation) an explicit, testable JS Set operation rather than buried in SQL"
  - "ThreadClusterIndicator takes only `conversationId` and resolves threadId internally via api.chat.getConversationThreadId, rather than requiring page.tsx to pre-fetch and conditionally mount it — matches the plan's own 'or a threadId prop' alternative, and keeps page.tsx's wiring a single unconditional `<ThreadClusterIndicator conversationId={conversationId} />` line (additive-only via internal null-return, not caller-side branching)"
  - "clusterContextCopy's '(s)' suffix is literal text ('chat(s)', 'source(s)'), not dynamic pluralization grammar — matches 54-UI-SPEC.md's Copywriting Contract verbatim, which states every string in that table is 'final, not a placeholder'"

patterns-established:
  - "A cluster-scoped count query that must dedupe across multiple join paths (edge -> node, where one node can attach to N cluster members) should use an explicit two-step select + JS Set intersection rather than a single DISTINCT-count JOIN, for both test-harness simplicity and dedupe correctness that's easy to unit-test in isolation"

requirements-completed: [CLUS-02, CLUS-06, CLUS-03]

# Metrics
duration: 40min
completed: 2026-07-12
---

# Phase 54 Plan 06: ThreadClusterIndicator + chat.clusterSummary + web_search Tool-Round Copy Summary

**Real ownership-scoped sibling-chat/captured-source counts via a new chat.clusterSummary tRPC query, surfaced through a two-section ThreadClusterIndicator popover in the chat header (additive-only), plus the two web_search copy-map entries that finish CLUS-03's UI surface through the existing tool-round chrome.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-12T13:20:00Z (approx, first Read call)
- **Completed:** 2026-07-12T14:15:00Z
- **Tasks:** 3/3 completed (Tasks 1, 2, 3 each TDD RED->GREEN)
- **Files modified:** 13 (5 created, 8 modified)

## Accomplishments

- `chat.clusterSummary`, a new ownership-scoped tRPC query returning `{ hasThread, siblingChatCount, capturedSourceCount }` for a thread-linked conversation — feature-detects migration 0036 (degrades to `{ hasThread:false, 0, 0 }`, never a 500), and counts DISTINCT active `web_search_capture`/`web_source` knowledge nodes attached (via `knowledge_node_edges.target_ref_type="chat_conversation"`) to any conversation in the caller's own thread cluster, sharing the EXACT literal contract 54-03's `SourceCaptureHandler` writes
- `ThreadClusterIndicator`, the CLUS-02 (linked-thread) + CLUS-06 (cluster-context) popover component — one trigger, two popover sections, additive-only (renders nothing for the overwhelming majority of unlinked conversations), mounted in `ConversationView`'s top bar between `SaveStatusIndicator` and `CostMeter`
- `invalidateOnChatTerminal` now also invalidates `chat.clusterSummary`, so a just-confirmed source capture or a newly attached sibling chat refreshes the popover's counts on the next terminal turn (follows the exact 51-06 `invalidateOnChatTerminal` pattern the plan named)
- `web_search` tool rounds render "Searching the web…" / "Searched the web — N results" / "Couldn't search the web." through the EXISTING tool-round chrome — zero new components, zero new `ProvenanceKind` members (raw web results stay chip-free until a source is confirmed-captured, per 54-UI-SPEC.md Judgment Call #7)

## Task Commits

Each task followed the RED->GREEN cycle and was committed atomically:

1. **Task 1 RED: chat.clusterSummary tests** - `f613593` (test)
1. **Task 1 GREEN: chat.clusterSummary implementation** - `bd04691` (feat)
2. **Task 2 RED: ThreadClusterIndicator tests** - `e097eef` (test)
2. **Task 2 GREEN: ThreadClusterIndicator + top-bar mount + invalidation** - `df19946` (feat)
3. **Task 3 RED: web_search tool-round copy tests** - `4608f27` (test)
3. **Task 3 GREEN: web_search copy-map entries** - `2b1917a` (feat)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `packages/api-client/src/router/chat/cluster-summary.ts` - `chatClusterSummaryProcedures.clusterSummary`: ownership assertion, 0036 feature-detect, sibling-chat count, two-step edge->node captured-source count with JS-Set dedupe
- `packages/api-client/src/router/chat/__tests__/cluster-summary.test.ts` - 7 tests (real counts, unlinked/owner-less short-circuits, NOT_FOUND, 0036 degrade, live-42703 degrade, duplicate-edge dedupe)
- `packages/api-client/src/router/chat/index.ts` - registers `chatClusterSummaryProcedures`
- `apps/web/src/app/chat/_components/thread-cluster-indicator.tsx` - `ThreadClusterIndicator` + exported pure `clusterContextCopy` helper
- `apps/web/src/app/chat/_components/__tests__/thread-cluster-indicator.test.tsx` - 10 tests (conditional mount, trigger aria-label, popover sections, both copy variants, Open-thread href, query gating)
- `apps/web/src/app/chat/page.tsx` - mounts `ThreadClusterIndicator` in the top bar
- `apps/web/src/app/chat/_hooks/use-conversation-controller.ts` - `ChatTerminalUtils`/`invalidateOnChatTerminal` gain `chat.clusterSummary` invalidation
- `apps/web/src/app/chat/_hooks/__tests__/use-conversation-controller-invalidate.test.ts` - extended `makeUtils()` fixture + assertion for the new invalidation call
- `apps/web/src/app/chat/__tests__/chat-mobile-feed.test.tsx` - extended `~/trpc/react` mock (`getConversationThreadId`/`clusterSummary`/`threadCard`) so the now-unconditionally-mounted `ThreadClusterIndicator` doesn't break this pre-existing suite
- `apps/web/src/app/chat/_components/tool-round-activity-row.tsx` - `LABEL_BY_TOOL_NAME.web_search = "Searching the web…"`
- `apps/web/src/app/chat/_components/tool-invocation-result-row.tsx` - `COPY_BY_TOOL_NAME.web_search = { baseLabel: "Searched the web", errorLabel: "Couldn't search the web." }`
- `apps/web/src/app/chat/_components/__tests__/web-search-tool-copy.test.tsx` - 6 tests (in-progress, success incl. singular/zero-result variants, error, no-citation-chips path)
- `.planning/phases/54-email-cluster-workflow-e3/deferred-items.md` - logs the pre-existing (untracked, unrelated) `apps/web/src/app/dev/design/**` typecheck breakage found during Task 2 verification

## Decisions Made

See `key-decisions` in the frontmatter for the four substantive design decisions (direct-Drizzle captured-source query, two-step select for dedupe testability, `conversationId`-only prop for additive-only mount, literal `(s)` copy suffix).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended `chat-mobile-feed.test.tsx`'s `~/trpc/react` mock**
- **Found during:** Task 2 verification (full web vitest suite)
- **Issue:** `ThreadClusterIndicator` is mounted unconditionally in `ConversationView`'s top bar (additive-only via internal null-return, not caller-side branching), so it now calls `api.chat.getConversationThreadId.useQuery` / `api.chat.clusterSummary.useQuery` / `api.emails.threadCard.useQuery` on every render. `chat-mobile-feed.test.tsx` mounts the REAL `ChatPage` with a hand-written `~/trpc/react` mock that predates this plan and didn't include those three procedures — without extending it, every test in that 12-test suite would throw `Cannot read properties of undefined (reading 'useQuery')`. The plan's own `<interfaces>` gotcha note anticipated exactly this ("extend ~/trpc/react mocks... in sibling tests").
- **Fix:** Added `getConversationThreadId: { useQuery: () => ({ data: { threadId: null } }) }`, `clusterSummary: { useQuery: () => ({ data: undefined }) }` to the mocked `chat` object, and `emails: { threadCard: { useQuery: () => ({ data: undefined }) } }` — a null threadId keeps `ThreadClusterIndicator` additive-only (renders nothing) for every conversation fixture in that suite, matching production behavior for unlinked chats.
- **Files modified:** `apps/web/src/app/chat/__tests__/chat-mobile-feed.test.tsx`
- **Verification:** Full 12-test suite green after the fix; also extended `FAKE_UTILS.chat.clusterSummary.invalidate` in the same file for the `handleTerminal` invalidation path.
- **Committed in:** `df19946` (Task 2 GREEN commit)

**2. [Rule 3 - Blocking] `@polytoken/api-client`'s `dist/` rebuilt**
- **Found during:** Task 2 verification (`npm run typecheck -w @polytoken/web`)
- **Issue:** `apps/web` resolves `@polytoken/api-client`'s TYPES from `dist/index.d.ts` (the package's `exports["."].types` condition) — this plan is the first `apps/web` consumer of `chat.clusterSummary`, so the stale prebuilt `dist/` didn't know about it, producing a `Property 'clusterSummary' does not exist` typecheck error even though the source was correct. Same documented gotcha 54-04-SUMMARY.md flagged for `emails.threadCard`/`chat.attachConversationToThread`.
- **Fix:** Ran `npm run build -w @polytoken/api-client` (a `tsc` build, gitignored output, no commit needed).
- **Files modified:** none (build output only, `dist/` is gitignored)
- **Verification:** `npm run typecheck -w @polytoken/web` clean outside the pre-existing, unrelated `app/dev/design/**` breakage (see Known Stubs / deferred-items.md).
- **Committed in:** N/A (no commit — build artifact only)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues required to keep the existing test/typecheck gates green; both anticipated by the plan's own gotcha notes). No scope creep.
**Impact on plan:** Zero functional scope change — both fixes are test-infrastructure/build-freshness corrections, not feature work.

## Issues Encountered

- **Pre-existing, unrelated typecheck breakage in `apps/web/src/app/dev/design/**`** (untracked directory, `git log` shows zero history — a leftover WIP from another session, not touched by any Phase 54 plan). `npm run typecheck -w @polytoken/web` reports ~50 `Cannot find module '@nauta/ui/*'` errors there (a pre-rename package alias that no longer resolves post-Phase-42) plus 2 implicit-`any` errors. Out of scope per the executor's scope-boundary rule — every file THIS plan created/modified typechecks cleanly in isolation. Logged to `deferred-items.md`; mirrors 54-04-SUMMARY.md's own identical carve-out note.

## Known Stubs

None — `ThreadClusterIndicator` renders real, live-queried subject/counts (no hardcoded/mock data paths), and both `web_search` copy-map entries render through the existing, already-wired tool-round chrome.

## User Setup Required

None - no external service configuration required. Live header render + a real `web_search` tool round (against a real Bedrock session and an applied migration 0036) are explicitly DEFERRED to `MORNING-CHECKLIST.md` §H, per this plan's own `<verification>` section and 54-CONTEXT.md's CLUS-07 gating — not faked tonight. Tonight's verification is vitest (mocked tRPC for all UI) + typecheck + committed palette/token gates only.

## Next Phase Readiness

- CLUS-02/CLUS-06/CLUS-03 are UI-code-complete: the header indicator renders real counts for thread-linked chats, stays invisible for unlinked chats, and web_search rounds render the correct copy through the existing chrome.
- 54-07 (the §H runsheet doc plan) is the last remaining Phase 54 plan — it should verify, on a real browser session with migration 0036 applied: (a) `ThreadClusterIndicator` actually appears in the header for a real thread-linked conversation with real sibling/captured-source counts, (b) a real `web_search` tool round renders "Searching the web…" -> "Searched the web — N results" end to end, and (c) confirming a source capture visibly bumps the popover's captured-source count after the next terminal turn (proving the new `invalidateOnChatTerminal` wiring live, not just in the mocked regression test).
- No blockers.

---
*Phase: 54-email-cluster-workflow-e3*
*Completed: 2026-07-12*

## Self-Check: PASSED

All 14 declared files (5 created, 8 modified, this SUMMARY) confirmed present
on disk; all 6 task commit hashes (f613593, bd04691, e097eef, df19946,
4608f27, 2b1917a) confirmed in `git log --oneline --all`.
