---
phase: 04-email-intelligence
plan: 10
subsystem: tests
tags: [test-isolation, settings, pydantic-settings, env-file]
depends_on: []
provides: [settings-tests-isolated-from-env]
affects: [test_settings_secrets]
tech_stack:
  added: []
  patterns: [DevSettings(_env_file=None) for .env isolation in tests]
key_files:
  modified:
    - apps/email-listener/tests/test_settings_secrets.py
decisions:
  - Use DevSettings(_env_file=None) directly in default-asserting tests instead of get_settings()
  - Patch app.infrastructure.supabase.client.get_settings with DevSettings(_env_file=None) in client fail-closed tests
metrics:
  duration: 15m
  completed: "2026-06-12"
  tasks_completed: 1
  files_modified: 1
---

# Phase 04 Plan 10: Settings Test Isolation Summary

**One-liner:** Isolated 7 settings tests from on-disk .env via `DevSettings(_env_file=None)`, eliminating environment-dependent failures on developer machines.

## What Was Done

The `test_settings_secrets.py` module had tests that called `get_settings()` after `monkeypatch.delenv(...)`, but pydantic-settings' `BaseAppSettings` has `env_file=(".env", ".env.local")` in its `model_config`. On machines with a populated `.env`, the file re-supplied those variables even after the OS env var was removed, causing 4-6 tests to fail non-deterministically.

Fix: Construct `DevSettings(_env_file=None)` directly in default-asserting tests. The `_env_file=None` per-instance override tells pydantic-settings to skip all env-file loading, so only real OS env vars and code defaults apply — making assertions deterministic regardless of `.env` presence.

### Tests fixed (5 originally in plan)

1. `test_settings_has_supabase_url_field` — now uses `DevSettings(_env_file=None)`
2. `test_settings_has_supabase_secret_key_field` — now uses `DevSettings(_env_file=None)`
3. `test_settings_has_bedrock_region_field` — now uses `DevSettings(_env_file=None)`
4. `test_settings_has_bedrock_model_id_field` — now uses `DevSettings(_env_file=None)`
5. `test_settings_bedrock_model_id_uses_default_when_unset` — now uses `DevSettings(_env_file=None)`

### Additional tests fixed (Rule 1 — pre-existing same failure mode)

6. `test_get_supabase_client_raises_when_url_missing` — patched `client.get_settings` with `DevSettings(_env_file=None)`
7. `test_get_supabase_client_raises_when_key_missing` — patched `client.get_settings` with `DevSettings(_env_file=None)`

These 2 were already failing in baseline (confirmed by stash/restore check) due to identical `.env` leak.

### Override tests (untouched)

`test_settings_supabase_url_property`, `test_settings_supabase_secret_key_property`, `test_settings_bedrock_region_override`, `test_settings_bedrock_region_falls_back_to_textract_region`, `test_settings_bedrock_model_id_override` — all use `monkeypatch.setenv` and assert those values; unaffected.

## Verification

- All 18 tests in `test_settings_secrets.py` pass with populated `.env` present
- `ruff check` and `ruff format --check` clean
- `app/settings.py` untouched — confirmed by `git diff --name-only`
- `grep -c '_env_file=None' tests/test_settings_secrets.py` → 7

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 2 additional get_supabase_client tests with identical .env leak**
- **Found during:** Task 1 verification
- **Issue:** `test_get_supabase_client_raises_when_url_missing` and `test_get_supabase_client_raises_when_key_missing` failed because `get_supabase_client()` internally calls `get_settings()` which reads the `.env`, populating the vars the test had deleted
- **Fix:** Patched `app.infrastructure.supabase.client.get_settings` with `side_effect=lambda: DevSettings(_env_file=None)` in both tests
- **Files modified:** `apps/email-listener/tests/test_settings_secrets.py`
- **Commit:** f6ede4e

## Self-Check: PASSED

- `apps/email-listener/tests/test_settings_secrets.py` exists and modified: FOUND
- Commit f6ede4e exists: FOUND
- All 18 tests green with `--no-cov`: VERIFIED
