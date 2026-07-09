---
created: 2026-07-08
title: Fix 10 pre-existing failures in test_genui_retrieval_provider.py (Python 3.13 asyncio.get_event_loop removal)
area: email-listener/tests (genui retrieval provider)
resolves_phase: 46
files:
  - apps/email-listener/tests/test_genui_retrieval_provider.py
---

## Problem

Full-suite run during Phase 36 verification (v1.6) surfaced 10 failing tests, all in
`tests/test_genui_retrieval_provider.py`. Confirmed byte-identical pre/post Phase 36
(`git diff 94f7d6d..0840045`) — pre-existing, unrelated to v1.6 work. Root cause: the tests (or
the code path they exercise) rely on `asyncio.get_event_loop()` semantics removed/changed in
Python 3.13.

## Solution (proposed)

Migrate the affected tests/fixtures to `asyncio.run()` / explicit event-loop fixtures
(`pytest-asyncio` current idioms). Small, mechanical; verify the production provider itself
doesn't share the deprecated call.

## Resolution

All 11 `asyncio.get_event_loop().run_until_complete(...)` call sites (10 test methods, one with
two calls) in `test_genui_retrieval_provider.py` were swapped to `asyncio.run(...)` — a single
`replace_all` textual substitution since the substring `asyncio.get_event_loop().run_until_complete(`
was byte-identical at every call site and the wrapped coroutine expression/closing paren needed
no other change. Confirmed the production provider
(`app/infrastructure/llm/genui_retrieval_provider.py`) contains no `get_event_loop`/
`run_until_complete` calls — left untouched.

Verified: `cd apps/email-listener && uv run pytest tests/test_genui_retrieval_provider.py -v --no-cov`
→ 24 passed, the prior `DeprecationWarning: There is no current event loop` is gone (only an
unrelated `httpx`/starlette warning remains).
