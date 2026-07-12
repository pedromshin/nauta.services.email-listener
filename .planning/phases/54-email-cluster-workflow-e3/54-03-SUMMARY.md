---
phase: 54-email-cluster-workflow-e3
plan: 03
subsystem: api
tags: [python, fastapi, knowledge-graph, confirm-action, chat, suggest-only, provenance]

# Dependency graph
requires:
  - phase: 54-02 (web_search ToolExecutor)
    provides: "web_search's persisted tool_invocation_result part shape ({mode, results:[{title,url,snippet}]}) this plan re-reads server-side"
  - phase: 40 (v1.6 confirm-action widget machinery)
    provides: "emit_confirm_action tool, parse_confirm_action_call/build_confirm_action_declaration, the 2-entry confirm_action_dispatch table, SubmitWidgetInteraction's CAS submit path this plan extends to a 3rd suggestionRef.kind"
  - phase: 30 (suggest-only promotion gate)
    provides: "PromoteEdgeUseCase / KnowledgeEdgeTierPromotionHandler — the UNCHANGED promotion gate this plan proves reuse against"
provides:
  - "SUGGESTION_KIND_SOURCE_CAPTURE — a second suggestionRef.kind reachable via emit_confirm_action, parse-validated + schema-enum-restricted"
  - "SourceCaptureHandler (confirm_action_dispatch.py) — writes exactly one INFERRED knowledge_nodes + knowledge_node_edges row on confirm, reusing an existing node for a duplicate url, writing nothing on reject, never raising"
  - "RunChatTurn._finalize_source_capture — server-side re-read of a persisted web_search result by a {toolUseId}:{index} composite id, never model free text"
  - "A promotion-reuse proof (test_source_capture_promote_reuse.py) that the captured edge flows through the UNMODIFIED PromoteEdgeUseCase/KnowledgeEdgeTierPromotionHandler to EXTRACTED"
