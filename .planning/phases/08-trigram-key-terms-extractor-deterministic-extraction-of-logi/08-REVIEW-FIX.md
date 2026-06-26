---
phase: 08-trigram-key-terms-extractor
fixed_at: 2026-06-13T10:50:00Z
review_path: .planning/phases/08-trigram-key-terms-extractor-deterministic-extraction-of-logi/08-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-06-13T10:50:00Z
**Source review:** .planning/phases/08-trigram-key-terms-extractor-deterministic-extraction-of-logi/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (CR-01, WR-01, WR-02, WR-03, WR-04, IN-02)
- Fixed: 6
- Skipped: 0

---

## Fixed Issues

### CR-01: `_RE_PO` word-boundary anchor — mid-word PO match prevention

**Files modified:** `apps/email-listener/app/domain/services/key_terms.py`
**Commit:** d5238a9
**Applied fix:** Replaced the unanchored `P\.?O\.?` prefix with `\bP\.?O\.?(?!\w)`. The leading `\b` prevents mid-word matches from `EXPORT`, `DEPOSIT` (no word boundary before their embedded `P`). The trailing `(?!\w)` negative lookahead prevents matching `PORT` (next char after `PO` is `R`, a word character) while still allowing `PO-1000`, `P.O. 1000`, `PO NUMBER: 1000` (next chars are `-`, space, or separator — all non-word). Note: a trailing `\b` was initially tried but fails when the optional dot is consumed (both preceding dot and following space are `\W`, so no word-char/non-word-char transition exists); the negative lookahead is the correct solution.

Verified: `PORT-1001`, `export ORDER-9999`, `DEPOSIT 2024`, `PROOF-001` all yield `()`. Valid forms `PO NO: PO-1234`, `PO#ORDER-001`, `P.O. No: PO-5678`, `PO Number: ABC-1000`, `P.O. ABC-1234` all still extract correctly.

### WR-01: `_SEP` quadratic backtracking eliminated

**Files modified:** `apps/email-listener/app/domain/services/key_terms.py`
**Commit:** d5238a9
**Applied fix:** Replaced `r"[\s]*(?:(?:NO|NUMBER)\.?:?|#|:)?[\s]*"` (two adjacent `[\s]*` groups competing over the same whitespace) with `r"(?:\s*(?:(?:NO|NUMBER)[.:]?|[#:])\s*|\s+)?"` (single alternation: either a keyword+punct surrounded by optional spaces, OR plain whitespace). This is a linear-time design — the two alternatives are mutually exclusive so no backtracking competition. Also tightened the keyword punct class from `\.?:?` to `[.:]?` (one optional char). All 30 pre-existing label separator tests continue to pass.

### WR-02: Bare `except Exception` in `confirm_region.py` now logs with `exc_info`

**Files modified:** `apps/email-listener/app/application/use_cases/confirm_region.py`
**Commit:** b0ceb25
**Applied fix:** Added `log.warning("confirm_region_fields_text_fallback", exc_info=True)` in the first except block (satisfies CLAUDE.md "Log detailed errors server-side"). Wrapped the `json.dumps` fallback in its own `try/except` with `default=str` (prevents a second unhandled exception from non-JSON-serializable values like `datetime`) and a secondary `log.warning("confirm_region_fields_text_failed", exc_info=True)` fallback to `fields_text = ""`.

### WR-03: D-16 docstring corrected to describe upsert-promote semantics

**Files modified:** `apps/email-listener/app/application/use_cases/confirm_region.py`
**Commit:** 86cec73
**Applied fix:** Replaced the misleading "a new ExtractionRecord with status='confirmed' supersedes any candidate records" / "NEVER mutated" language in the class docstring and inline comments with accurate upsert-promote wording. The docstring now says "the most-recently-created candidate row is promoted to status='confirmed' by upsert (same primary key, updated status/fields/updated_at)" and clarifies that a prior confirmed record is never downgraded. The implementation was not changed — only the documentation was corrected to match what the code actually does.

### WR-04: Negative-label and ReDoS guard tests added

**Files modified:** `apps/email-listener/tests/test_key_terms.py`
**Commit:** 35e8a6a
**Applied fix:** Added 7 new test functions:
- `test_sep_long_whitespace_run_completes_promptly` — 500 spaces between BOOKING and `!!!` (non-identifier suffix), asserts completes in < 1 second and returns `()`. Guards against O(n²) backtracking regression.
- `test_po_does_not_match_mid_word_port` — `"PORT-1001"` must not yield spurious `"RT-1001"`.
- `test_po_does_not_match_export` — `"EXPORT ORDER-9999"` must yield `()`.
- `test_po_does_not_match_deposit` — `"deposit 2024 PORT-1001"` must not produce any `RT`-prefixed term.
- `test_po_does_not_match_proof` — `"PROOF-001"` must yield `()`.
- `test_po_label_still_extracts_valid_forms` — positive regression covering all five valid PO label forms.

All 36 key_terms tests pass.

### IN-02: Reasoning artifact removed from ISO 6346 comment block

**Files modified:** `apps/email-listener/app/domain/services/key_terms.py`
**Commit:** d5238a9
**Applied fix:** Replaced the informal revision artifact line `#   S=28 … wait — let me spell it out carefully:` with the clean header `#   Sequence spelled out:`.

---

## Skipped Issues

None — all in-scope findings were fixed.

---

## Gate Results

All gates run from `apps/email-listener/` after fixes:

| Gate | Result |
|------|--------|
| `uv run pytest --no-cov` | 359 passed, 8 skipped (integration/AWS skips) |
| `uv run pytest` (excl. integration) | 90.07% coverage — threshold 80% met |
| `uv run ruff check .` | All checks passed |
| `uv run mypy app` | No issues found in 82 source files |
| `uv run lint-imports` | 3 contracts kept, 0 broken |
| `uv run bandit -r app -q` | No issues identified |
| Integration tests | Skipped (local Supabase not running) |

---

_Fixed: 2026-06-13T10:50:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
