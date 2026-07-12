---
phase: 54-email-cluster-workflow-e3
plan: 02
subsystem: api
tags: [python, fastapi, ssrf, prompt-injection, duckduckgo, httpx, tool-executor, dishka]

# Dependency graph
requires:
  - phase: 36-38 (v1.6 Chat x Knowledge Convergence)
    provides: ToolExecutor port, envelope.py truncate_field/citation helpers, tool_envelope_gate.py structural gate, cap_tool_output, the code-gated-exposure convention (SEARCH_KNOWLEDGE_TOOL_ENABLED precedent)
provides:
  - SearchProvider port (SearchResult DTO + never-raise Protocol)
  - url_safety.py pure SSRF guard (is_public_https_url, is_public_ip, SsrfRejected) -- stdlib-only, no DNS
  - DuckDuckGoSearchProvider -- keyless html.duckduckgo.com/html/ adapter, stdlib HTMLParser scrape, no new dependency
  - WebSearchExecutor -- the 4th real ToolExecutor: search -> double SSRF guard (pre-DNS + post-DNS/DNS-rebinding-safe) -> bounded streaming fetch -> HTML-to-text strip -> quarantine envelope
  - 10-fixture web-search adversarial injection suite (packages/genui/src/eval/web-search-injection-fixtures.json + tests/evals/test_web_search_injection_suite.py)
  - web_search wired into container.py, code-gated behind WEB_SEARCH_TOOL_ENABLED, flipped to True in this run (suite passed)