affects: [54-06 (clusterSummary counts source="web_search_capture" nodes), 54-07 (morning §H live capture->promote round-trip), "any future plan wiring conversation.thread_id readable server-side in Python"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composite lookup-key suggestion id ({toolUseId}:{index}) instead of a database row id — lets a suggestionRef.id stay a pure lookup key (never model-authored content) even when the 'suggestion' is a persisted message part, not a DB row"
    - "Declaration-snapshot threading for kinds with no DB row to derive tenant scope from: importerId/sourcePayload/threadId are frozen into the confirm-action declaration at emission time (mirrors the existing tierSnapshot precedent) and read back at submit time by a per-kind resolver, rather than adding a new collaborator to SubmitWidgetInteraction"
    - "ConfirmActionHandler Protocol grows additive keyword-only params (source_payload/conversation_id/thread_id, default None) that non-source handlers accept-and-ignore — same idiom as user_id's Phase 44-09 addition"

key-files:
  created:
    - apps/email-listener/tests/application/test_source_capture_confirm_action.py
    - apps/email-listener/tests/application/test_source_capture_dispatch.py
    - apps/email-listener/tests/application/test_source_capture_promote_reuse.py
    - .planning/phases/54-email-cluster-workflow-e3/deferred-items.md
  modified:
    - apps/email-listener/app/application/use_cases/run_chat_turn_confirm_action.py
    - apps/email-listener/app/infrastructure/llm/chat_tools.py
    - apps/email-listener/app/application/use_cases/confirm_action_dispatch.py
    - apps/email-listener/app/application/use_cases/run_chat_turn.py
    - apps/email-listener/app/application/use_cases/submit_widget_interaction.py
    - apps/email-listener/app/container.py
    - apps/email-listener/app/application/use_cases/__tests__/test_confirm_action_dispatch.py
    - apps/email-listener/app/application/use_cases/__tests__/test_submit_widget_interaction.py
    - apps/email-listener/tests/test_container.py

key-decisions:
  - "Server-legible {toolUseId}:{index} composite result id instead of a per-result database id — web_search_executor.py's envelope ({mode, results:[{title,url,snippet}]}) has no per-result id field, and that file is deliberately NOT in this plan's files_modified (54-02 already shipped it, adding an id field there is out of this plan's declared scope); the model already has the toolUseId (its own emitted tool_use block) and the index (position in the results array it received) available in-context, so no new envelope field was needed"
  - "importerId/sourcePayload frozen into the confirm-action declaration at emission time, read back at submit time — there is no knowledge_node_edges row to derive tenant scope from for source_capture (unlike knowledge_edge_tier_promotion's find_edge_by_id join), so the declaration itself (server-built, trusted, immutable once stored) carries what the submit-time dispatch needs, exactly mirroring the existing tierSnapshot precedent"
  - "Edge attaches to conversation_id (target_ref_type='chat_conversation') as the addressable half of 'the cluster' available at this Python layer — 54-CONTEXT.md defines a cluster as thread + conversations + captured sources, but conversation.thread_id is a TS/Drizzle-side column (packages/db) this FastAPI service has no read path for yet; thread_id is threaded through the full kwarg chain (SourceCaptureHandler param, provenance dict key) but is always None from this service today — see Known Stubs below"
  - "retrieved_at is stamped at the moment RunChatTurn re-reads the persisted web_search result (server time), not at the original fetch time inside WebSearchExecutor — the executor's envelope carries no fetch timestamp and adding one is out of this plan's scope (54-02's file)"
  - "Rule 2 deviation: submit_widget_interaction.py (not in this plan's files_modified) was extended to thread source_payload/conversation_id/thread_id into the dispatch call — without this the feature would only work in SourceCaptureHandler unit tests, never in the real submit path (the plan's own <action> text says 'threaded from the submit path', implying this file, but it was omitted from files_modified)"

patterns-established:
  - "Pattern: a suggestionRef.kind with no backing DB row can still satisfy the confirm-action machinery's 'server re-reads, never trusts model text' contract by re-reading a PERSISTED MESSAGE PART instead of a table row — the id just needs to be a server-legible lookup key, not a database primary key"

requirements-completed: [CLUS-04, CLUS-05]

# Metrics
duration: 45min
completed: 2026-07-12
---

# Phase 54 Plan 03: Source Capture → INFERRED Nodes + Promotion Reuse Summary

**A confirmed web_search result becomes an INFERRED knowledge node + edge with full provenance via the existing emit_confirm_action/confirm-action-widget machinery — server-re-read by a `{toolUseId}:{index}` lookup key, never model free text — and the captured edge promotes to EXTRACTED through the completely unmodified `PromoteEdgeUseCase`.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-12T07:37:00-03:00 (approx, first Read call after 54-02's completion commit)
- **Completed:** 2026-07-12T08:20:00-03:00
- **Tasks:** 3/3 completed
- **Files modified:** 12 (4 created, 9 modified — 3 of the 9 modified files were not in the plan's declared `files_modified`, see Deviations)

## Accomplishments

- `SUGGESTION_KIND_SOURCE_CAPTURE` is a second, parse-validated `suggestionRef.kind` reachable via `emit_confirm_action`'s own JSON schema (enum extended `{"knowledge_edge_tier_promotion", "source_capture"}`), with the model's description updated to explain the `{toolUseId}:{index}` id format for this kind.
- `RunChatTurn._finalize_source_capture` re-reads the actual url/title of a proposed capture SERVER-SIDE from the persisted `web_search` `tool_invocation_result` part — the model never supplies title/url/snippet content, only a composite lookup key; a malformed id, an unresolvable toolUseId, an out-of-range index, or a foreign (cross-conversation) result all collapse into the SAME `CONFIRM_ACTION_UNAVAILABLE_TEXT` (no leak of which case).
- `SourceCaptureHandler` (a THIRD entry in the confirm-action dispatch table) writes exactly one INFERRED `knowledge_nodes` row (reusing an existing active node for a repeated url — supersede-never-mutate, never a duplicate node) plus one INFERRED `knowledge_node_edges` row per confirm, with full provenance (`{url, title, retrieved_at, conversation_id, thread_id}`) retained; reject writes nothing at all (audit-on-the-interaction-row); the handler never raises past `execute()`.
- A dedicated promotion-reuse proof (`test_source_capture_promote_reuse.py`) builds the EXACT edge shape `SourceCaptureHandler.insert_edge` produces and runs it through the completely unmodified `PromoteEdgeUseCase`/`KnowledgeEdgeTierPromotionHandler` to `EXTRACTED` — `git diff --stat` on `promote_edge.py` shows zero changes, proving CLUS-05 by reuse, not new machinery. Cross-tenant (foreign edge id, mismatched importer_id, and the 44-03 user-ownership guard) and idempotent-promote (tier-guard rejection + a genuine CAS-race no-op) are both proven to never mutate.
- `container.py` wires `SourceCaptureHandler` into the SAME `confirm_action_dispatch` table `KnowledgeEdgeTierPromotionHandler`/`UnsupportedConfirmActionHandler` already live in, reusing the SAME `knowledge_repo` instance already built in that factory.

## Task Commits

Each task followed the RED→GREEN cycle where applicable and was committed atomically:

1. **Task 1: source_capture suggestion kind + parse + tool schema** — `ee75a1b` (feat; test file + source combined, mirrors 54-02 Task 1's documented precedent — see Deviations)
2. **Task 2: SourceCaptureHandler + finalize re-read + container wiring** — `224ebb7` (feat; includes the Rule 2/Rule 1 deviations below)
3. **Task 3: Promotion reuse proof (CLUS-05)** — `32d855a` (test), `9f3b764` (test, closes a coverage gap found during Task 3's own verification pass)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `apps/email-listener/app/application/use_cases/run_chat_turn_confirm_action.py` — `SUGGESTION_KIND_SOURCE_CAPTURE`; `parse_confirm_action_call` accepts both kinds; `build_source_capture_declaration` (sibling builder); `parse_source_capture_result_id` / `extract_web_search_result` (pure result-id helpers)
- `apps/email-listener/app/infrastructure/llm/chat_tools.py` — `suggestionRef.kind` enum gains `"source_capture"`; description documents the id format
- `apps/email-listener/app/application/use_cases/confirm_action_dispatch.py` — `SourceCaptureHandler`; `ConfirmActionHandler` Protocol + the two existing handlers gain additive `source_payload`/`conversation_id`/`thread_id` params
- `apps/email-listener/app/application/use_cases/run_chat_turn.py` — `_finalize_confirm_action` branches by kind; new `_finalize_source_capture` method; module-level `_find_web_search_result` helper; local `_WEB_SEARCH_TOOL_NAME` constant (import-linter-safe)
- `apps/email-listener/app/application/use_cases/submit_widget_interaction.py` — `_dispatch_confirm_action` + new `_resolve_confirm_action_dispatch_args` resolves importer_id/source_payload/conversation_id/thread_id per suggestionRef.kind (Rule 2 deviation, see below)
- `apps/email-listener/app/container.py` — `SourceCaptureHandler` wired into the confirm-action dispatch table
- `apps/email-listener/tests/application/test_source_capture_confirm_action.py` — 23 pure-helper tests (Task 1)
- `apps/email-listener/tests/application/test_source_capture_dispatch.py` — 16 tests: `SourceCaptureHandler` in isolation + `RunChatTurn`'s source_capture finalize branch (Task 2)
- `apps/email-listener/tests/application/test_source_capture_promote_reuse.py` — 7 tests: promotion-reuse proof (Task 3)
- `apps/email-listener/app/application/use_cases/__tests__/test_confirm_action_dispatch.py` — fixed a pre-existing broken assertion (Rule 1, see below)
- `apps/email-listener/app/application/use_cases/__tests__/test_submit_widget_interaction.py` — fixed `FakeConfirmActionHandler`'s stale signature (Rule 1, see below)
- `apps/email-listener/tests/test_container.py` — `TestSourceCaptureDispatchWiring` (container-resolution wiring proof)
- `.planning/phases/54-email-cluster-workflow-e3/deferred-items.md` — logs a pre-existing, repo-wide `ruff format --check .` drift found during verification

## Decisions Made

See `key-decisions` in the frontmatter for the four substantive design decisions (composite result-id format, declaration-snapshot threading, conversation-scoped edge target, server-side `retrieved_at` timing).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `submit_widget_interaction.py` extended to thread source_payload/conversation_id/thread_id into the dispatch call**
- **Found during:** Task 2
- **Issue:** The plan's own Task 2 `<action>` text says the new `ConfirmActionHandler` kwargs are "threaded from the submit path", which is `submit_widget_interaction.py` — but that file is NOT listed in the plan's `files_modified` frontmatter. Without this wiring, `SourceCaptureHandler.execute()` would only ever be called with `source_payload=None`/`conversation_id=None` from the real submit flow (its additive kwargs all default `None`), so confirming a source_capture suggestion in production would ALWAYS return `capture_failed` — the feature would work in `SourceCaptureHandler` unit tests but never actually capture anything end-to-end, directly contradicting the plan's own must_have truth ("On confirm, a source becomes an INFERRED-tier knowledge node...").
- **Fix:** Added `_resolve_confirm_action_dispatch_args` to `submit_widget_interaction.py`: for `source_capture`, `importer_id`/`source_payload`/`thread_id` are read back from the STORED declaration snapshot (`interaction.declaration.get("importerId"/"sourcePayload"/"threadId")`) that `RunChatTurn._finalize_source_capture` froze server-side at emission time; `conversation_id` comes straight from the interaction row. `knowledge_edge_tier_promotion`'s existing edge-based derivation is unchanged (same behavior, just factored into the new helper).
- **Files modified:** `apps/email-listener/app/application/use_cases/submit_widget_interaction.py`
- **Verification:** `test_source_capture_dispatch.py`'s container-wiring test + the full `test_submit_widget_interaction.py` suite (17 tests) stay green; `_reject_if_confirm_action_edge_stale`'s existing kind check already no-ops for `source_capture` (untouched, no change needed there).
- **Committed in:** `224ebb7` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed a pre-existing broken assertion + a pre-existing silently-swallowed test double bug in the confirm-action dispatch test suite**
- **Found during:** Task 2, running the full confirm-action regression suite before committing
- **Issue:** Two PRE-EXISTING bugs, confirmed present on the clean tree BEFORE this plan touched anything (verified via `git stash`): (a) `test_confirm_action_dispatch.py`'s `test_confirm_calls_promote_edge_...` asserted `promote_edge.execute.assert_awaited_once_with(...)` WITHOUT `user_id=None` in the expected kwargs, even though the production code has passed `user_id=user_id` since Phase 44-09; (b) `test_submit_widget_interaction.py`'s `FakeConfirmActionHandler.execute()` signature omitted `user_id` entirely, so the real `_dispatch_confirm_action` call raised a `TypeError` that the caller's own broad `except Exception` silently swallowed — `execute_calls` stayed empty and TWO tests (`test_confirm_action_non_stale_confirm_dispatches_and_yields_continuation`, `test_confirm_action_non_stale_reject_dispatches_and_never_mutates_edge`) were asserting a dispatch call that had never actually happened.
- **Fix:** Added `user_id=None` to the expected kwargs in (a). Added `user_id`/`source_payload`/`conversation_id`/`thread_id` (all additive, defaulted) to `FakeConfirmActionHandler.execute()`'s signature in (b) — the SAME kwargs this plan's own `_dispatch_confirm_action` change now also passes.
- **Files modified:** `apps/email-listener/app/application/use_cases/__tests__/test_confirm_action_dispatch.py`, `apps/email-listener/app/application/use_cases/__tests__/test_submit_widget_interaction.py`
- **Verification:** Both previously-broken tests pass now (`pytest app/application/use_cases/__tests__/test_submit_widget_interaction.py` — 17/17 green, up from 15/17); confirmed pre-existing via `git stash` + re-run against the clean tree before any Task 2 edits.
- **Committed in:** `224ebb7` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 2 — missing critical functionality, required for the feature to work end-to-end rather than just in isolated unit tests; 1 Rule 1 — pre-existing bugs discovered while running regression checks in the exact module this plan extends)
**Impact on plan:** Both fixes were necessary. The Rule 2 fix is the more consequential one — without it, CLUS-04's core "on confirm, a source becomes a knowledge node" truth would silently never happen in production despite every unit test passing. No scope creep beyond what correctness required.

## Issues Encountered

- **Repo-wide `ruff format --check .` drift (~80 files, pre-existing, NOT caused by this plan).** `ruff format --check .` is a real CI gate (`.github/workflows/ci-email-listener.yml` line 38) but reports ~80 files needing reformatting across the repo, the vast majority (~76) never touched by this plan. Four files THIS plan modified are also flagged (`run_chat_turn.py`, `submit_widget_interaction.py`, and the two test files fixed under deviation #2) — verified via `ruff format --diff` that every flagged hunk in each is in code this plan did NOT write (cross-referenced hunk line numbers against this plan's own diffs; every line this plan itself authored passes `ruff format --check` cleanly). Logged to `deferred-items.md` per the executor's scope-boundary rule rather than mass-reformatting ~80 unrelated files. `ruff check .` (linting, the substantive gate) and `mypy app` are both fully clean.
- **`thread_id` cannot be read server-side by this Python service today.** `chat_conversations.thread_id` (migration 0036, authored by 54-01) lives in `packages/db`'s Drizzle schema, read/written only via `packages/api-client`'s TypeScript tRPC procedures (`chat.getConversationThreadId`) — this FastAPI service has no equivalent read path. `thread_id` is fully plumbed end-to-end (SourceCaptureHandler param, provenance dict key, declaration snapshot key) but is always `None` from this service until a future plan gives `RunChatTurn`/`SubmitWidgetInteraction` a way to read it (see Known Stubs).

## Known Stubs

- **`provenance.thread_id` is always `null` from this plan.** File: `apps/email-listener/app/application/use_cases/confirm_action_dispatch.py` (`SourceCaptureHandler.execute`), value flows from `run_chat_turn.py`'s `_finalize_source_capture` (never sets a real thread id, no read path exists) through `submit_widget_interaction.py`'s `_resolve_confirm_action_dispatch_args`. This is NOT a UI-facing stub (nothing renders it) and does not block CLUS-04/CLUS-05's core capability (capture + provenance + promotion all work correctly with `thread_id: null`) — it is a documented placeholder for whichever future plan (54-05 turn-time cluster context, or a dedicated thread-linkage plan) gives the Python service a read path to `chat_conversations.thread_id`. The edge instead attaches to `conversation_id` (`target_ref_type: "chat_conversation"`), which IS a real, always-populated member of "the cluster" per 54-CONTEXT.md's own definition (thread + conversations + captured sources).

## User Setup Required

None — no external service configuration required. All new code paths are code-complete and unit-tested against fakes tonight (Docker/Bedrock/live web_search unavailable, per the overnight-mode instructions); the live capture→promote round-trip on the real inbox is explicitly deferred to the morning §H flow (54-07), consistent with 54-CONTEXT.md's own verification note.

## Next Phase Readiness

- CLUS-04/CLUS-05 are code-complete and marked Complete in REQUIREMENTS.md — the suggest-only capture → INFERRED node → promote-to-EXTRACTED round-trip is fully wired and tested against fakes.
- 54-06 (clusterSummary) can rely on the exact literal contract `source="web_search_capture"` + `scope_ref_type="web_source"` on captured nodes — kept identical to 54-02-PLAN.md's SHARED CONTRACT text.
- 54-07 (morning §H) has one real live-round-trip item still outstanding: capture a real web_search result → confirm → INFERRED node written to a REAL Supabase instance → promote → EXTRACTED, needs Docker + Bedrock + the real DuckDuckGo network path all up simultaneously (none of which were available tonight).
- Whichever plan first gives the Python `RunChatTurn`/`SubmitWidgetInteraction` layer a read path to `chat_conversations.thread_id` should populate it into `_finalize_source_capture`'s declaration build and `SourceCaptureHandler`'s provenance write — every kwarg/field name is already in place, only the source of the value needs to change from "always None" to "read from somewhere real."
- No blockers for 54-04/54-05/54-06 (independent wave-2/3 work per the phase's dependency graph).

---
*Phase: 54-email-cluster-workflow-e3*
*Completed: 2026-07-12*

## Self-Check: PASSED

All 14 claimed files (9 modified, 3 created under `tests/application/`, 1
created `deferred-items.md`, plus this SUMMARY) verified present on disk;
all 4 claimed task commit hashes (`ee75a1b`, `224ebb7`, `32d855a`, `9f3b764`)
verified present in `git log --oneline --all`.
