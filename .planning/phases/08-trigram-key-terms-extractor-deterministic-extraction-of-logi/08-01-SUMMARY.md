---
phase: "08-trigram-key-terms-extractor-deterministic-extraction-of-logi"
plan: "01"
subsystem: "email-listener (Python)"
tags: ["domain-service", "key-terms", "trgm", "iso6346", "confirm-fallback", "tdd"]

dependency_graph:
  requires:
    - "04-08 retrieval RPCs (match_components_by_trgm RPC + GIN index live since migration 0009)"
    - "04-08 RetrievalPort.find_similar_confirmed interface (key_terms param already in signature)"
  provides:
    - "extract_key_terms(text) pure domain service — activates the dormant trgm RRF arm"
    - "AutofillUseCase passes real key_terms into retrieval instead of hardcoded ()"
    - "ConfirmRegionUseCase confirm-fallback no longer writes entity_type_id='' FK violation"
  affects:
    - "Hybrid RRF retrieval quality — identifier-bearing regions now get trgm signal"
    - "Production stability — confirm-fallback no longer crashes on NOT NULL FK"

tech_stack:
  added:
    - "stdlib re — ISO 6346 check-digit validation, bounded regexes"
  patterns:
    - "TDD (RED commit before GREEN commit)"
    - "Clean Architecture domain purity enforced by lint-imports contract"
    - "Domain service: stdlib-only, no infrastructure imports"
    - "ReDoS mitigation: bounded repetition {m,n}, _MAX_SCAN_CHARS slice, _MAX_TERMS cap"
    - "Immutable extraction: extract_key_terms returns a new tuple every call"

key_files:
  created:
    - "apps/email-listener/app/domain/services/key_terms.py"
    - "apps/email-listener/tests/test_key_terms.py"
  modified:
    - "apps/email-listener/app/application/use_cases/autofill.py"
    - "apps/email-listener/app/application/use_cases/confirm_region.py"
    - "apps/email-listener/tests/test_autofill_use_case.py"
    - "apps/email-listener/tests/test_confirm_region.py"
    - "apps/email-listener/tests/test_integration_real_postgres.py"

decisions:
  - "ISO 6346 check-digit letter map: A=10, B=12 (skipping 11, 22, 33 per standard); Wikipedia example CSQU3054187 appears to have a typo (algorithm gives 8, not 7); algorithm verified correct via MSCU1234566 and TCNU1234565"
  - "Precision over recall: bare container regex validates check digit; label-anchored patterns accept any alphanumeric identifier (no check-digit required for BL/PO/booking/invoice refs)"
  - "ReDoS mitigation (T-08-01): _MAX_SCAN_CHARS=200_000 slice before scanning; bounded repetition {m,n} only; no nested quantifiers; _MAX_TERMS=20 output cap"
  - "D-15 flywheel preserved in confirm-fallback: embedding + update_embedding always run regardless of whether an ExtractionRecord is saved"
  - "Confirm-fallback fix: skip save + log warning confirm_region_no_candidate_record_skipped when no candidate and no prior confirmed record — avoids entity_type_id='' NOT NULL FK violation"

metrics:
  duration: "~45m (continued from prior session)"
  completed_date: "2026-06-13"
  task_count: 3
  file_count: 7
  test_coverage: "90.27%"
---

# Phase 08 Plan 01: trgm key_terms extractor + confirm-fallback FK fix Summary

**One-liner:** Pure stdlib domain service `extract_key_terms` with ISO 6346 check-digit validation activates the dormant pg_trgm RRF arm; confirm-fallback FK violation fixed by skip-and-warn with D-15 flywheel preserved.

## What Was Built

### Task 1 (TDD): `extract_key_terms` pure domain extractor

Created `app/domain/services/key_terms.py` (stdlib `re` + `typing.Final` only — domain purity enforced by lint-imports).

Key implementation details:
- `_iso6346_check_digit_valid(code: str) -> bool`: implements the ISO 6346 11-char validation with the per-spec letter-value map (A=10, B=12, C=13...Z=38, skipping multiples of 11), weighted sum (value * 2**i for i=0..9), mod 11, with 10 mapped to 0.
- Pre-compiled module-level regexes for: bare container `[A-Z]{3}[UJZ]\d{7}` (check-digit validated), BL `(?:B[/.]?L\.?|BILL\s+OF\s+LADING)`, BOOKING, PO `(?:P\.?O\.?)`, INVOICE `\bINV(?:OICE)?\b`.
- `_SEP` pattern handles `NO.`, `No:`, `NUMBER`, `#`, `:` separators between labels and identifiers.
- `_MAX_SCAN_CHARS = 200_000`: input is sliced before scanning to prevent megabyte PDFs from causing timing issues.
- `_MAX_TERMS = 20`: output cap for precision.
- Dedupe order-stable via `dict.fromkeys`.

