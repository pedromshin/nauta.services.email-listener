# Deferred Items — Phase 54 (Email-Cluster Workflow E3)

Out-of-scope discoveries logged during plan execution, per the executor's
scope-boundary rule (only auto-fix issues directly caused by the current
task's changes; log everything else here instead of fixing it).

## 54-03: repo-wide `ruff format --check .` drift (pre-existing, NOT caused by this plan)

**Found during:** Task 3 verification (`uv run ruff format --check .`).

**Observation:** `ruff format --check .` (a real CI gate per
`.github/workflows/ci-email-listener.yml` line 38) reports ~80 files across
the repo that would be reformatted — the large majority (~76) are files this
plan never touched at all (e.g. `app/infrastructure/llm/genui_generator_adapter.py`,
`app/infrastructure/supabase/knowledge_graph_repository.py`,
`scripts/genui_eval/*.py`, dozens of `tests/**`). This indicates a repo-wide
formatter-version drift (the installed `ruff` version's formatting opinions no
longer match whatever version last formatted these files) that predates this
plan entirely.

**Files this plan touched that are ALSO flagged:** `app/application/use_cases/run_chat_turn.py`,
`app/application/use_cases/submit_widget_interaction.py`,
`app/application/use_cases/__tests__/test_confirm_action_dispatch.py`,
`app/application/use_cases/__tests__/test_submit_widget_interaction.py`.
Verified via `ruff format --diff` on each: every flagged hunk is in code this
plan did NOT modify (confirmed by cross-referencing hunk line numbers against
this plan's own diffs) — e.g. `run_chat_turn.py`'s flagged hunks are at lines
140/434-436/755-758/1317-1320/1353-1360/1583, none of which overlap this
plan's additions (~76-146, ~752-900, ~1452-1483). Every file/line this plan
itself authored passes `ruff format --check` cleanly.

**Why not fixed:** Running `ruff format .` repo-wide would touch ~80 files,
the vast majority with zero relation to this plan's CLUS-04/CLUS-05 scope —
out of scope per the executor's scope-boundary rule, and risks colliding with
other in-flight Phase 54 plans' own uncommitted changes.

**Recommendation:** A future hygiene plan (or the phase's own audit/cleanup
step) should run `ruff format .` once, repo-wide, in its own isolated commit,
after confirming the currently-pinned `ruff` version in `pyproject.toml`'s
`dev` dependency group is the one the team intends (a version pin/bump may be
the actual root cause, not the code).

**Verified NOT a regression this plan introduced:** `ruff check .` (linting,
the substantive gate) is clean; `mypy app` is clean; targeted `pytest`
suites are green. Confirmed pre-existing by checking the SAME 4 files at the
git commit immediately after this plan's Task 2 commit — already flagged
before Task 3 began.
