---
phase: 54-email-cluster-workflow-e3
plan: 05
subsystem: api
tags: [python, fastapi, chat, thread-context, cluster-context, prompt-injection, quarantine]

# Dependency graph
requires:
  - phase: 54-01 (migration 0036 + thread<->conversation linkage tRPC seam)
    provides: "chat_conversations.thread_id column (authored, unapplied) — the Python read path this plan closes"
  - phase: 54-02 (web_search ToolExecutor)
    provides: "envelope/quarantine idiom (truncate_field, MAX_RESULT_FIELD_CHARS) this plan's assembler mirrors locally"
  - phase: 54-03 (source_capture -> INFERRED nodes)
    provides: "the captured-source literal contract (source='web_search_capture', scope_ref_type='web_source') + the 'thread_id unreadable from Python' Known Stub this plan's get_thread_id resolves"
provides:
  - "app.domain.services.thread_cluster_context — pure, bounded, quarantined thread+cluster context assembler (build_thread_context_block/build_cluster_context_block/assemble_cluster_context)"
  - "ChatConversationRepository.get_thread_id/list_by_thread_id — the FIRST Python read path to chat_conversations.thread_id (feature-detected, fail-open)"
  - "EmailRepository.list_by_thread_id — bounded, importer-scoped thread-member-email read"
  - "KnowledgeGraphRepository.list_captured_sources_for_conversations — captured web-source lookup via chat_conversation edges"
  - "RunChatTurn: a thread-linked turn injects the bounded block into the system prompt at the ONE _execute_turn site; an unlinked turn is byte-identical to before"