Created `tests/test_key_terms.py` (30 tests): valid containers, invalid check-digit rejection, BL/BOOKING/PO/INVOICE label variants, canonicalization, dedup, cap, empty input, and ReDoS large-input guard.

TDD commits:
- RED: `17e548c` — `test(08-01): add failing tests for extract_key_terms domain service`
- GREEN: `d12a3ef` — `feat(08-01): implement extract_key_terms pure domain service with ISO 6346 validation`

### Task 2: Wire into AutofillUseCase + fix ConfirmRegionUseCase fallback

`autofill.py`: replaced `key_terms=()` with `key_terms=extract_key_terms(region_text)` at the `find_similar_confirmed` call site. `region_text = component.content_text or ""` was already computed immediately above the call.

`confirm_region.py`: the `else` branch (no candidate, not already confirmed) no longer constructs `ExtractionRecord(entity_type_id="")`. Instead it emits `log.warning("confirm_region_no_candidate_record_skipped")` and falls through. The embedding block (embed + update_embedding) runs unconditionally after the if/else for all paths — D-15 flywheel is never skipped. Removed now-unused `import uuid`.

Extended `test_autofill_use_case.py` and `test_confirm_region.py` with:
- `test_autofill_find_similar_confirmed_receives_key_terms_for_invoice_text`: asserts non-empty key_terms tuple (containing `"INV-001"`) is passed to retrieval for invoice-bearing text.
- `test_confirm_fallback_no_candidate_skips_save_but_embeds`: asserts `extractions.save` NOT called, `embedder.embed` called once, `components.update_embedding` called with the embedding.
- Updated `test_confirm_region_derives_importer_from_component_when_omitted`: fixed to use a candidate record so the promotion path (not the fallback path) exercises the `extractions.save` assertion.

Commit: `eca4358` — `feat(08-01): wire extract_key_terms into AutofillUseCase; fix confirm-fallback FK bug`

### Task 3: Real-Postgres integration test + quality gates

Added `_run_confirm_fallback()` + `test_confirm_fallback_no_save_embedding_persisted()` to `tests/test_integration_real_postgres.py`. The test:
1. Resolves importer via `importer_repo.resolve(_SENDER)`.
2. Seeds an Email + region Component with no ExtractionRecord.
3. Runs `ConfirmRegionUseCase.execute` with real `SupabaseComponentRepository` + `SupabaseExtractionRepository` and a `_FakeEmbedder` returning a fixed 1536-dim tuple (avoids Bedrock dependency).
4. Asserts `extraction_records` has no row for the component ID.
5. Asserts the component's `embedding` column is non-null.
6. Cleans up in FK order (email_components, emails).

The test is gated by `pytestmark` skipif (`INTEGRATION_SUPABASE_URL` + `INTEGRATION_SUPABASE_SERVICE_KEY` must be set).

Commit: `f277891` — `feat(08-01): add confirm-fallback integration test + fix ruff EN DASH`

## Quality Gates

| Gate | Result |
|------|--------|
| `pytest --cov=app` | 90.27% (threshold: 80%) — 315 tests passed |
| `ruff check app` | All checks passed |
| `mypy app` | Success: no issues found in 82 source files |
| `lint-imports` | 3/3 contracts kept (domain purity, app not infra, infra not presentation) |
| `bandit -r app` | No issues identified |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corpus ground_truth.json container numbers have invalid ISO 6346 check digits**
- **Found during:** Task 1 (RED phase — tests failing for wrong reason)
- **Issue:** TCKU3456789, MSCU9876543, TCKU3001234 from the plan's corpus-realistic identifiers do not have valid ISO 6346 check digits. Tests using these numbers would fail the bare-container extraction (check-digit validation rejects them).
- **Fix:** Computed valid check digits for each body: TCKU345678→3 (TCKU3456783), MSCU987654→1 (MSCU9876541), TCKU300123→3 (TCKU3001233). Updated tests to use computed-correct numbers.
- **Files modified:** `tests/test_key_terms.py`

