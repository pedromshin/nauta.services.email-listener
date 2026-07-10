---
phase: 44-tenancy-user-id-scoping-enforced-isolation
verified: 2026-07-10T06:13:03Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Adversarial cross-tenant test suite passes as the acceptance gate — a second user cannot read/write the first user's data via ANY route/procedure (ROADMAP SC2 / TENA-03's own literal text: 'every web route and tRPC procedure derives tenant scope from the session')"
  gaps_remaining: []
  regressions: []
---

# Phase 44: Tenancy — user_id Scoping + Enforced Isolation Verification Report

**Phase Goal:** Every row of user-owned data belongs to a user and is unreachable across users — enforced at the app boundary (primary), defended in depth by RLS.
**Verified:** 2026-07-10T06:13:03Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plan 44-09)

## Re-verification Findings (2026-07-10, after Plan 44-09)

Plan 44-09 (commits `a4bd0d7`, `3733512`) closed the single gap from the initial
verification (chat SSE endpoints had zero per-user ownership enforcement). This
re-verification independently re-derives that claim from the live codebase — not
from SUMMARY.md narration — with the following checks.

### 1. Gap fix — source-read confirmation

- **`apps/email-listener/app/presentation/api/v1/chat_stream.py`**: both `stream_chat`
  and `regenerate_chat` now declare `conversations: FromDishka[ChatConversationRepository]`
  and `user_id: str = Depends(require_user_id)`, and call
  `await assert_conversation_owned(conversations, user_id, body.conversation_id)` as the
  FIRST line of each handler body — strictly before `use_case.run(...)`/`.regenerate(...)` is
  invoked and before `StreamingResponse(...)` is constructed. Confirmed by direct read
  (lines 175–222). `assert_conversation_owned` (lines 73–86) raises `HTTPException(404,
  "Conversation not found")` when `owner is None or owner != user_id` — fail-closed, no
  existence oracle (mirrors `emails.py`'s `_assert_importer_owned` exactly, as claimed).
- **`apps/email-listener/app/presentation/api/v1/chat_widget.py`**: `submit_widget` declares
  the same `conversations`/`user_id` dependencies and calls
  `await assert_conversation_owned(...)` (imported from `chat_stream.py`) as the first line
  of the handler body, before the `prepare()` try-block (lines 95–129). `user_id=user_id` is
  passed into `use_case.prepare(...)`.
- **`apps/email-listener/app/application/use_cases/confirm_action_dispatch.py`**:
  `KnowledgeEdgeTierPromotionHandler.execute` now calls
  `self._promote_edge.execute(edge_id=..., importer_id=..., user_id=user_id, mechanism=...,
  extra=...)` (line 102–108) — the exact call site the prior gap named as a permanent no-op.
  `user_id` is threaded end-to-end: `chat_widget.py` → `SubmitWidgetInteraction.prepare(user_id=...)`
  (line 145/176) → `_dispatch_confirm_action(..., user_id)` (line 176/205/219) →
  `ConfirmActionHandler.execute(user_id=...)` (line 273/311) → `PromoteEdgeUseCase.execute(user_id=...)`.
  Confirmed by grep across the full chain, not just the endpoints.
- **`owner_user_id` port method**: present on both the `ChatConversationRepository` Protocol
  (`app/domain/ports/chat_repositories.py:191`) and the Supabase implementation
  (`app/infrastructure/supabase/supabase_chat_conversation_repository.py:43`).

All three placements are pre-stream / pre-`prepare()` as the plan required — `run()`/
`regenerate()`/`prepare()` are lazy async generators, so an in-use-case check would have
fired mid-stream, not fail-closed. The endpoint-level gate is the only placement that
actually closes the gap; this was verified directly in the handler bodies, not inferred.

### 2. Test execution — independently re-run, not sourced from SUMMARY

| Command | Result | Status |
|---|---|---|
| `uv run pytest tests/adversarial/test_chat_sse_user_scoping.py --no-cov -v` | `collected 10 items` → `10 passed`, 0 failed, 0 xfailed | ✓ PASS |
| `grep -c "pytest.mark.xfail(" tests/adversarial/test_chat_sse_user_scoping.py` | `0` | ✓ PASS (zero xfail markers remain) |
| `ls tests/adversarial/test_chat_widget_submit_known_gap.py` | `No such file or directory` | ✓ PASS (old gap-locking file confirmed removed, not just renamed-in-name) |
| `uv run pytest tests/adversarial tests/presentation tests/application --no-cov` | `269 passed, 1 warning` — 0 failed, 0 xfailed | ✓ PASS (plan-level gate, matches SUMMARY's claimed 269) |

The 10 tests read as substantive, not stub assertions: 401-without-header, 404-cross-tenant,
and 200-positive-control for all three endpoints (6 tests), plus a dedicated unit test
(`test_confirm_action_promotion_forwards_caller_user_id`) that asserts
`promote_edge.execute.assert_awaited_once_with(..., user_id=_OWNER_USER_ID, ...)` — this is
the one test that proves the dispatch-chain wiring behaviorally, not just via source read.

### 3. Regression check — prior adversarial suite unaffected

`npx vitest run src/router/__tests__/cross-tenant-adversarial.test.ts` (packages/api-client):
**26/26 passed**, matching the initial verification's count exactly — the tRPC-layer
acceptance gate (attachments route + promote proxy) shows no regression from the chat-SSE
fix (expected, since the fix only touches FastAPI presentation/application-layer files, none
of which the tRPC suite exercises).

### 4. Requirements + inventory consistency

- `.planning/REQUIREMENTS.md` lines 26–29 / 85–88: **TENA-01, TENA-02, TENA-03, TENA-04 all
  `[x]` Complete.** TENA-03's traceability note (line 87) now reads: "spanned Plans
  02/03/05/06/07/08/09; adversarial acceptance gate green — the chat-SSE gap found at Plan
  08's sweep is CLOSED by Plan 09" — this is an accurate, non-overreaching claim (verified
  above, not just asserted).
- `44-SWEEP-INVENTORY.md`: zero `| GAP |` rows remain in either the apps/web routes table or
  the FastAPI endpoints table (`grep` for `| GAP |` → no matches, only the legend definition
  at line 18 explaining what the GAP marker would mean). The three chat rows (lines 132–134,
  151–153) are flipped to enforced with `test_chat_sse_user_scoping.py` as the locking test.
  The "Known Gap" section header now reads "## Known Gap — CLOSED by Plan 44-09" (line 157)
  with `**Status: CLOSED.**` (line 159) — original exploit description retained for
  provenance, as the plan specified.

### 5. Debt-marker sweep on the 8 plan-touched source/test files

`grep -n -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` across all 8 files listed in the 44-09
plan's `files_modified` (excluding the two doc files) — zero hits.

### Verdict

The previously-blocking gap (SC2 / TENA-03: "unreachable across users... via ANY route") is
closed. All 5 ROADMAP Success Criteria for Phase 44 are now verified. No regressions found
in the adjacent tRPC adversarial suite. Score revised from 4/5 to **5/5**.

---

## Original Verification (2026-07-10T05:45:00Z) — historical record, findings preserved

**Status at time of original verification:** gaps_found
**Score at time of original verification:** 4/5 must-haves verified

### Goal Achievement

Truths below are the 5 ROADMAP Success Criteria for Phase 44 (the authoritative contract), each independently checked against the live codebase and, where possible, the live local database — not against SUMMARY.md claims.

| # | Truth (ROADMAP SC) | Status (original) | Status (re-verified) | Evidence |
|---|---|---|---|---|
| 1 | `user_id` anchored on `importers` + direct on `chat_conversations`/`chat_cost_ledger`, migrated + backfilled, live-verified locally (SC1) | ✓ VERIFIED | ✓ VERIFIED (unchanged) | Live query against the local Supabase DB: all 3 columns exist, `is_nullable='NO'`; zero `user_id IS NULL` rows across `importers`/`chat_conversations`/`chat_cost_ledger`. Migrations 0031-0033 present on disk and registered in `meta/_journal.json`. |
| 2 | Adversarial cross-tenant test suite passes as the acceptance gate — a second user cannot read/write the first user's data via ANY route/procedure, including attachments download and the knowledge-promote proxy (SC2) | ✗ FAILED | ✓ VERIFIED | Originally: 3 FastAPI endpoints (`/v1/chat/stream`, `/v1/chat/regenerate`, `/v1/chat/widget/submit`) had zero ownership enforcement. Plan 44-09 closed this — see Re-verification Findings above. |
| 3 | No route/procedure accepts client-supplied importer/user IDs for scoping; sweep + regression tests enumerate every surface (SC3) | ✓ VERIFIED (as literally scoped: sweep + tests exist) | ✓ VERIFIED | `44-SWEEP-INVENTORY.md` enumerates every surface; the "Known Gap" section is now marked CLOSED by Plan 44-09 rather than open. |
| 4 | RLS policies active on user-owned tables as defense-in-depth; enforcement-architecture decision recorded in PROJECT.md Key Decisions (SC4) | ✓ VERIFIED | ✓ VERIFIED (unchanged) | Live query against local DB: 13 tables carry an `auth.uid()`-qualified `pg_policies` row. `.planning/PROJECT.md` Key Decisions contains the app-boundary-primary/RLS-defense-in-depth entry. |
| 5 | genui exact-match cache tables (`genui_generation_events`, `ui_spec_templates`) deliberately unscoped, documented (SC5) | ✓ VERIFIED | ✓ VERIFIED (unchanged) | Both schema files carry a "Phase 44 (tenancy): this table is deliberately unscoped by `user_id`" comment; PROJECT.md documents the same decision. |

**Original score:** 4/5 truths verified
**Re-verified score:** 5/5 truths verified

### Requirements Coverage (re-checked)

| Requirement | Source Plan | Description | Status (original) | Status (re-verified) |
|---|---|---|---|---|
| TENA-01 | 44-01 | `user_id` anchored on `importers`, direct on chat tables, genui unscoped, new-table guardrail | ✓ SATISFIED | ✓ SATISFIED (unchanged) |
| TENA-02 | 44-01 | Existing data backfilled via expand→backfill→contract | ✓ SATISFIED | ✓ SATISFIED (unchanged) |
| TENA-03 | 44-02/03/05/06/07/08/09 | Every web route and tRPC procedure derives tenant scope from session; adversarial acceptance gate | ✗ BLOCKED (partial) | ✓ SATISFIED — chat SSE gap closed by Plan 44-09, independently confirmed |
| TENA-04 | 44-01/04 | RLS defense-in-depth + enforcement-architecture decision recorded before policy work | ✓ SATISFIED | ✓ SATISFIED (unchanged) |

**Orphaned requirements check:** REQUIREMENTS.md maps exactly TENA-01 through TENA-04 to Phase 44; all 4 are declared across the phase's `requirements:` PLAN frontmatter (01: TENA-01/02/04; 02/03/05/06/07/08: TENA-03; 09: TENA-03 gap closure). No orphaned requirements found.

### Everything else (artifacts, key links, spot-checks, anti-patterns, human verification)

Unchanged from the original verification below — the gap closure did not touch any of the
artifacts, migrations, RLS policies, or ownership helpers that were already verified passing
in the initial pass. Full original report follows for the record.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/db/migrations/0031-0033_*.sql` | Expand→backfill→contract `user_id` migration sequence | ✓ VERIFIED | All 3 files present; live-applied to local DB (zero-null, NOT NULL confirmed via direct query) |
| `packages/db/migrations/0034_rls_user_scoping.sql` | `auth.uid()`-based RLS ownership policies | ✓ VERIFIED | 29 `auth.uid()` references; live-applied — 13 tables carry the policy in `pg_policies` |
| `packages/db/src/ownership.ts` | Central ownership helper | ✓ VERIFIED | All 6 required exports present (`userOwnedImporterIds`, `assertImporterOwnership`, `assertEmailOwnership`, `assertComponentOwnership`, `assertConversationOwnership`, `OwnershipError`) |
| `.planning/PROJECT.md` | Enforcement-architecture decision | ✓ VERIFIED | "app-boundary" + "RLS" + superuser-connection citation present, dated before RLS migration commit |
| `apps/email-listener/app/presentation/middleware/user_context.py` | Enforcing `require_user_id` | ✓ VERIFIED | Present; `extract_user_id` unchanged |
| `apps/web/src/app/api/attachments/[id]/route.ts` | `getUser()` + `assertImporterOwnership` gate | ✓ VERIFIED | Both present in source; 401/404/200 behavior read directly and confirmed by passing tests |
| `packages/api-client/src/router/__tests__/cross-tenant-adversarial.test.ts` | tRPC/web acceptance-gate suite | ✓ VERIFIED (WIRED, passing) | 26/26 tests pass (independently re-run at original verification AND at re-verification — no regression) |
| `apps/email-listener/tests/adversarial/test_cross_tenant.py` | FastAPI acceptance-gate suite | ✓ VERIFIED | 16/16 tests pass (independently re-run) |
| `.planning/phases/44-.../44-SWEEP-INVENTORY.md` | Full route/procedure inventory | ✓ VERIFIED, and HONEST | Enumerates every surface; explicitly named the chat-SSE gap, now marked CLOSED |
| `apps/email-listener/app/domain/ports/chat_repositories.py` (added 44-09) | `owner_user_id` ownership-lookup port method | ✓ VERIFIED | Present at line 191, implemented in Supabase repo at line 43 |
| `apps/email-listener/tests/adversarial/test_chat_sse_user_scoping.py` (added 44-09) | Enforced-contract regression suite, zero xfail | ✓ VERIFIED | 10/10 passing, 0 xfail markers, old gap-locking file confirmed deleted |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `packages/db/src/schema/importers.ts` | `auth.users` | `user_id` FK | ✓ WIRED | Live-verified: FK + NOT NULL + zero nulls |
| `apps/web/src/app/api/attachments/[id]/route.ts` | `@polytoken/db/ownership` | `assertImporterOwnership` | ✓ WIRED | Read directly; ownership check runs before signed-URL mint |
| `packages/api-client/src/router/emails/*.ts` | `userOwnedImporterIds`/`assert*Ownership` | `@polytoken/db/ownership` | ✓ WIRED | `grep -c publicProcedure` = 0 across all swept emails files |
| `packages/api-client/src/router/chat/*.ts` | `assertConversationOwnership` | `@polytoken/db/ownership` | ✓ WIRED (tRPC layer only) | `grep -c publicProcedure` = 0 across all 6 chat files (except `chat.models`, correctly documented as public/non-user-owned data) |
| `apps/email-listener/app/presentation/api/v1/chat_stream.py` | `ChatConversationRepository.owner_user_id` | `assert_conversation_owned` helper, pre-stream | ✓ WIRED (was NOT_WIRED at original verification) | Confirmed by direct source read: called as the first line of both `stream_chat` and `regenerate_chat`, before `StreamingResponse` construction |
| `apps/email-listener/app/application/use_cases/confirm_action_dispatch.py` | `PromoteEdgeUseCase.execute(user_id=...)` | keyword arg | ✓ WIRED (was NOT_WIRED at original verification) | Confirmed by direct source read at the exact call site (line 102-108) |

### Behavioral Spot-Checks

All commands below were independently re-run by this verifier (not sourced from SUMMARY.md text) — original pass, still valid, plus new checks added under Re-verification Findings above.

| Behavior | Command | Result | Status |
|---|---|---|---|
| Migrations 0031-0033 applied, zero-null `user_id` on all 3 anchor tables | Live query against local Supabase DB | 3 columns, `is_nullable='NO'`; null counts `{a:0,b:0,c:0}` | ✓ PASS |
| RLS policies live on 13 user-owned tables | `pg_policies` query for `auth.uid()`-qualified policies | 13 tables returned, matches SUMMARY's claimed list exactly | ✓ PASS |
| tRPC cross-tenant adversarial suite | `npx vitest run src/router/__tests__/cross-tenant-adversarial.test.ts` | 26/26 passed (both at original verification and re-verification) | ✓ PASS |
| FastAPI adversarial + known-gap suites (original) | `uv run pytest tests/adversarial --no-cov` | 16 passed, 4 xfailed | ✓ PASS (superseded — see below) |
| FastAPI chat-SSE + presentation + application (re-verification) | `uv run pytest tests/adversarial tests/presentation tests/application --no-cov` | 269 passed, 0 xfailed, 0 failed | ✓ PASS |
| Chat SSE endpoints have no per-user auth dependency (original finding) | `grep -n "require_user_id\|dependencies=" chat_stream.py chat_widget.py` | Originally: only `require_api_key` | ✗ CONFIRMED GAP (original) → ✓ RESOLVED (re-verification: both files now import and wire `require_user_id`) |
| `confirm_action_dispatch.py` omits `user_id` from the promote call (original finding) | Direct read of `execute()` body | Originally: no `user_id` kwarg | ✗ CONFIRMED GAP (original) → ✓ RESOLVED (re-verification: `user_id=user_id` present at the call site) |
| Commit hashes cited in SUMMARYs exist in git history | `git log --oneline` spot-check | All present, in claimed order (original: bf2ffb1, 1d44929, 4ece6fc, b954f54; re-verification: a4bd0d7, 3733512 also confirmed present via `git log`) | ✓ PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes exist for this phase; none were declared in the PLAN/SUMMARY files. Skipped — no runnable probes to execute beyond the test suites already covered under Behavioral Spot-Checks.

### Anti-Patterns Found

None at original verification. None found at re-verification either — debt-marker sweep across all 8 source/test files touched by Plan 44-09 (`TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`) returned zero hits.

### Human Verification Required

None. This phase is backend/data-isolation enforcement — all claims are independently verifiable via source inspection, live database queries, and automated test execution, all of which were performed directly by this verifier (not sourced from SUMMARY.md narration) at both the original verification and this re-verification. No UI/visual/real-time/external-service behavior in this phase requires human judgment.

### Gaps Summary (resolved)

The original gap — three FastAPI chat SSE endpoints (`/v1/chat/stream`, `/v1/chat/regenerate`,
`/v1/chat/widget/submit`) enforcing zero per-user ownership on client-supplied
`conversation_id`, despite receiving a server-verified `X-User-Id` from the Next.js BFF — is
now closed. Plan 44-09 added `require_user_id` + a fail-closed, pre-stream
`assert_conversation_owned` gate (mirroring `emails.py`'s established `_assert_importer_owned`
pattern) to all three endpoints, added an `owner_user_id` ownership-lookup method to
`ChatConversationRepository`, and threaded the caller's `user_id` through
`SubmitWidgetInteraction.prepare` → `confirm_action_dispatch` → `PromoteEdgeUseCase.execute`
so the existing Plan 44-03 tenant-mismatch guard now actually runs on the chat confirm_action
path. All 4 previously-`xfail(strict=True)`-locked regressions now pass as unconditional
enforced-contract assertions (plus 6 new tests: positive controls and a dispatch-forwarding
unit test), with zero `xfail` markers remaining in the suite. The tRPC-layer adversarial
acceptance gate (attachments route, promote proxy) shows no regression. All 4 TENA
requirements and all 5 ROADMAP Success Criteria for Phase 44 are now verified against the
live codebase. Phase 44 goal — "every row of user-owned data belongs to a user and is
unreachable across users" — is achieved.

---

*Verified: 2026-07-10T06:13:03Z*
*Verifier: Claude (gsd-verifier)*
