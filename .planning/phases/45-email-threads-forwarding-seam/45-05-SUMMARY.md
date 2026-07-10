---
phase: 45-email-threads-forwarding-seam
plan: 05
subsystem: email-ingestion
tags: [forwarding, importer-resolver, dishka, ingest, supabase, python, tenancy]

# Dependency graph
requires:
  - phase: 45-email-threads-forwarding-seam
    plan: 01
    provides: "forwarding_addresses table (UNIQUE token, UNIQUE user_id), u-{token}@{domain} seam contract"
  - phase: 45-email-threads-forwarding-seam
    plan: 03
    provides: "IngestInboundEmailUseCase post-ThreadResolver shape + container.py DI patterns to extend"
  - phase: 45-email-threads-forwarding-seam
    plan: 06
    provides: "getOrCreateMyAddress token generation — the exact u-{token}@{domain} contract this plan's token_from_recipient parses"
  - phase: 44-tenancy-user-id-scoping-enforced-isolation
    provides: "importers.user_id NOT NULL — the latent gap this plan's None-token fallback closes"
provides:
  - "ForwardingAddressResolver domain port (app/domain/ports/forwarding_address_resolver.py) — recipient token -> user_id | None, fail-closed"
  - "SupabaseForwardingAddressRepository + token_from_recipient helper — exact/case-sensitive u-{token} extraction"
  - "ImporterResolver.resolve(sender_address, *, user_id=None) — additive keyword-only extension anchoring new importers to a forwarding user"
  - "SNS recipients threaded through IngestInboundEmailUseCase.execute() into the forwarding resolver"
  - "container.py DI wiring: _provide_forwarding_address_resolver bound to ForwardingAddressResolver, threaded into the ingest use-case factory"
