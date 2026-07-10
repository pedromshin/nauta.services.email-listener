---
phase: 44-tenancy-user-id-scoping-enforced-isolation
plan: 03
subsystem: api
tags: [fastapi, tenancy, dishka, supabase, pytest]

# Dependency graph
requires:
  - phase: 44-tenancy-user-id-scoping-enforced-isolation
    plan: 01
    provides: user_id NOT NULL on importers (the tenant anchor this plan's owned-importer resolver queries)
  - phase: 43-auth-google-oauth-sessions-supabase-auth
    plan: 04
    provides: non-enforcing extract_user_id + X-User-Id forwarded on every FastAPI-proxying BFF route
provides:
  - "app.presentation.middleware.user_context.require_user_id — enforcing X-User-Id dependency (401 when absent/empty)"
  - "ImporterResolver.list_importer_ids_for_user(user_id) — owned-importer-id resolver (port + SupabaseImporterRepository impl), the FastAPI-side ownership chokepoint"
  - "EmailRepository.list_by_importer_ids — owned-importer-set scoped email listing (port + Supabase impl)"
  - "emails.py: list_emails/get_email/download_attachment/reprocess_email all require X-User-Id and scope to the caller's owned importers"
  - "PromoteEdgeUseCase.execute(user_id=...) — optional keyword-only user-ownership guard, additive on top of the existing importer tenant-mismatch guard"
  - "knowledge_edges.py promote endpoint requires X-User-Id and threads user_id into the use case"
affects: [44-04, 44-05, 44-06, 44-07, 44-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Enforcing/non-enforcing dependency pair in the same module (extract_user_id stays non-enforcing; require_user_id is the additive 401-on-absence sibling) — mirrors the require_api_key/no-auth-bypass idiom already established in auth.py"
    - "Fail-closed 404 (never 403) for per-resource ownership checks (get_email/download/reprocess) so a non-owned resource's existence is never disclosed; 403 reserved for the list-level explicit-filter case where the caller already knows the importer_id they asked for"
    - "Optional keyword-only user_id on PromoteEdgeUseCase.execute — additive guard that no-ops for callers that don't yet carry a per-request user id (chat confirm_action dispatch), avoiding a cross-cutting rewrite of the chat turn loop in this plan's scope"

key-files:
  created:
    - apps/email-listener/tests/presentation/api/v1/test_emails_user_scoping.py
    - apps/email-listener/tests/presentation/api/__init__.py
    - apps/email-listener/tests/presentation/api/v1/__init__.py
    - apps/email-listener/tests/application/test_promote_edge_user_scoping.py
  modified:
    - apps/email-listener/app/presentation/middleware/user_context.py
    - apps/email-listener/app/domain/ports/importer_resolver.py
    - apps/email-listener/app/infrastructure/supabase/importer_repository.py
    - apps/email-listener/tests/presentation/test_user_context.py
    - apps/email-listener/app/presentation/api/v1/emails.py
    - apps/email-listener/app/domain/ports/email_repository.py
    - apps/email-listener/app/infrastructure/supabase/email_repository.py
    - apps/email-listener/tests/test_emails_api.py
    - apps/email-listener/app/application/use_cases/promote_edge.py
    - apps/email-listener/app/presentation/api/v1/knowledge_edges.py
    - apps/email-listener/app/container.py
    - apps/email-listener/tests/test_promote_edge_endpoint.py

key-decisions:
  - "PromoteEdgeUseCase.execute's new user_id param is optional (default None), not required — the chat confirm_action dispatch path (confirm_action_dispatch.py, KnowledgeEdgeTierPromotionHandler) calls promote_edge without a per-request user_id today, and threading real user identity through the chat turn loop into that dispatch is a materially different, larger change than this plan's stated file list. The REST endpoint (the only fix target named in the plan/threat model for this task) always supplies user_id; the guard is a strict no-op for the untouched chat path, which is exactly the pre-44-03 behavior it had before."
  - "list_emails: an explicit ?importer_id= not in the caller's owned set returns 403 (the caller explicitly named an id they don't own); omitting the filter and owning zero importers returns an empty list, never all rows — matches the plan's own suggested split."
  - "get_email/download_attachment/reprocess_email return 404 (never 403) for a non-owned importer — fail-closed, no existence oracle, consistent with the promote endpoint's information-non-disclosure disposition already established in Phase 30."

requirements-completed: [TENA-03]

# Metrics
duration: ~50min
completed: 2026-07-10
---

# Phase 44 Plan 03: FastAPI User-Id Scoping Summary

**Enforcing `require_user_id` + an owned-importer resolver now gate every user-scoped FastAPI route — `list_emails`/`get_email`/`download_attachment`/`reprocess_email` scope strictly to the caller's owned importers (never a raw query-param importer_id), and `PromoteEdgeUseCase` gained an additive user-ownership guard so a client-supplied body `importer_id` can no longer promote another user's knowledge edge.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-07-09T23:15:00Z (approx.)
- **Completed:** 2026-07-10T02:45:00Z
- **Tasks:** 3 completed
- **Files modified:** 16 (4 created, 12 modified)

## Accomplishments

- `user_context.py` gained `require_user_id` — 401s on missing/empty `X-User-Id`, mirroring `require_api_key`'s raise style; `extract_user_id` stays byte-identical for genuinely optional surfaces.
- `ImporterResolver.list_importer_ids_for_user(user_id)` (port + `SupabaseImporterRepository` impl) is the new owned-importer-id resolver — empty list (never "all importers") when a user owns nothing, the fail-closed primitive every downstream check in this plan is built on.
- `emails.py`: all four endpoints (`list`, `get`, `download_attachment`, `reprocess`) now require `X-User-Id`. `list_emails` ignores an explicit `importer_id` query param unless it's in the caller's owned set (403 otherwise); omitting it scopes the listing to every importer the caller owns via a new `EmailRepository.list_by_importer_ids` (port + Supabase `.in_()` impl). `get_email`/`download_attachment`/`reprocess_email` 404 (fail-closed, no existence oracle) when the resolved email's `importer_id` isn't owned by the caller — replaces the old D-18 "installation-wide, no importer check" comment/posture entirely.
- `PromoteEdgeUseCase.execute` gained an optional keyword-only `user_id`: when supplied, the edge's `importer_id` must be in the set the caller owns (checked via the same `ImporterResolver`, injected as a new use-case collaborator), evaluated BEFORE the pre-existing body-`importer_id` equality guard — both raise the identical `EdgeNotPromotable("tenant_mismatch", ...)` (409, no cross-tenant oracle). The `knowledge_edges.py` promote endpoint now requires `X-User-Id` and threads the resolved id through. `container.py`'s `_provide_promote_edge_use_case` factory wires the already-bound `ImporterResolver` into the use case.
- 26 new tests across 3 dedicated files prove presence-gating, ownership scoping, and cross-user/cross-tenant rejection; 2 pre-existing test files (`tests/test_emails_api.py`, `tests/test_promote_edge_endpoint.py`) were updated to the new tenant-scoped contract so the full suite stays green (see Deviations).
- Full suite (`uv run pytest --no-cov`): all green, zero new failures vs. the pre-plan baseline (only pre-existing credential-gated skips). `mypy`, `ruff check`, and `lint-imports` all clean on every file this plan touched (pre-existing unrelated errors elsewhere in the codebase, confirmed untouched by this plan's commits via `git log`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Enforcing require_user_id dependency + owned-importer resolver** - `4a3278a` (feat)
2. **Task 2: Scope the email read/reprocess endpoints to the caller's owned importers** - `1d73d09` (feat)
3. **Task 3: User-ownership guard on knowledge-edge promotion** - `0092a6c` (feat)

**Plan metadata:** (this SUMMARY.md commit, following)

## Files Created/Modified

- `apps/email-listener/app/presentation/middleware/user_context.py` - Adds enforcing `require_user_id`; `extract_user_id` unchanged
- `apps/email-listener/app/domain/ports/importer_resolver.py` - Adds `list_importer_ids_for_user` to the `ImporterResolver` Protocol
- `apps/email-listener/app/infrastructure/supabase/importer_repository.py` - Implements `list_importer_ids_for_user` via `.eq("user_id", ...)`
- `apps/email-listener/tests/presentation/test_user_context.py` - 3 new tests for `require_user_id` (present/absent/empty)
- `apps/email-listener/app/presentation/api/v1/emails.py` - All 4 endpoints require `X-User-Id` + owned-importer scoping/ownership assertions
- `apps/email-listener/app/domain/ports/email_repository.py` / `app/infrastructure/supabase/email_repository.py` - New `list_by_importer_ids` scoped listing
- `apps/email-listener/tests/presentation/api/v1/test_emails_user_scoping.py` - New: 14 tests, two-user/two-importer isolation proof
- `apps/email-listener/tests/test_emails_api.py` - Updated to the tenant-scoped contract (X-User-Id default header, `ImporterResolver` mock, foreign-importer tests flipped to 404)
- `apps/email-listener/app/application/use_cases/promote_edge.py` - Optional `user_id` param + ownership guard + `importers` collaborator
- `apps/email-listener/app/presentation/api/v1/knowledge_edges.py` - Promote endpoint requires `X-User-Id`, threads `user_id`
- `apps/email-listener/app/container.py` - `_provide_promote_edge_use_case` now injects `ImporterResolver`
- `apps/email-listener/tests/application/test_promote_edge_user_scoping.py` - New: 5 tests (owned/cross-tenant/cross-user/no-user_id/misconfigured)
- `apps/email-listener/tests/test_promote_edge_endpoint.py` - Updated for X-User-Id requirement + new factory signature

## Decisions Made

See `key-decisions` in frontmatter. Summary: the user-ownership guard on `PromoteEdgeUseCase` is additive/optional rather than a hard rewrite of every caller, so the chat confirm_action dispatch path (out of this plan's stated scope) is left exactly as it behaved before — only the REST promote endpoint (the plan's actual fix target) gets the new enforcement. Ownership-check rejections are 404 for per-resource endpoints (no existence oracle) and 403 for the list-level explicit-filter case (the caller already named the id).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated `tests/test_emails_api.py` to the new tenant-scoped contract**
- **Found during:** Task 2 (after adding `require_user_id` + ownership checks to `emails.py`)
- **Issue:** The pre-existing test file asserted the OLD D-18 behavior this task explicitly targets removing — two tests (`test_get_email_visible_for_any_importer`, `test_reprocess_allowed_for_any_importer`) asserted that ANY importer's email was readable/reprocessable, which is now factually wrong and a security regression if left unfixed; every other test in the file lacked the now-required `X-User-Id` header and an `ImporterResolver` mock, so all would 401.
- **Fix:** Added a default `X-User-Id` header to the test client, added an `ImporterResolver` mock (`list_importer_ids_for_user` returning the fixture's owned importer), and flipped the two contradicting tests to assert 404 for a foreign importer (`test_get_email_404_for_non_owned_importer`, `test_reprocess_404_for_non_owned_importer`), plus added explicit 401-without-X-User-Id and 403-for-non-owned-filter tests to keep local coverage self-consistent with the new dedicated suite.
- **Files modified:** `apps/email-listener/tests/test_emails_api.py`
- **Verification:** `uv run pytest tests/test_emails_api.py --no-cov` — 18/18 pass
- **Committed in:** `1d73d09` (Task 2 commit)

**2. [Rule 1 - Bug] Updated `tests/test_promote_edge_endpoint.py` for the new X-User-Id requirement + factory signature**
- **Found during:** Task 3 (after adding `Depends(require_user_id)` to the promote endpoint and a new `importer_resolver` param to `_provide_promote_edge_use_case`)
- **Issue:** Every existing test in this file lacked `X-User-Id` (would now 401 before reaching the mocked use case), one assertion (`assert_awaited_once_with(edge_id=..., importer_id=...)`) didn't account for the new `user_id` kwarg the endpoint now passes, and the factory-wiring smoke test called `_provide_promote_edge_use_case(client)` with the old one-argument signature.
- **Fix:** Set a default `X-User-Id` header on the shared `TestClient`, updated the one affected `assert_awaited_once_with` to include `user_id=_USER_ID`, and updated the factory test to pass a mock `importer_resolver` and assert it's threaded onto `use_case._importers`.
- **Files modified:** `apps/email-listener/tests/test_promote_edge_endpoint.py`
- **Verification:** `uv run pytest tests/test_promote_edge_endpoint.py tests/test_promote_edge.py --no-cov` — 18/18 pass (10 unchanged pre-existing `test_promote_edge.py` tests confirm the optional-`user_id` design didn't disturb any legacy caller)
- **Committed in:** `0092a6c` (Task 3 commit)

**3. [Rule 3 - Blocking] Wired `ImporterResolver` into `container.py`'s `_provide_promote_edge_use_case` factory**
- **Found during:** Task 3 (`PromoteEdgeUseCase.__init__` gained an `importers` collaborator)
- **Issue:** `container.py` is not in the plan's stated `files_modified` list, but the DI factory that constructs `PromoteEdgeUseCase` had to be updated or the container would build a use case with `importers=None`, silently disabling the new guard for the REST endpoint in production.
- **Fix:** Added an `importer_resolver: ImporterResolver` parameter to `_provide_promote_edge_use_case` (dishka resolves it from the already-bound `ImporterResolver` provider) and passed it through as `importers=importer_resolver`.
- **Files modified:** `apps/email-listener/app/container.py`
- **Verification:** `uv run pytest tests/test_promote_edge_endpoint.py::test_container_builds_with_promote_edge_use_case --no-cov` passes; `test_promote_edge_use_case_factory_instantiates_repo_directly` (updated) confirms the collaborator is threaded through
- **Committed in:** `0092a6c` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 test-contract fixes directly required by this plan's own behavior change, 1 Rule 3 blocking DI-wiring fix)
**Impact on plan:** All three were necessary consequences of the plan's own signature/behavior changes (adding required dependencies to existing endpoints, adding a new use-case collaborator) — none introduce scope creep beyond making the changed contract actually work end-to-end and keeping the full test suite green, as the plan's own `<verification>` section requires.

## Issues Encountered

- `PromoteEdgeUseCase`'s new `user_id` parameter could not be made required without either (a) threading real per-request user identity through the entire chat turn loop into `confirm_action_dispatch.py` — a materially larger change touching files never named in this plan's scope, `<interfaces>` block, or threat model — or (b) breaking the existing chat confirm-action promotion path outright. Resolved by making `user_id` optional (default `None`), documented extensively in the use case's own docstring and this SUMMARY's key-decisions. The REST endpoint (the plan's actual, named fix target) always supplies it; the chat path is unaffected and unchanged from its pre-44-03 behavior.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TENA-03 (REQUIREMENTS.md) intentionally left **Pending** — it spans Plans 02/03/05/06/07/08 and only completes at Plan 08's adversarial cross-tenant gate, per this plan's explicit instructions. Not touched.
- The FastAPI half of the cross-tenant boundary named in this plan's objective is closed: `emails.py`'s query-param importer_id, the detail/download/reprocess no-ownership-gate, and `promote_edge`'s client-body-importer_id-only trust are all fixed with regression tests locking each.
- Known, explicitly-scoped gap for a later plan: the chat confirm_action promotion path (`confirm_action_dispatch.py` → `PromoteEdgeUseCase.execute` without `user_id`) is NOT user-scoped yet — it was out of this plan's stated file list/threat model and threading real per-request user identity through the chat turn loop is a larger, separate change. Flagged here for whichever later plan (44-05/06/07, or a follow-up) addresses chat-surface tenancy.
- Plans 44-04 through 44-08 (RLS policies, remaining sweeps, adversarial gate) are unblocked to proceed against this plan's `require_user_id` + `list_importer_ids_for_user` primitives.

---
*Phase: 44-tenancy-user-id-scoping-enforced-isolation*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: apps/email-listener/app/presentation/middleware/user_context.py (require_user_id present)
- FOUND: apps/email-listener/app/domain/ports/importer_resolver.py (list_importer_ids_for_user present)
- FOUND: apps/email-listener/app/infrastructure/supabase/importer_repository.py (list_importer_ids_for_user present)
- FOUND: apps/email-listener/tests/presentation/test_user_context.py
- FOUND: apps/email-listener/app/presentation/api/v1/emails.py (require_user_id on all 4 endpoints)
- FOUND: apps/email-listener/app/domain/ports/email_repository.py (list_by_importer_ids present)
- FOUND: apps/email-listener/app/infrastructure/supabase/email_repository.py (list_by_importer_ids present)
- FOUND: apps/email-listener/tests/presentation/api/v1/test_emails_user_scoping.py
- FOUND: apps/email-listener/app/application/use_cases/promote_edge.py (user_id param + importers collaborator present)
- FOUND: apps/email-listener/app/presentation/api/v1/knowledge_edges.py (require_user_id present)
- FOUND: apps/email-listener/app/container.py (importer_resolver threaded into _provide_promote_edge_use_case)
- FOUND: apps/email-listener/tests/application/test_promote_edge_user_scoping.py
- FOUND: commit 4a3278a (feat(44-03): add enforcing require_user_id dependency + owned-importer resolver)
- FOUND: commit 1d73d09 (feat(44-03): scope email read/reprocess endpoints to caller-owned importers)
- FOUND: commit 0092a6c (feat(44-03): user-ownership guard on knowledge-edge promotion)
- VERIFIED: `uv run pytest tests/presentation/test_user_context.py tests/presentation/api/v1/test_emails_user_scoping.py tests/application/test_promote_edge_user_scoping.py --no-cov` — 26/26 passed
- VERIFIED: `uv run pytest --no-cov` (full suite) — all green, zero new failures (only pre-existing credential-gated skips)
- VERIFIED: `uv run mypy` / `uv run ruff check` / `uv run lint-imports` — zero issues in any file this plan touched (pre-existing unrelated errors elsewhere confirmed untouched via `git log`)
- VERIFIED: `grep -n "require_user_id" app/presentation/api/v1/emails.py app/presentation/api/v1/knowledge_edges.py` — present on every user-scoped endpoint
