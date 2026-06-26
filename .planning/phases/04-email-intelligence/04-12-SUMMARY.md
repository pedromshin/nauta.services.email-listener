---
phase: "04"
plan: "12"
subsystem: email-listener
tags: [importer-resolution, reprocess, clean-architecture, tdd]
dependency_graph:
  requires: [04-11]
  provides: [importer-resolver-port, supabase-importer-repository, reprocess-use-case, reprocess-endpoint]
  affects: [ingest-inbound-email, emails-api, container]
tech_stack:
  added: []
  patterns: [find-or-create upsert, slug-keying, supersede-before-reingest (D-16), bare-ses-id derivation]
key_files:
  created:
    - apps/email-listener/app/domain/ports/importer_resolver.py
    - apps/email-listener/app/infrastructure/supabase/importer_repository.py
    - apps/email-listener/app/application/use_cases/reprocess_email.py
    - apps/email-listener/tests/test_importer_repository.py
  modified:
    - apps/email-listener/app/application/use_cases/ingest_inbound_email.py
    - apps/email-listener/app/presentation/api/v1/emails.py
    - apps/email-listener/app/container.py
    - apps/email-listener/tests/test_ingest_use_case.py
    - apps/email-listener/tests/test_emails_api.py
decisions:
  - "slug_for_sender: lowercase → split @domain → replace dots with dashes; None if no usable domain (malformed fallback to default_importer_id, no DB row)"
  - "SES id derivation: raw_storage_key.rsplit('/', 1)[-1] — avoids double-prefix that raw_store.key_for() would introduce"
  - "Supersede (D-16) before re-ingest: ExtractionRepository.supersede_active per component, never delete/overwrite"
  - "type: ignore[call-overload] on int(ack['superseded_components']) because ack is dict[str, object]"
metrics:
  duration: "~30 min (continuation)"
  completed: "2026-06-12"
  tasks_completed: 2
  files_changed: 9
---

# Phase 04 Plan 12: Importer Resolution + Reprocess Endpoint Summary

Closes the UAT gap "Forwarding-sender maps to an importer": live ingestion now resolves `importer_id` from the forwarding-sender domain slug via `SupabaseImporterRepository` (find-or-create, idempotent under SNS redelivery) instead of hardcoding the default UUID. Adds `POST /v1/emails/{id}/reprocess` to re-trigger ingestion after superseding prior active extractions.

## Tasks

### Task 1 — ImporterResolver port + SupabaseImporterRepository (commit 1cdae90)

- `ImporterResolver` Protocol port: single `resolve(sender_address) -> str`
- `slug_for_sender()`: lowercase, split `@`, domain → replace `.` with `-`, strip non-alnum; returns `None` for malformed senders
- `SupabaseImporterRepository.resolve()`: slug=None → return default (no DB); select by slug → found → return id; else upsert on_conflict=slug → re-select → return id
- 11 unit tests covering slug normalization, case-insensitivity, None paths, idempotency, malformed fallback (no `table()` call)
- mypy, ruff, lint-imports, bandit all pass

### Task 2 — Wire resolver + ReprocessEmailUseCase + endpoint (commit 788c67d)

- `IngestInboundEmailUseCase.__init__` gains `importer_resolver: ImporterResolver`; `execute()` calls `await self._importer_resolver.resolve(parsed.sender_address)` instead of reading config directly
- `ReprocessEmailUseCase`: enumerate components → `supersede_active(component.id)` for each → derive `ses_id = email.raw_storage_key.rsplit("/", 1)[-1]` → `await self._ingest.execute(ses_id)` → return `{"email_id", "superseded_components"}`
- `POST /v1/emails/{email_id}/reprocess`: tenant-guards via `_get_tenant_email`, returns `ApiResponse[ReprocessAck]`
- Container registers `_provide_importer_resolver` (returns `SupabaseImporterRepository` bound to `ImporterResolver`) and `ReprocessEmailUseCase`
- 5 new reprocess endpoint tests (200 ack, 404 unknown, 404 cross-tenant, 401 no API key, supersede invoked)
- 3 new ingest resolver tests (resolves importer_id, keys email+attachment by resolved id, stable under redelivery)
- 189 tests total, all passing; ruff/mypy/lint-imports clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] test_resolve_creates_new_importer_for_unknown_sender: StopIteration (previous session)**
- **Found during:** Task 1 test execution
- **Issue:** Chain mock had 2 side_effect entries but implementation calls execute() 3 times (select, upsert, re-select)
- **Fix:** Added 3rd `upsert_result` mock to `chain.execute.side_effect`
- **Files modified:** tests/test_importer_repository.py
- **Commit:** 1cdae90

**2. [Rule 1 - Bug] mypy call-overload on `int(ack["superseded_components"])`**
- **Found during:** Task 2 quality gate
- **Issue:** `ack` is `dict[str, object]`; mypy infers value as `object`, not `SupportsInt`
- **Fix:** Added `# type: ignore[call-overload]` inline (pattern consistent with other `object`-typed dict values in the codebase)
- **Files modified:** app/presentation/api/v1/emails.py
- **Commit:** 788c67d

**3. [Rule 1 - Bug] test_reprocess_requires_api_key asserted 403 but middleware returns 401**
- **Found during:** Task 2 test run
- **Fix:** Updated assertion to `assert resp.status_code == 401`
- **Files modified:** tests/test_emails_api.py
- **Commit:** 788c67d

**4. [Rule 1 - Bug] Stray closing paren after ruff format in emails.py**
- **Found during:** Task 2 ruff parse pass
- **Fix:** Removed duplicate `)` on line 184
- **Files modified:** app/presentation/api/v1/emails.py
- **Commit:** 788c67d

**5. [Rule 1 - Bug] Unused imports `call`, `pytest` in test_importer_repository.py**
- **Found during:** Task 2 ruff check pass
- **Fix:** `uv run ruff check --fix` auto-removed them
- **Files modified:** tests/test_importer_repository.py
- **Commit:** 788c67d

## Known Stubs

None — importer resolver reads from and writes to the real Supabase `importers` table; reprocess re-uses the live ingest path.

## Self-Check: PASSED

- `apps/email-listener/app/domain/ports/importer_resolver.py` exists
- `apps/email-listener/app/infrastructure/supabase/importer_repository.py` exists
- `apps/email-listener/app/application/use_cases/reprocess_email.py` exists
- Commits `1cdae90` and `788c67d` exist in git log