affects: [45-04, THRD-04-closure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Best-effort domain port failure isolation extended a second time: _resolve_forwarding_user mirrors _resolve_thread's try/except -> log warning -> return None shape, called BEFORE importer resolution rather than after it (order matters — the resolved user_id feeds into resolve())"
    - "Additive keyword-only optional param on an existing Protocol method (ImporterResolver.resolve(*, user_id=None)) — mirrors PromoteEdgeUseCase's optional-user_id pattern from 44-03; every pre-existing .resolve(addr) call site keeps compiling unchanged"
    - "Fail-closed token extraction that deliberately does NOT lowercase the token itself (only strips whitespace/angle brackets and checks the exact 'u-' prefix) — the web half's CSPRNG base64url tokens (45-06) are case-sensitive, so any lowercasing would silently break resolution for tokens containing uppercase characters"

key-files:
  created:
    - apps/email-listener/app/domain/ports/forwarding_address_resolver.py
    - apps/email-listener/app/infrastructure/supabase/forwarding_address_repository.py
    - apps/email-listener/tests/infrastructure/supabase/test_forwarding_address_repository.py
    - apps/email-listener/tests/application/test_ingest_forwarding_resolution.py
  modified:
    - apps/email-listener/app/domain/ports/importer_resolver.py
    - apps/email-listener/app/infrastructure/supabase/importer_repository.py
    - apps/email-listener/app/application/use_cases/ingest_inbound_email.py
    - apps/email-listener/app/presentation/api/v1/sns_inbound.py
    - apps/email-listener/app/container.py
    - apps/email-listener/tests/test_ingest_use_case.py
    - apps/email-listener/tests/application/test_ingest_thread_resolution.py
    - apps/email-listener/tests/corpus/forwarding_harness.py
    - apps/email-listener/tests/test_inbound_sns.py
    - apps/email-listener/tests/test_importer_repository.py

key-decisions:
  - "token_from_recipient never lowercases the extracted token (only the 'u-' prefix match and whitespace/angle-bracket stripping are performed) — the plan's action text described a 'lowercases/strips' helper mirroring slug_for_sender, but the plan's own <behavior> spec explicitly requires exact/case-sensitive token matching and an exact-match test; the web half's CSPRNG base64url tokens are case-sensitive, so the behavior spec is authoritative and was followed over the action text's flavor wording"
  - "SupabaseImporterRepository.resolve's None-user_id + new-domain path now falls back to default_importer_id instead of inserting a user_id-less row — a deliberate behavior CHANGE from the pre-Phase-45 implementation (which violated the Phase-44 NOT NULL constraint on a genuinely new domain, a latent gap since Phase 44). The existing test asserting the old create-without-user_id behavior was split into two tests: one proving the new user_id-anchored create path, one proving the new None-user_id fallback path — this is a corrective test update (Rule 1), not a weakened assertion"
  - "requirements.mark-complete run for THRD-04 (this plan's own frontmatter requirement) — both halves now exist: 45-06 (token generation + runbook, already shipped) and this plan (token resolution + ingest anchoring + Gmail-verification-mail-not-dropped, test-proven). Live SES catch-all routing stays user-gated per 45-06's own runbook (terraform apply not run autonomously) — consistent with the milestone's own 'live forwarding config user-runbook'd' scope and the precedent set by Phase 43 (Auth) being marked Complete with live-OAuth UAT deferred to a user runbook"

patterns-established:
  - "Pre-ingest best-effort resolver ordering: forwarding_resolver -> importer_resolver -> thread_resolver — each new best-effort collaborator is resolved and isolated (try/except -> None) at the point its output is needed by the NEXT step, not bundled into a single top-level guard"

requirements-completed: [THRD-04]

# Metrics
duration: ~45min
completed: 2026-07-10
---

# Phase 45 Plan 05: Forwarding Seam (FastAPI Half) Summary

**`ForwardingAddressResolver` port + Supabase adapter resolving `u-{token}@{domain}` recipients to their owning user_id at ingest time, threaded through `sns_inbound.py` and `IngestInboundEmailUseCase` to anchor newly-created importers to the resolved user and close the latent Phase-44 `importers.user_id NOT NULL` gap — with a test-proven guarantee that Gmail's forwarding-verification email is ingested, not dropped.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-10T08:10:00Z (approx.)
- **Completed:** 2026-07-10T08:55:22Z
- **Tasks:** 3 completed
- **Files modified:** 14 (4 created, 10 modified)

## Accomplishments

- `ForwardingAddressResolver` Protocol (`resolve_recipients(recipients) -> user_id | None`) — fail-closed by contract: an unknown/malformed token never discloses or invents a user.
- `SupabaseForwardingAddressRepository` + `token_from_recipient(address) -> token | None`: exact/case-sensitive `u-` prefix + token extraction (tolerant of whitespace/angle brackets), never lowercases the token itself (CSPRNG base64url tokens from 45-06 are case-sensitive). For a list of recipients, the first `u-`-prefixed recipient whose token matches a `forwarding_addresses` row wins; non-`u-` recipients are skipped with zero DB calls; an unknown token contributes nothing and resolution continues to the next recipient.
- `ImporterResolver.resolve` gains an additive keyword-only `user_id: str | None = None` param (mirrors `PromoteEdgeUseCase`'s optional-user_id pattern from 44-03). `SupabaseImporterRepository.resolve`: when creating a genuinely new importer with a resolved `user_id`, the upsert payload now includes it; when `user_id` is `None` and no existing row matches, the resolver falls back to `default_importer_id` **without** inserting a row — closing the latent Phase-44 gap where a brand-new sender domain with no token would have violated `importers.user_id NOT NULL`.
- `IngestInboundEmailUseCase.execute` gains a `recipients: Sequence[str] = ()` param and a `forwarding_resolver: ForwardingAddressResolver` collaborator. `_resolve_forwarding_user` (best-effort, mirrors `_resolve_thread`'s isolation) runs BEFORE importer resolution; its output feeds `importer_resolver.resolve(sender_address, user_id=forwarding_user_id)`. A resolver exception degrades to `None` with a logged warning — ingestion never hard-fails on forwarding resolution (T-45-05-03).
- `sns_inbound.py` threads `meta["recipients"]` (the SES envelope destination list) into `use_case.execute(...)`.
- `container.py`: `_provide_forwarding_address_resolver` binds `SupabaseForwardingAddressRepository` to the port and is threaded into `_provide_ingest_use_case`, alongside the existing `importer_resolver`/`thread_resolver` bindings.
- 21 new tests (15 repository + 6 ingest-wiring) prove: token match / non-prefix / unknown-token / first-match-wins / near-miss / malformed (repository); new-domain importer anchored to the resolved user; existing importer reused unchanged regardless of a resolving token; None-token new-domain fallback with no crash; **the Gmail forwarding-verification email (`forwarding-noreply@google.com` -> `u-{token}@`) is saved via `email_repo.save`, never dropped**; resolver-exception isolation (ingest still completes, `email_repo.save` still called).
- Full suite re-run clean: **1319 passed / 9 skipped** (baseline 1297/9 + 22 new tests: 21 new + 1 split from an existing test), zero regressions.

## Task Commits

Each task was committed atomically:

1. **Task 1: ForwardingAddressResolver port + Supabase adapter** - `f4f35f5` (feat)
2. **Task 2: Anchor importer creation to the forwarding user + thread recipients through ingest** - `600162d` (feat)
3. **Task 3: Regression guard — full suite + existing ingest/importer tests updated** - `8198101` (test)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `apps/email-listener/app/domain/ports/forwarding_address_resolver.py` - `ForwardingAddressResolver` Protocol
- `apps/email-listener/app/infrastructure/supabase/forwarding_address_repository.py` - `SupabaseForwardingAddressRepository` + `token_from_recipient` helper
- `apps/email-listener/app/domain/ports/importer_resolver.py` - `resolve()` gains keyword-only optional `user_id`
- `apps/email-listener/app/infrastructure/supabase/importer_repository.py` - user_id-anchored create path; None-user_id + new-domain fallback (no NOT-NULL violation)
- `apps/email-listener/app/application/use_cases/ingest_inbound_email.py` - `recipients` param, `forwarding_resolver` collaborator, `_resolve_forwarding_user` best-effort helper
- `apps/email-listener/app/presentation/api/v1/sns_inbound.py` - threads `meta["recipients"]` into `execute()`
- `apps/email-listener/app/container.py` - `_provide_forwarding_address_resolver` binding + ingest factory wiring
- `apps/email-listener/tests/infrastructure/supabase/test_forwarding_address_repository.py` - 15 tests
- `apps/email-listener/tests/application/test_ingest_forwarding_resolution.py` - 6 tests
- `apps/email-listener/tests/test_ingest_use_case.py` - `_make_use_case` gets a default `forwarding_resolver` mock; one assertion updated for the additive `user_id` kwarg
- `apps/email-listener/tests/application/test_ingest_thread_resolution.py` - `_make_use_case` gets a default `forwarding_resolver` mock
- `apps/email-listener/tests/corpus/forwarding_harness.py` - `FixedImporterResolver.resolve` accepts `user_id`; `NullForwardingAddressResolver` fake added and wired in
- `apps/email-listener/tests/test_inbound_sns.py` - `execute()` assertion updated to include `recipients=`
- `apps/email-listener/tests/test_importer_repository.py` - split the old create-without-user_id test into the user_id-anchored create test + the None-user_id fallback test

## Decisions Made

See key-decisions in frontmatter. Summary: (1) `token_from_recipient` preserves token case exactly per the plan's `<behavior>` spec (not the action text's "lowercases" flavor wording, which was written to mirror `slug_for_sender` but doesn't apply to case-sensitive CSPRNG tokens); (2) the None-user_id + new-domain importer path is an intentional behavior CHANGE (falls back to default instead of violating NOT NULL) — the one existing test that asserted the old behavior was split into two tests proving both new branches, not silently weakened; (3) `requirements.mark-complete` run for THRD-04 — both halves (45-05 resolution + 45-06 generation/runbook) are now genuinely done per the requirement text, live SES routing staying user-gated per the milestone's own scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing test `test_resolve_creates_new_importer_for_unknown_sender` asserted the now-intentionally-changed None-user_id create behavior**
- **Found during:** Task 3, full-suite regression sweep
- **Issue:** The plan's Task 2 action explicitly mandates that `SupabaseImporterRepository.resolve` fall back to `default_importer_id` (no row created) when `user_id` is `None` and the sender's domain has no existing importer — this closes the latent Phase-44 `importers.user_id NOT NULL` gap. The pre-existing test asserted the OLD behavior (upsert a `{slug, name}` row with no `user_id`, which — against a real Phase-44-migrated DB — would have violated the NOT NULL constraint).
- **Fix:** Split the test into `test_resolve_creates_new_importer_anchored_to_user_id_for_unknown_sender` (proves the upsert payload includes `user_id` when provided) and `test_resolve_unknown_sender_no_user_id_falls_back_to_default_no_row_created` (proves no upsert occurs and the default id is returned when `user_id` is `None`). No assertion was weakened — the new tests assert MORE precisely than the old single test did.
- **Files modified:** `apps/email-listener/tests/test_importer_repository.py`
- **Verification:** `uv run pytest tests/test_importer_repository.py --no-cov` — all passing
- **Committed in:** `8198101` (Task 3 commit)

**2. [Rule 1 - Bug] Downstream `IngestInboundEmailUseCase(...)` construction sites broke on the new required `forwarding_resolver` collaborator**
- **Found during:** Task 3, full-suite regression sweep (mirrors the exact class of break 45-03 hit for `thread_resolver`)
- **Issue:** `tests/test_ingest_use_case.py`, `tests/application/test_ingest_thread_resolution.py`, and `tests/corpus/forwarding_harness.py` all construct `IngestInboundEmailUseCase` directly (bypassing `container.py`). Adding `forwarding_resolver: ForwardingAddressResolver` as a required (no-default) keyword-only constructor param raised `TypeError: missing required keyword-only argument 'forwarding_resolver'` at every one of these call sites.
- **Fix:** Added a default `forwarding_resolver` mock to `_make_use_case` in both `test_ingest_use_case.py` and `test_ingest_thread_resolution.py`; added a `NullForwardingAddressResolver` fake to `forwarding_harness.py` (mirrors the existing `NullThreadResolver`) and wired it into the harness's direct construction call. Also updated `sns_inbound.py`'s own test (`test_inbound_sns.py`) and one `test_ingest_use_case.py` assertion for the additive `recipients=`/`user_id=` kwargs now present on the actual calls.
- **Files modified:** `apps/email-listener/tests/test_ingest_use_case.py`, `apps/email-listener/tests/application/test_ingest_thread_resolution.py`, `apps/email-listener/tests/corpus/forwarding_harness.py`, `apps/email-listener/tests/test_inbound_sns.py`
- **Verification:** `uv run pytest --no-cov` (full suite) — 1319 passed / 9 skipped, zero failures
- **Committed in:** `8198101` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bug/test-correctness fixes required by the plan's own intentional, explicitly-specified behavior and signature changes)
**Impact on plan:** Both fixes were anticipated by the plan's own Task 3 description ("Update any existing test whose ImporterResolver mock or ingest constructor call broke"). No scope creep — every touched test file is one this plan's own signature/behavior changes broke, fixed to precisely match the new (backward-compatible) contract.

## Issues Encountered

- **Pre-existing mypy debt in 8 unrelated files (25 errors), confirmed untouched by this plan (`git diff --stat` empty for all 8).** `uv run mypy app` (the exact CI command) reports these against `genui_generator_adapter.py`, `genui_code_generator_adapter.py`, `supabase_ui_spec_template_repository.py`, `supabase_chat_widget_interaction_repository.py`, and 4 chat-related `__tests__` files — none of which this plan created or modified. Out of scope per the deviation rules' scope boundary; not fixed. All 6 files this plan touched under `app/` are individually mypy-clean (`Success: no issues found in 2 source files` for the port+adapter; zero new errors introduced by the other 4 touched files when checked as part of the full `mypy app` run).

## User Setup Required

None - no external service configuration required by this plan. The SES catch-all receipt rule (drafted in `FORWARDING-RUNBOOK.md` by Plan 45-06) remains the only outstanding user-gated step for the seam to be live-routable — unchanged by this plan, already tracked in `45-USER-SETUP.md`.

## Next Phase Readiness

- THRD-04 (forwarding seam: token generation + resolution + runbook) is now fully code-complete across both halves (45-06 web + 45-05 FastAPI) — marked `Complete` in REQUIREMENTS.md.
- The Gmail destination-verification handshake documented in `FORWARDING-RUNBOOK.md` is now test-proven end-to-end at the code level: a token-resolving recipient anchors a new `google-com` importer under the resolved user, and the verification email is stored (not dropped), so the confirmation code is readable once the user's inbox surfaces it.
- Live routability (the SES catch-all rule) stays the one remaining user-gated step — documented, not blocking this milestone's autonomous scope.
- No blockers for Plan 45-04 (THRD-03, thread-grouped inbox UI) — this plan's changes are entirely within the ingest/forwarding seam, zero overlap with inbox UI files.

## Self-Check: PASSED

- Created files verified on disk: `app/domain/ports/forwarding_address_resolver.py`, `app/infrastructure/supabase/forwarding_address_repository.py`, `tests/infrastructure/supabase/test_forwarding_address_repository.py`, `tests/application/test_ingest_forwarding_resolution.py` — all FOUND
- Commits verified in `git log --oneline`: `f4f35f5`, `600162d`, `8198101` — all FOUND
- Re-ran plan-level `<verification>`:
  - `uv run pytest tests/infrastructure/supabase/test_forwarding_address_repository.py tests/application/test_ingest_forwarding_resolution.py --no-cov` — 21/21 passed
  - `uv run pytest --no-cov` (full suite) — 1319 passed / 9 skipped (baseline 1297/9 + 22 new)
  - `uv run mypy app` / `uv run ruff check` / `uv run ruff format --check` / `uv run lint-imports` — all clean on every file this plan touched (pre-existing unrelated debt confirmed via `git diff --stat`, documented above, not introduced by this plan)
  - A `u-{token}@` recipient with a seeded (mocked) `forwarding_addresses` row anchors a new importer to the row's `user_id` — proven by `test_resolving_token_anchors_new_importer_to_resolved_user`
- Acceptance criteria re-verified for all 3 tasks: port + adapter + helper exist with match/non-prefix/unknown/first-match/malformed coverage; `ImporterResolver.resolve` accepts optional keyword-only `user_id` with the None-token new-domain fallback verified; `sns_inbound.py` threads recipients; `container.py` binds the forwarding resolver; full suite green with zero regressions and no weakened assertions (`git diff` shows only additive call-site adaptations plus the one intentionally-split test)

---
*Phase: 45-email-threads-forwarding-seam*
*Completed: 2026-07-10*