affects: [55, "Phase 54 Plan 03+ (cluster context / source-capture)", "any future phase reaching the open internet"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SSRF guard applied TWICE: pure pre-DNS literal-IP/scheme check in the domain layer (url_safety.py), then a post-DNS re-check in the infrastructure adapter requiring EVERY socket.getaddrinfo-resolved address to be public (DNS-rebinding defense)"
    - "Whole-envelope running-size budget (_ENVELOPE_BUDGET_CHARS) that stops appending results before cap_tool_output's own whole-string slice could ever cut mid-JSON -- generalizes the per-field truncate_field convention to the multi-result, multi-truncated-field case"
    - "Code-gated dark-then-flip exposure (WEB_SEARCH_TOOL_ENABLED) mirroring SEARCH_KNOWLEDGE_TOOL_ENABLED exactly: conditional ** unpacking into BOTH tool_executors and server_tool_defs, flipped to True in the same run only after the adversarial suite passed"

key-files:
  created:
    - apps/email-listener/app/domain/ports/search_provider.py
    - apps/email-listener/app/domain/services/url_safety.py
    - apps/email-listener/app/infrastructure/tools/duckduckgo_search_provider.py
    - apps/email-listener/app/infrastructure/tools/web_search_executor.py
    - packages/genui/src/eval/web-search-injection-fixtures.json
    - apps/email-listener/tests/evals/test_web_search_injection_suite.py
  modified:
    - apps/email-listener/app/settings.py
    - apps/email-listener/app/container.py
    - apps/email-listener/tests/test_container.py
    - apps/email-listener/tests/infrastructure/tools/test_tool_envelope_contract.py
    - apps/email-listener/tests/application/test_run_chat_turn_real_tools_wiring.py

key-decisions:
  - "Omitted a model-settable `limit` property from the web_search tool schema -- top-N (5) is a hardcoded server constant, never model-authored, mirroring search_knowledge's expand-mode depth/budget precedent (T-37-10); resolves an internal inconsistency between the plan's <interfaces> paraphrase and its own <action> text, which explicitly required 'NEVER read from model arguments'"
  - "Added a running envelope-size budget (found live via a real network smoke test): web_search truncates TWO free-text fields per result (title + a real fetched-page snippet) vs the other 3 executors' ONE, so a naive whole-envelope cap_tool_output slice can cut mid-JSON at 5 realistic results -- the executor now stops adding results once the next one would exceed a safety-margined budget, guaranteeing valid JSON regardless of fetched content size"
  - "DNS-rebinding defense: the post-DNS SSRF re-check requires ALL socket.getaddrinfo-resolved addresses for a hostname to be public, not just one -- a hostname resolving to a mix of public and private addresses is rejected outright"

requirements-completed: [CLUS-03]

# Metrics
duration: 35min
completed: 2026-07-12
---

# Phase 54 Plan 02: web_search ToolExecutor Summary

**Keyless, SSRF-guarded, quarantine-enveloped `web_search` ToolExecutor (DuckDuckGo HTML scrape via stdlib HTMLParser, double pre/post-DNS SSRF guard, 10-fixture adversarial injection suite) wired dark-then-enabled behind `WEB_SEARCH_TOOL_ENABLED`.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-12T06:50:00-03:00 (approx, first read/context step)
- **Completed:** 2026-07-12T07:27:36-03:00
- **Tasks:** 3/3 completed
- **Files modified:** 14 (9 created, 5 modified)

## Accomplishments
- `SearchProvider` port + pure, stdlib-only `url_safety.py` SSRF guard (`is_public_https_url`, `is_public_ip`, `SsrfRejected`) — 43 test cases covering scheme/host/userinfo/loopback/private/link-local/CGNAT, all pre-DNS, zero network I/O in the domain layer.
- `DuckDuckGoSearchProvider`: scrapes the real `html.duckduckgo.com/html/` keyless endpoint with a stdlib `html.parser.HTMLParser` subclass (no new dependency), unwraps the `//duckduckgo.com/l/?uddg=...` redirect wrapper to the real target URL, degrades to `[]` on any network/parse error. Verified against the LIVE endpoint once (permitted this run) — correctly parsed 5 real results including the redirect unwrap.
- `WebSearchExecutor`: search → SSRF-guard (applied twice: pre-DNS literal-IP/scheme check, then post-DNS re-check requiring every `socket.getaddrinfo`-resolved address to be public — DNS-rebinding-safe) → bounded streaming fetch (`fetch_page_via_httpx`, `_MAX_FETCH_BYTES` cap) → stdlib HTML-to-text stripper → `truncate_field` per result field → JSON quarantine envelope → `cap_tool_output`. Never raises past `execute()`. Verified end-to-end against the live network once (real search + real fetches + real envelope-gate pass).
- 10-fixture adversarial injection suite (`packages/genui/src/eval/web-search-injection-fixtures.json`, 5 categories x 2) proves every fixture's `[CANARY:...]` payload stays confined to the `snippet` string field — never elevates to a new structural key, never appears as a `citations` entry, and the envelope still passes `validate_tool_envelope`.
- `web_search` wired into `container.py`'s `_provide_run_chat_turn`, code-gated behind `WEB_SEARCH_TOOL_ENABLED` (dark by default in principle, flipped to `True` in this same run because the adversarial suite passed) — mirrors `search_knowledge`'s exposure-gate discipline exactly, reusing the existing shared `httpx.AsyncClient` singleton for both the search step and the fetch step.

## Task Commits

Each task followed the RED -> GREEN TDD cycle and was committed atomically:

1. **Task 1: SearchProvider port + pure SSRF guard** — `7e517dc` (feat; test+source combined in one commit — see Deviations)
2. **Task 2: DuckDuckGoSearchProvider + WebSearchExecutor** — `450a605` (test, RED) → `d39d58c` (feat, GREEN)
3. **Task 3: Adversarial fixtures + suite, code-gated exposure** — `6e9c76d` (test, RED for container wiring) → `839b3eb` (feat, GREEN — flag flipped True)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `apps/email-listener/app/domain/ports/search_provider.py` — `SearchResult` DTO + `SearchProvider` Protocol (never-raise obligation)
- `apps/email-listener/app/domain/services/url_safety.py` — pure SSRF guard, stdlib-only, no DNS
- `apps/email-listener/app/domain/services/__tests__/test_url_safety.py` — 43 test cases
- `apps/email-listener/app/infrastructure/tools/duckduckgo_search_provider.py` — keyless DDG HTML adapter
- `apps/email-listener/app/infrastructure/tools/web_search_executor.py` — the 4th real ToolExecutor
- `apps/email-listener/tests/infrastructure/tools/test_web_search_executor.py` — 15 tests incl. a multi-result envelope-budget regression
- `apps/email-listener/tests/infrastructure/tools/test_duckduckgo_search_provider.py` — 6 tests against real DDG markup
- `packages/genui/src/eval/web-search-injection-fixtures.json` — 10 fetched-page injection fixtures
- `apps/email-listener/tests/evals/test_web_search_injection_suite.py` — adversarial suite proving structural inertness
- `apps/email-listener/app/settings.py` — `WEB_SEARCH_TOOL_ENABLED` flag
- `apps/email-listener/app/container.py` — web_search DI wiring, code-gated
- `apps/email-listener/tests/test_container.py` — `TestWebSearchExposureGate` (3 tests, mirrors `TestSearchKnowledgeExposureGate`)
- `apps/email-listener/tests/infrastructure/tools/test_tool_envelope_contract.py` — updated "exactly 3" -> "exactly 4" real executors
- `apps/email-listener/tests/application/test_run_chat_turn_real_tools_wiring.py` — added `WEB_SEARCH_TOOL_ENABLED=false` to keep its Phase-36-scoped assertion stable

## Decisions Made
- **No model-settable `limit` in the tool schema.** The plan's own `<interfaces>` paraphrase said "optional limit" but its `<action>` text explicitly required top-N to be "hardcoded ~5, NEVER read from model arguments." Resolved the internal inconsistency by following the stricter, safety-driven instruction and the codebase's own `search_knowledge` expand-mode precedent (T-37-10: the schema doesn't even declare the property).
- **Running envelope-size budget, not a fixed field-length compromise.** Rather than shrinking `truncate_field`'s bound or reducing top-N to a value that fits a worst-case calculation, the executor tracks the ACTUAL serialized size as it appends results and stops before the whole-envelope cap could ever bisect a JSON string. This adapts gracefully to real content (5 results fit when snippets are short; fewer fit when they're near the 300-char cap) instead of arbitrarily capping either dimension.
- **Post-DNS SSRF check requires ALL resolved addresses to be public**, not just one — closes the classic DNS-rebinding gap where a hostname could resolve to a public address on first lookup and a private one on a subsequent connect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Whole-envelope `cap_tool_output` slice could cut mid-JSON on realistic multi-result output**
- **Found during:** Task 2, discovered via the one live network smoke test the overnight-mode instructions permitted (real DuckDuckGo search + real page fetches through the real `WebSearchExecutor`)
- **Issue:** `web_search` truncates TWO free-text fields per result (title + a real fetched-page snippet) unlike the other 3 executors' ONE bounded field. At `_TOP_N=5` with realistic fetched-page content, the serialized envelope regularly exceeded `MAX_TOOL_OUTPUT_CHARS` (2000), and `cap_tool_output`'s naive `text[:limit] + marker` slice truncated mid-JSON-string, producing invalid JSON that would fail `validate_tool_envelope`'s parse step for nearly every non-trivial round — defeating the tool's purpose.
- **Fix:** Added `_ENVELOPE_BUDGET_CHARS` (1900, a safety margin under the 2000 cap) and a running-size tracker in `_execute_search`: each candidate result's serialized size is added to a running total, and the loop stops appending BEFORE the budget would be exceeded. Verified live: a real 5-result search now returns 4 valid results (the 5th genuinely wouldn't fit) with a passing envelope gate.
- **Files modified:** `apps/email-listener/app/infrastructure/tools/web_search_executor.py`
- **Verification:** New regression test `test_five_realistic_near_max_length_results_still_serialize_to_valid_gate_passing_json` (5 near-max-length mocked results, asserts `json.loads` succeeds and `validate_tool_envelope` passes); re-confirmed live against the real network after the fix.
- **Committed in:** `d39d58c` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] Two pre-existing regression tests hardcoded "exactly N tool executors"**
- **Found during:** Task 3, full-suite regression run after wiring `web_search` into `container.py`
- **Issue:** `test_tool_envelope_contract.py::test_container_resolves_exactly_the_three_real_tool_executors` and `test_run_chat_turn_real_tools_wiring.py::test_container_wires_both_real_tool_executors` both asserted an exact `_tool_executors.keys()` set that predates `web_search` — adding the 4th executor (enabled by default) broke both.
- **Fix:** Renamed/updated the first test to assert the correct 4-executor set (`test_container_resolves_exactly_the_four_real_tool_executors`, includes `WEB_SEARCH_TOOL_NAME`, explicitly enables both `SEARCH_KNOWLEDGE_TOOL_ENABLED` and `WEB_SEARCH_TOOL_ENABLED`). The second test's stated scope is Phase-36-only (`lookup_entity`+`search_emails`), so it now explicitly forces `WEB_SEARCH_TOOL_ENABLED=false` alongside its existing `SEARCH_KNOWLEDGE_TOOL_ENABLED=false`, keeping its assertion's meaning stable regardless of either flag's default.
- **Files modified:** `apps/email-listener/tests/infrastructure/tools/test_tool_envelope_contract.py`, `apps/email-listener/tests/application/test_run_chat_turn_real_tools_wiring.py`
- **Verification:** Full repo `pytest` (no `-m` filter) green, 0 failures, 6 environment-gated skips (Docker/AWS/live-Supabase credentials, expected and unrelated to this plan).
- **Committed in:** `839b3eb` (Task 3 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs found via live verification and full-suite regression, no scope creep)
**Impact on plan:** Both fixes were necessary for correctness. The envelope-budget fix is the more consequential one — without it, `web_search` would have produced invalid JSON (and thus a fallback error text, not real search results) on almost every real-world multi-result round.