affects: ["54-06 (clusterSummary — may want the same captured-source query shape)", "54-07 (morning §H live thread-linked-chat round-trip)", "any future plan reading chat_conversations.thread_id server-side in Python"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Domain-pure envelope reimplementation: thread_cluster_context.py reimplements envelope.py's truncate_field idiom locally (never imports it) — app.domain cannot import app.infrastructure (lint-imports), so the bounding/truncation discipline is duplicated by design, same rationale as tool_envelope_gate.py's local _ROUTE_TEMPLATES redeclaration"
    - "Metadata-first budget reservation: assemble_cluster_context reserves a fixed char share for cluster metadata BEFORE building the thread block, so an oversized thread's own budget already excludes that reservation and can never starve sibling/source/panel titles"
    - "Fail-open read pipeline, not a single try/except: each read step (get_thread_id, list_by_thread_id x2, list_captured_sources_for_conversations, assembly itself) independently catches and logs, collapsing to None/[] — an older collaborator missing get_thread_id entirely (AttributeError) degrades exactly like a live read failure or an absent 0036 column, all indistinguishable to the caller"
    - "Additive opt-in collaborator: RunChatTurn's email_repository constructor param defaults None: the ENTIRE feature (including the get_thread_id call itself) is skipped when unwired, not just its result discarded — mirrors knowledge_graph's existing additive-default posture"

key-files:
  created:
    - apps/email-listener/app/domain/services/thread_cluster_context.py
    - apps/email-listener/app/domain/services/__tests__/test_thread_cluster_context.py
    - apps/email-listener/tests/application/test_run_chat_turn_thread_context.py
  modified:
    - apps/email-listener/app/domain/ports/chat_repositories.py
    - apps/email-listener/app/domain/ports/email_repository.py
    - apps/email-listener/app/domain/ports/knowledge_graph_repository.py
    - apps/email-listener/app/infrastructure/supabase/supabase_chat_conversation_repository.py
    - apps/email-listener/app/infrastructure/supabase/email_repository.py
    - apps/email-listener/app/infrastructure/supabase/knowledge_graph_repository.py
    - apps/email-listener/app/application/use_cases/run_chat_turn.py
    - apps/email-listener/app/container.py
    - apps/email-listener/tests/test_container.py

key-decisions:
  - "Injection point is the system prompt, not a new provider message — the bounded block is appended to system_prompt (built via _system_prompt_for) right before streaming, reusing the SAME 'untrusted DATA, never instructions' framing the existing tool-result hardening line establishes on the same string. One consistent injection mechanism, no new message-role handling."
  - "Panel titles derive from history['s own genui_spec parts already loaded for provider_messages — no new I/O. A genui spec has no dedicated title field (verified against packages/genui/src/schema/spec-schema.ts's SpecRootSchema); the model-authored `_plan` field (normally stripped before render) doubles as a human-readable panel description when present, falling back to a turn-indexed generic label otherwise."
  - "Sibling conversations are title-only cluster metadata — chat_conversations has no summary column, so SiblingConversationSummary.summary is always None from this plan's gathering code (the assembler itself fully supports a summary field, for whenever a summarization pipeline exists). Still satisfies CLUS-06's 'sibling conversation titles' truth; 'summaries' is a documented gap, not a blocker."
  - "Captured sources are resolved across ALL conversations linked to the thread (the current one + every sibling from list_by_thread_id), not just the current conversation — this is what makes 54-03's Known Stub (provenance.thread_id always null, edges attach to conversation_id) still work correctly for cluster-level source aggregation without needing to fix that stub in this plan."
  - "Rule 2: EmailRepository gained list_by_thread_id (port + Supabase impl) — not in this plan's declared files_modified, but the plan's own <interfaces> text explicitly names 'the email repository (email_repository port)' as the thread-member-email source, and no existing method could satisfy a thread-scoped, importer-scoped, bounded read."
  - "Rule 2: KnowledgeGraphRepository gained list_captured_sources_for_conversations (port + Supabase impl) — not in this plan's declared files_modified, but required to satisfy CLUS-06's 'captured source titles+URLs' truth; the plan's own <interfaces> text explicitly authorized 'Add sibling-conversation + captured-source reads via the KnowledgeGraphRepository ... as needed'."
  - "Plan file-path correction: the plan's files_modified names 'apps/email-listener/app/infrastructure/supabase/chat_repositories.py', but the actual Supabase adapter for ChatConversationRepository is 'supabase_chat_conversation_repository.py' (chat_repositories.py doesn't exist as an infra filename anywhere in this codebase — each chat_* port has its own supabase_chat_*_repository.py file). Modified the real file; no new file created under the plan's stated (incorrect) name."

requirements-completed: [CLUS-02, CLUS-06]

# Metrics
duration: 55min
completed: 2026-07-12
---

# Phase 54 Plan 05: Thread+Cluster Context Injection Summary

**A thread-linked chat turn now injects a bounded, quarantine-enveloped thread+cluster context block into the system prompt — real email bodies and captured-source metadata treated as untrusted DATA, never instructions — closing the Python-side `chat_conversations.thread_id` read gap 54-03 flagged as a Known Stub.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-07-12T09:16:00-03:00 (approx, first Read call after 54-04's completion commit)
- **Completed:** 2026-07-12T10:12:00-03:00
- **Tasks:** 2/2 completed
- **Files modified:** 12 (3 created, 9 modified)

## Accomplishments

- `app/domain/services/thread_cluster_context.py` — a pure, stdlib-only, deterministic assembler (`build_thread_context_block`, `build_cluster_context_block`, `assemble_cluster_context`) that produces a labeled `--- BEGIN ... ---`/`--- END ... ---` wrapped data block: subject/deduped-participants/recent-message-bodies (thread) plus sibling-titles/captured-source-titles+urls/panel-titles (cluster, metadata-first). Every field is per-field truncated (local reimplementation of `envelope.py`'s `truncate_field` idiom — domain cannot import infrastructure) and the whole block is hard-capped to a combined char budget; a huge thread can never starve the cluster metadata's own reserved share. 18 tests cover labeling, truncation, dedupe, metadata-first ordering, budget bounding, determinism, and injection inertness (a crafted "ignore previous instructions" email body stays confined to its own prefixed data line, never a bare instruction; no tool-envelope forbidden field name ever appears literally).
- `ChatConversationRepository.get_thread_id`/`list_by_thread_id` — the FIRST Python read path to `chat_conversations.thread_id` (migration 0036, authored by 54-01, still unapplied everywhere tonight). Both feature-detect the column's absence (or any other read failure) by catching broadly and returning `None`/`[]`, mirroring `packages/api-client/src/router/_column-detect.ts`'s fail-closed posture on the TS side, adapted as a live-query try/except since supabase-py's PostgREST transport has no direct `information_schema` probe.
- `EmailRepository.list_by_thread_id` and `KnowledgeGraphRepository.list_captured_sources_for_conversations` — the two remaining bounded, importer-scoped reads the cluster-context gathering pipeline needs (thread-member emails; captured `source='web_search_capture'` nodes resolved via their `chat_conversation` edges).
- `RunChatTurn` gained an additive `email_repository` collaborator (default `None`, mirrors `knowledge_graph`'s posture) and, at the ONE `_execute_turn` injection site, appends the assembled block to the system prompt for any conversation whose `get_thread_id` resolves to a real thread with at least one member email. Every step of the gathering pipeline is independently fail-open: no `email_repository` wired, no thread linked, an absent 0036 column, an OLDER `conversations` collaborator with no `get_thread_id` method at all, or any read/assembly failure — all collapse to "skip cleanly, turn runs exactly as before," never a 500. Panel titles are derived from the ALREADY-loaded `history` parameter (no extra I/O).
- `container.py` needed zero new DI wiring — `email_repo` was already a `_provide_run_chat_turn` factory parameter (used for `search_emails_executor`) and `knowledge_repo` was already reused for Phase 40-01's confirm-action collaborator; both are now ALSO threaded into `RunChatTurn`'s new collaborators.

## Task Commits

Each task followed the RED→GREEN cycle and was committed atomically:

1. **Task 1: Pure thread + cluster context assembly** — `69fb3fc` (test, RED) → `f90c816` (feat, GREEN)
2. **Task 2: thread_id-aware reads + RunChatTurn injection wiring** — `36dfd1f` (test, RED) → `f4cb686` (feat, GREEN)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `apps/email-listener/app/domain/services/thread_cluster_context.py` — pure assembler: `ThreadMessageBody`/`SiblingConversationSummary`/`CapturedSourceRef` DTOs, `build_thread_context_block`/`build_cluster_context_block`/`assemble_cluster_context`, local `truncate_field`
- `apps/email-listener/app/domain/services/__tests__/test_thread_cluster_context.py` — 18 tests (Task 1)
- `apps/email-listener/tests/application/test_run_chat_turn_thread_context.py` — 7 tests: injection, regression (thread-unlinked byte-identical), feature-detect failure, budget bounding, tenant scoping, opt-in-only (Task 2)
- `apps/email-listener/app/domain/ports/chat_repositories.py` — `ChatConversationRepository.get_thread_id`/`list_by_thread_id`
- `apps/email-listener/app/domain/ports/email_repository.py` — `EmailRepository.list_by_thread_id`
- `apps/email-listener/app/domain/ports/knowledge_graph_repository.py` — `KnowledgeGraphRepository.list_captured_sources_for_conversations` + `DEFAULT_CAPTURED_SOURCES_LIMIT`
- `apps/email-listener/app/infrastructure/supabase/supabase_chat_conversation_repository.py` — Supabase impls of `get_thread_id`/`list_by_thread_id` (fail-open, feature-detecting)
- `apps/email-listener/app/infrastructure/supabase/email_repository.py` — `list_by_thread_id` impl
- `apps/email-listener/app/infrastructure/supabase/knowledge_graph_repository.py` — `list_captured_sources_for_conversations` impl (edges -> nodes two-step read)
- `apps/email-listener/app/application/use_cases/run_chat_turn.py` — `email_repository` constructor param; `_resolve_thread_id`/`_list_thread_emails`/`_list_sibling_conversations`/`_list_captured_sources`/`_assemble_cluster_block`/`_build_cluster_context_block`/`_system_prompt_with_cluster_context` gathering pipeline; module-level `_extract_panel_titles`; injection wired into `_execute_turn`
- `apps/email-listener/app/container.py` — `email_repository=email_repo` threaded into `RunChatTurn(...)`
- `apps/email-listener/tests/test_container.py` — `TestClusterContextWiring` (container-resolution wiring proof)

## Decisions Made

See `key-decisions` in the frontmatter for the six substantive design decisions (system-prompt injection point, panel-title derivation, sibling-summary scope limitation, cross-conversation captured-source aggregation, and two Rule 2 port additions).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `EmailRepository` gained `list_by_thread_id`**
- **Found during:** Task 2
- **Issue:** The plan's own `<interfaces>` text says thread member emails "come from the email repository (email_repository port) scoped by importer_id" — but no existing `EmailRepository` method could do a thread-scoped, importer-scoped, bounded read (`list_by_importer`/`list_by_importer_ids` have no thread filter). Without this, the thread-context block (subject/participants/recent bodies) could never be built at all — the plan's own must-have truth would silently never fire.
- **Fix:** Added `list_by_thread_id(*, importer_id, thread_id, limit, offset=0) -> list[Email]` to the port and `SupabaseEmailRepository`, scoped by both `importer_id` AND `thread_id` (a foreign-importer thread_id resolves to `[]`, never a cross-tenant leak).
- **Files modified:** `apps/email-listener/app/domain/ports/email_repository.py`, `apps/email-listener/app/infrastructure/supabase/email_repository.py`
- **Verification:** Exercised indirectly via `test_run_chat_turn_thread_context.py`'s `FakeEmailRepository`; `ruff`/`mypy`/`lint-imports` clean; full repo test suite green.
- **Committed in:** `f4cb686` (Task 2 GREEN commit)

**2. [Rule 2 - Missing critical functionality] `KnowledgeGraphRepository` gained `list_captured_sources_for_conversations`**
- **Found during:** Task 2
- **Issue:** CLUS-06's must-have truth requires "captured source titles+URLs" in the cluster block. The plan's own `<interfaces>` text explicitly names this as needed ("Add sibling-conversation + captured-source reads via the KnowledgeGraphRepository ... as needed"), but no existing method resolves 54-03's `source='web_search_capture'` knowledge_nodes via their `chat_conversation` edges.
- **Fix:** Added `list_captured_sources_for_conversations(*, importer_id, conversation_ids, limit)` — a two-step read (active `knowledge_node_edges` with `target_ref_type='chat_conversation'` → their `source_node_id`s, then the matching `knowledge_nodes` filtered to the exact 54-03 literal contract, scoped to `importer_id`). Never raises; degrades to `[]` on any failure, mirroring this file's existing `_vector_search_query`/`_trgm_search_query` posture.
- **Files modified:** `apps/email-listener/app/domain/ports/knowledge_graph_repository.py`, `apps/email-listener/app/infrastructure/supabase/knowledge_graph_repository.py`
- **Verification:** Exercised via `test_run_chat_turn_thread_context.py`'s `FakeKnowledgeGraphRepository` (asserts `importer_id` scoping + result appears in the injected block); `ruff`/`mypy`/`lint-imports` clean.
- **Committed in:** `f4cb686` (Task 2 GREEN commit)

**3. [Rule 1 - Bug/plan inaccuracy] Corrected the Supabase adapter file path**
- **Found during:** Task 2, `<read_first>` step
- **Issue:** The plan's `files_modified` frontmatter names `apps/email-listener/app/infrastructure/supabase/chat_repositories.py` — no such file exists in this codebase; each `chat_*` port has its own dedicated `supabase_chat_*_repository.py` file (established since Phase 22-06). The correct file for `ChatConversationRepository` is `supabase_chat_conversation_repository.py`.
- **Fix:** Modified the real file. No incorrectly-named file was created.
- **Files modified:** `apps/email-listener/app/infrastructure/supabase/supabase_chat_conversation_repository.py`
- **Verification:** `grep -q "get_thread_id" apps/email-listener/app/infrastructure/supabase/supabase_chat_conversation_repository.py` passes; the plan's acceptance criterion ("`grep -q "get_thread_id"` ... the Supabase impl") is satisfied against the real file.
- **Committed in:** `f4cb686` (Task 2 GREEN commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 2 — missing critical functionality required for CLUS-02/CLUS-06's truths to actually fire, not just pass isolated unit tests; 1 Rule 1 — a plan file-path inaccuracy corrected against the real codebase layout)
**Impact on plan:** All three were necessary. The two Rule 2 additions are the more consequential ones — without them, the assembler would be fully tested in isolation but the cluster block's "sibling titles" and "captured source titles+URLs" sections would always be empty in production. No scope creep beyond what the plan's own `<interfaces>` text already authorized.

## Issues Encountered

- **`_execute_turn`/`_build_cluster_context_block` initially tripped ruff's `PLR0911`/`PLR0912` complexity gates.** Refactored the single monolithic gathering method into a small pipeline (`_resolve_thread_id` → `_list_thread_emails` → `_assemble_cluster_block`) and extracted the system-prompt-composition branch into `_system_prompt_with_cluster_context`, restoring `_execute_turn` to its pre-plan branch count. No behavior change — purely a decomposition for lint compliance, verified by the full regression suite staying green before and after.
- **`ruff format --check` repo-wide drift (pre-existing, ~consistent with 54-02/54-03's documented finding).** Every hunk `ruff format --diff` flagged in this plan's modified files was cross-referenced against this plan's own diff; code this plan authored was reformatted in place (3 files: the two new test files plus the new `list_by_thread_id` method body in `supabase_chat_conversation_repository.py`), while pre-existing unrelated formatting drift in the SAME files (e.g. `run_chat_turn.py`'s `touch()`/other untouched lines) was left alone per the executor's scope-boundary rule.

## Known Stubs

None UI-facing (this plan is server-side only). One documented server-side gap: `SiblingConversationSummary.summary` is always `None` from this plan's gathering code — `chat_conversations` has no summary column, so the cluster block shows sibling conversation TITLES only, never an extended summary line. The assembler itself (`build_cluster_context_block`) fully supports rendering a summary when one is supplied; this is a data-availability gap, not a code gap, and does not block CLUS-06's stated truth ("sibling conversation titles/summaries" — titles are the load-bearing half, satisfied).

## User Setup Required

None — no external service configuration required. Every new code path is unit-tested against fakes/mocks tonight (Docker/Bedrock unavailable per overnight-mode); the live turn-with-thread-in-context round-trip (real Bedrock, applied migration 0036, real Supabase) is explicitly deferred to the morning §H flow per this plan's own `<verification>` note, consistent with 54-01/54-02/54-03/54-04's identical posture.

## Next Phase Readiness

- CLUS-02/CLUS-06 are code-complete and marked Complete in REQUIREMENTS.md — a thread-linked turn injects a bounded, quarantined context block; an unlinked turn is provably byte-identical to before (regression-guarded); every failure mode (missing column, no thread, read errors, an unupgraded collaborator) fails open.
- 54-06 (clusterSummary) can reuse the exact same `list_captured_sources_for_conversations` query shape (edges → nodes via the 54-03 literal contract) if it needs a captured-source count/list on the TS side — the Python query here is the reference implementation.
- 54-07 (morning §H) has one real live-round-trip item still outstanding for THIS plan: apply migration 0036 (local→staging→prod), attach a real chat to a real thread via 54-04's UI, and confirm the agent's answer actually draws on the thread's real email content — needs Docker + Bedrock + the applied migration all up simultaneously (none available tonight).
- No blockers for 54-06 (independent wave-3 work per the phase's dependency graph — CLUS-06 is a shared requirement, but 54-06's own scope is the `clusterSummary` genui-facing surface, not this plan's server-side injection).

---
*Phase: 54-email-cluster-workflow-e3*
*Completed: 2026-07-12*

## Self-Check: PASSED

All 13 claimed files (3 created, 9 modified, plus this SUMMARY) verified
present on disk; all 4 claimed task commit hashes (`69fb3fc`, `f90c816`,
`36dfd1f`, `f4cb686`) verified present in `git log --oneline --all`.
