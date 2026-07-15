# Deferred Items — Phase 57 (Email Learning Loop)

## 57-02: Full-suite 65% coverage ratchet failing due to concurrent sibling-executor work (out of scope)

**Found during:** Plan 57-02, Task 2 acceptance criteria (`cd apps/email-listener && uv run pytest -q` exits 0).

**Observation:** With Plan 57-02's changes alone (verified via targeted runs —
`tests/test_entity_type_classifier_adapter.py`, `tests/test_suggest_entity_types.py`,
`tests/test_container.py`, 48/48 passing), the full suite's coverage gate reports
`FAIL Required test coverage of 65% not reached. Total coverage: 63.72%` (vs. Plan
57-01's recorded baseline of 66.88%).

**Root cause (not Plan 57-02):** `git status` at the time of this run showed concurrent,
uncommitted, in-progress work from sibling Wave-2 executors sharing the same working
tree (not isolated worktrees), disjoint from every file this plan touches:

- `apps/email-listener/app/domain/services/linked_context.py` (new, untracked, 83
  statements, 0% covered)
- `apps/email-listener/app/infrastructure/supabase/chat_context_edge_repository.py`
  (new, untracked, 22 statements, 0% covered)
- `apps/email-listener/app/domain/ports/chat_context_edge_repository.py` (new, untracked)
- Modifications in flight to `run_chat_turn.py`, `chat_repositories.py`,
  `knowledge_graph_repository.py`, `entity_resolution_repository.py`,
  `promote_entity_on_confirm.py`, `resolve_entity_candidates.py`,
  `supabase_chat_message_repository.py`, `test_entity_resolution.py` — none touched
  by this plan.
- `apps/email-listener/app/container.py` was being edited concurrently by both this
  plan AND a sibling executor (Phase 56-04, RCNV-04 `ChatContextEdgeRepository`
  wiring) in the SAME file. This plan's two commits (`b596530`, `4d1e38e`) staged
  ONLY this plan's two hunks via a hand-crafted `git apply --cached` partial patch
  (verified via `git diff --cached` before each commit) — the sibling executor's
  `ChatContextEdgeRepository` hunks were deliberately left unstaged in the working
  tree for that executor to commit separately.

**Evidence this plan's own code is not the regression:** `entity_type_classifier_adapter.py`
had ZERO direct unit tests before this plan (only exercised indirectly via container
smoke tests with a mocked Bedrock client that never called `classify()`). This plan's
new `tests/test_entity_type_classifier_adapter.py` (7 tests) raises that file's
coverage to 66% — a net *improvement*, not a regression.

**Action:** Not fixed here (SCOPE BOUNDARY — pre-existing/concurrent work in files this
plan never touches). Once all Wave-2 executors (57-02, the chat-path Python plan, and
the resolver SQL/Python plan) have committed their in-flight work and their own test
coverage lands, re-run `cd apps/email-listener && uv run pytest -q` to re-verify the
65% ratchet at the phase level. If it still fails after all three plans have committed,
investigate `linked_context.py`/`chat_context_edge_repository.py`'s missing test
coverage as a separate, targeted follow-up (not a Plan 57-02 concern).