### Process note (not a deviation, documented for honesty)
Task 1 combined its test file and source files into a single `feat` commit (`7e517dc`) rather than a strict separate RED-then-GREEN pair — the test file was written and verified failing (RED, `ModuleNotFoundError`) before the source was added, but both were staged together in one commit rather than two. Tasks 2 and 3 followed the strict RED → GREEN commit split. No functional impact; noted for TDD-gate-compliance transparency.

## Issues Encountered
- **Repo-wide coverage gate (`--cov-fail-under=80`) fails locally tonight (66.65%)** — this is a pre-existing environmental condition, NOT caused by this plan: Docker/WSL is down this session (consistent with 54-01's own documented state), so every Supabase-adapter/integration-reliant file across the WHOLE repo (e.g. `entity_type_repository.py` 33%, `anticipatory_judge_adapter.py` 32%, `genui_retheme_adapter.py` 33% — none touched by this plan) has its live-path branches uncovered. The plan's own `<verification>` section specifies a TARGETED pytest command (not a repo-wide coverage gate), which is fully green. This plan's own new files are well-covered in isolation (`duckduckgo_search_provider.py` 94%, `web_search_executor.py` 81%), satisfying the acceptance criterion "new code coverage pushes the repo number up, never down." Full `pytest` (no `-m` filter, no `-k`) shows 0 failures and only the expected credential-gated skips.

## User Setup Required
None — no external service configuration required. `WEB_SEARCH_TOOL_ENABLED` is already `True` by default; no API key exists or is needed (DuckDuckGo's keyless HTML endpoint requires none).

## Next Phase Readiness
- `web_search` is live and enabled, ready for the next Phase 54 plan(s) to reference it (cluster context injection, source-capture into INFERRED knowledge nodes per PROJECT.md's Band 3 description).
- The live network smoke test (real DuckDuckGo search + real page fetches) already proved the end-to-end pipeline works against the real internet, not just mocks — the plan's own `<verification>` section deferred a FULL live-Bedrock round to "morning §H"; that remains the one outstanding live-model verification (mocked Bedrock was used implicitly by not invoking any LLM in this plan's tests at all — no LLM call was needed since ToolExecutor tests operate below that layer).
- No blockers for CLUS-03 downstream consumers.

---
*Phase: 54-email-cluster-workflow-e3*
*Completed: 2026-07-12*

## Self-Check: PASSED

All 14 claimed files verified present on disk; all 5 claimed commit hashes
(`7e517dc`, `450a605`, `d39d58c`, `6e9c76d`, `839b3eb`) verified present in
`git log --oneline --all`.