**2. [Rule 1 - Bug] TSTU0000001 assumed valid but computed check digit is 9**
- **Found during:** Task 1 verification
- **Issue:** T=31, S=30, T=31, U=32; sum=471; 471 mod 11=9 → valid check digit is 9, not 1. Test expecting TSTU0000009 was correct; added explicit rejection test for TSTU0000001.
- **Fix:** Added `test_known_bad_check_digit_tstu0000001_rejected` and `test_valid_container_tstu0000009`.
- **Files modified:** `tests/test_key_terms.py`

**3. [Rule 1 - Bug] MSCU1234567 rejection test was testing the wrong code path**
- **Found during:** Task 1 (RED phase investigation)
- **Issue:** Original context "Bill of lading MSCU1234567 on the manifest" triggered the BL label-anchored regex, which captures any alphanumeric identifier without check-digit validation. The number was being returned (for wrong reason). Changed context to "Container number MSCU1234567 on the manifest" to test the bare container path where check-digit validation applies.
- **Fix:** Updated test context string.
- **Files modified:** `tests/test_key_terms.py`

**4. [Rule 1 - Bug] `_SEP` regex didn't match `No:`**
- **Found during:** Task 1 implementation
- **Issue:** Pattern `r"[\s]*(?:NO\.?|#|:)?[\s]*"` matched `NO.` or `NO` optionally followed by `:` or `#`, but `No:` (case-sensitive after IGNORECASE flag) — actually the issue was the group ordering: `NO\.?` matches `NO` then optional `.`, but `No:` has the colon after `NO` with no dot.
- **Fix:** Updated to `r"[\s]*(?:(?:NO|NUMBER)\.?:?|#|:)?[\s]*"` which also adds `NUMBER` variant.
- **Files modified:** `app/domain/services/key_terms.py`

**5. [Rule 1 - Bug] BL regex `B\.?/?L\.?` didn't reliably match `B/L`**
- **Found during:** Task 1 test failures
- **Issue:** `B\.?/?L\.?` (dot optional, slash optional, dot optional) allows ambiguous matching; `B/L` needs the slash to be in a character class with the dot.
- **Fix:** Changed to `B[/.]?L\.?` using character class for the separator.
- **Files modified:** `app/domain/services/key_terms.py`

**6. [Rule 1 - Bug] Invoice regex `INV(?:OICE)?` could partially match inside words**
- **Found during:** Task 1 implementation
- **Issue:** Without a word boundary, `INV` inside `INVOICE` could match, leaving `OICE` in the subsequent identifier capture group.
- **Fix:** Added `\b` word boundaries: `\bINV(?:OICE)?\b`.
- **Files modified:** `app/domain/services/key_terms.py`

**7. [Rule 1 - Bug] `test_confirm_region_derives_importer_from_component_when_omitted` would fail after FK fix**
- **Found during:** Task 2 (running existing test suite after fix)
- **Issue:** The test passed `find_by_component_id.return_value = []` then asserted `extractions.save.call_args[0][0].importer_id == component.importer_id`. After the FK fix, `save` is NOT called when no candidate exists and no prior confirmed record. The assertion would fail with `save.call_args is None`.
- **Fix:** Updated the test to provide a candidate extraction record so the candidate-promotion path runs (which does call save), keeping the importer_id assertion valid.
- **Files modified:** `tests/test_confirm_region.py`

**8. [Rule 1 - Bug] Ruff RUF003 EN DASH in comment**
- **Found during:** Task 3 quality gate (ruff check app)
- **Issue:** Comment in key_terms.py used an EN DASH (–) instead of a hyphen-minus (-).
- **Fix:** Replaced EN DASH with hyphen in the comment string.
- **Commit:** `f277891`

## Known Stubs

None — all three deliverables are fully wired:
- `extract_key_terms` returns real identifiers (not hardcoded ())
- AutofillUseCase passes real key_terms into retrieval
- ConfirmRegionUseCase fallback correctly skips save + embeds

## Threat Flags

No new threat surface introduced beyond what was already in the plan's threat model. T-08-01 (ReDoS) is mitigated by `_MAX_SCAN_CHARS` + bounded regexes. T-08-02 (injection) is non-issue: terms flow as bound parameters to the already-parameterized trgm RPC.

## Self-Check: PASSED

- `apps/email-listener/app/domain/services/key_terms.py` — exists, verified
- `apps/email-listener/tests/test_key_terms.py` — exists, verified
- Commits `17e548c`, `d12a3ef`, `eca4358`, `f277891` — all present in git log
- Coverage 90.27% >= 80% threshold — verified
- All 5 quality gates green — verified
