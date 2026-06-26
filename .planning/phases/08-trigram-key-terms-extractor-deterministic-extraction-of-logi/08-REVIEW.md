---
phase: 08-trigram-key-terms-extractor
reviewed: 2026-06-13T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - apps/email-listener/app/domain/services/key_terms.py
  - apps/email-listener/app/application/use_cases/autofill.py
  - apps/email-listener/app/application/use_cases/confirm_region.py
  - apps/email-listener/tests/test_key_terms.py
  - apps/email-listener/tests/test_integration_real_postgres.py
  - apps/email-listener/tests/test_confirm_region.py
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: fixed
---

# Phase 08: Code Review Report

**Reviewed:** 2026-06-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the Phase 08 trigram key-terms extractor (`key_terms.py`), the autofill few-shot upgrade
(`autofill.py`), the confirm-region use case (`confirm_region.py`), and all three test files.

The ISO 6346 letter-value map is correct (B=12, V=34, etc. — multiples of 11 are skipped). Check-digit
algorithm logic is sound, including the remainder=10 → digit=0 special case. Dedupe is order-stable.
`_MAX_TERMS` is applied after dedupe (correct). `_MAX_SCAN_CHARS` slices input before scanning.

One BLOCKER is found: the `_RE_PO` pattern has no word-boundary guard on its prefix, allowing it to match
any two-letter substring `P_O` (where `_` is an optional dot) that appears anywhere in running text. This
produces systematic false positives in prose. Four warnings cover an O(n²) backtracking window in `_SEP`,
a bare `except Exception` in `confirm_region.py`, the D-16 "no-overwrite" docstring contradicting
the implementation (same `id` reused for the confirmed record), and missing negative-label coverage
in the unit test suite.

---

## Critical Issues

### CR-01: `_RE_PO` has no word-boundary anchor — matches mid-word "PO" in any prose

**File:** `apps/email-listener/app/domain/services/key_terms.py:133-136`

**Issue:** The pattern `P\.?O\.?` is not anchored by `\b` on the left side. Every occurrence of the two
letters P then O (with optional dots) in any position — including mid-word — triggers a capture attempt.
For example, the phrase `"production order REPORT-2024"` contains `"po"` inside `"report"` when scanned
case-insensitively: the letter sequence `p-o` appears in `"report"` — wait, that is `r-e-p-o-r-t`. The
engine tests at every position. A concrete false positive that WILL fire:

- Input: `"Deposit 2024 PORT-1001"` — scanning case-insensitively, the substring `"po"` in `"Deposit"` is
  at chars 3-4 (`De[po]sit`). After matching `"po"`, `_SEP` consumes zero chars, then the identifier
  group tries `"sit 2024 PORT-1001"` — `"s"` + `"it"` (2 chars, < min 3). No match here. But:

- Input: `"export PORT-1001"` — the sequence `"po"` in `"export"` (`ex[po]rt`): after `"po"` the
  remaining is `"rt PORT-1001"`. `_SEP = [\s]*(?:...)?[\s]*` — first `[\s]*` matches `""`, optional
  group matches nothing, second `[\s]*` matches `""`. Then identifier: `"r"` + `"t PORT-"` — the space
  stops the match at 2 chars. No match.

- Input (confirmed false positive): `"Upon receipt BOOKING: BKG-001; PO-RATE: USD-1000"` — the string
  `"PO-RATE"` contains `P\.?O\.?` matching `"PO"`, then `_SEP` matches `"-"` (zero whitespace, then
  optional label group matches nothing, zero whitespace), then identifier: `"R"` + `"ATE"` = 4 chars —
  but `{3,30}` needs min 3, so total min is 4. `"RATE"` is only 4 total: `R` + `ATE`(3) — **exactly
  hits minimum and matches**. So `"RATE"` would be extracted as a PO number from `"PO-RATE: USD-1000"`.

  More directly: **`"PORT-1001"` itself** — without any surrounding label — would be extracted as a PO
  number because `P` + `O` is the prefix of `"PORT"`, `_SEP` = `""`, then `R` + `T-1001`(5 chars) —
  minimum 4 met. `"RT-1001"` (6 chars) → identifier captured as `"RT-1001"` from bare text `"PORT-1001"`.

The BL, BOOKING, and INVOICE patterns are all left-anchored either via `\b` or by starting with a
multi-char keyword that inherently avoids partial matches. The PO pattern is the only one missing
a word-boundary guard.

**Fix:**
```python
_RE_PO: re.Pattern[str] = re.compile(
    r"\bP\.?O\.?\b" + _SEP + r"([A-Z0-9][A-Z0-9/\-]{3,30})",
    re.IGNORECASE,
)
```

Adding `\b` after the optional trailing dot anchors the PO abbreviation to a word boundary so `"PORT"`,
`"export"`, `"deposit"` etc. no longer trigger spurious captures. Note that `P.O.` (with trailing dot)
needs special attention: `\b` after `\.?` still works because the dot is `\W`, making the boundary
condition `\W\b[A-Z]...` — in practice `\bP\.?O\.?\b` will require that the two-char `PO` token is
surrounded by non-word characters (correct).

---

## Warnings

### WR-01: `_SEP` creates an O(n²) backtracking window — ReDoS risk on whitespace runs

**File:** `apps/email-listener/app/domain/services/key_terms.py:117`

**Issue:** `_SEP = r"[\s]*(?:(?:NO|NUMBER)\.?:?|#|:)?[\s]*"` consists of two adjacent `[\s]*` groups
with an optional non-capturing group between them. When the regex engine scans a position where the label
keyword (`NO`, `NUMBER`, `#`, `:`) is absent, both `[\s]*` groups compete to consume whitespace characters,
triggering quadratic backtracking. Example: `"BOOKING          NOTHING"` (10 spaces, no valid identifier
following). The first `[\s]*` can consume 0-10 spaces; for each split, the optional group matches empty,
and the second `[\s]*` tries to consume the remaining spaces; then the identifier pattern fails; the engine
backtracks and tries the next split. This is O(n²) in the number of spaces between the label word and a
non-matching suffix.

While `_MAX_SCAN_CHARS=200_000` bounds the absolute input size, 200K consecutive spaces would generate
~40B backtracking steps — catastrophic. The `test_large_input_completes_promptly` test uses `"booking ref
1234abc "` repetitions which have short space runs, so the quadratic case is not covered by the existing
test. Real email text rarely has long space runs, but it is a latent vulnerability.

**Fix:** Collapse the two `[\s]*` groups:
```python
# Before
_SEP = r"[\s]*(?:(?:NO|NUMBER)\.?:?|#|:)?[\s]*"

# After — single \s* at each side, atomic grouping via possessive or restructuring
_SEP = r"\s*(?:(?:NO|NUMBER)[.:]?|[#:])\s*|\s+"
# Or simpler: make the whole separator one optional group that is tried once
_SEP = r"(?:\s*(?:(?:NO|NUMBER)[.:]?|[#:])\s*|\s+)?"
```

Alternatively, use a possessive quantifier (`[\s]*+`) if the Python regex library (`regex` package)
is available, or simply use `\s*` once at the front and omit the trailing `\s*` (labels are always
followed by ≥1 space or directly by the identifier).

### WR-02: Bare `except Exception` silently swallows non-trivial failures in `confirm_region.py`

**File:** `apps/email-listener/app/application/use_cases/confirm_region.py:144-145`

**Issue:**
```python
try:
    fields_text = " ".join(f"{k}:{v}" for k, v in effective_fields.items())
except Exception:
    fields_text = json.dumps(effective_fields)
```

The `except Exception` catches anything that goes wrong during the generator expression, including
`TypeError` from a non-string key or a non-serializable value (which would then also fail `json.dumps`,
raising a second, unhandled `TypeError`). The outer `except` does not log the error or re-raise. If
`json.dumps(effective_fields)` also raises (e.g., because `effective_fields` contains non-JSON-serializable
objects like `datetime` or `bytes`), the exception propagates without any context.

More concretely: if `effective_fields` contains a `bytes` value, `f"{k}:{v}"` succeeds (produces
`b'...'` repr), so the `try` branch works fine. But if a key is a non-string type, `f"{k}:{v}"` still
works (repr). The fallback `json.dumps` would fail on `datetime` keys/values without a custom encoder.

The bare `except` is also a project-conventions violation (`CLAUDE.md`: "Log detailed errors server-side").
The error is not logged.

**Fix:**
```python
try:
    fields_text = " ".join(f"{k}:{v}" for k, v in effective_fields.items())
except Exception:
    log.warning("confirm_region_fields_text_fallback", exc_info=True)
    try:
        fields_text = json.dumps(effective_fields, default=str)
    except Exception:
        log.warning("confirm_region_fields_text_failed", exc_info=True)
        fields_text = ""
```

### WR-03: D-16 "no-overwrite" docstring contradicts implementation — confirmed record reuses candidate `id`

**File:** `apps/email-listener/app/application/use_cases/confirm_region.py:110-126`

**Issue:** The docstring (and the `D-16` design decision) states:

> "D-16 (no overwrite): a prior confirmed record is NEVER mutated. Instead a new ExtractionRecord
> with status='confirmed' supersedes any candidate records."

However, line 112 constructs the confirmed record with `id=candidate.id` — the same primary key as
the candidate. `extractions.save(confirmed_record)` will UPSERT on the existing row, mutating the
`status`, `corrected_fields`, and `updated_at` of the existing database row in-place. This is not
"creating a new confirmed record" — it is mutating the candidate record.

The D-16 invariant as written (never mutate a prior confirmed value) is technically preserved because
`find_by_component_id` filters for `status == "candidate"` before promoting, and a confirmed record
is never picked up again. But the implementation is misleading: the docstring implies INSERT semantics,
the code executes UPDATE semantics. If the underlying repo's `save()` is ever changed to INSERT-only,
this will break. If an audit log depends on INSERT timestamps for confirmed records, timestamps are
also wrong (the confirmed row's `created_at` is the candidate's original `created_at`).

**Fix:** Either (a) update the docstring to accurately describe the UPSERT/UPDATE promotion pattern,
or (b) change the implementation to use a new UUID:
```python
import uuid
confirmed_record = ExtractionRecord(
    id=str(uuid.uuid4()),  # new row, not mutation of candidate
    ...
)
```
and supersede the candidate row separately.

### WR-04: `test_confirm_region.py` — no negative-label test for `_RE_PO` false positive (mirrors CR-01 gap)

**File:** `apps/email-listener/tests/test_key_terms.py` (general)
**File:** `apps/email-listener/tests/test_confirm_region.py:598-651`

**Issue:** The test suite for `key_terms.py` covers positive extraction and invalid check-digit rejection,
but does not include a test that bare text containing `PORT`, `PROOF`, `POLICY`, or `EXPORT` does NOT
produce spurious PO-number extractions. Given that CR-01 is a real false-positive bug in `_RE_PO`, the
absence of a negative-label test for the PO pattern means the bug is not caught by the test suite.

Additionally, `test_autofill_find_similar_confirmed_receives_key_terms_for_invoice_text` (line 598)
uses component text `"Acme Corp Invoice INV-001 Total: $100"`. The `INVOICE` label matches correctly,
but the test does not verify that plain prose text (no identifiers) yields `key_terms=()`, confirming
the empty case still produces `()` to the retrieval port. This gap could hide regressions if the
empty-text code path changes.

**Fix:** Add at minimum:
```python
def test_po_does_not_match_mid_word_port() -> None:
    """Bare 'PORT-1001' must NOT be extracted as a PO number (no PO label)."""
    result = _extract("Ship arrived at PORT-1001 terminal")
    assert "RT-1001" not in result  # spurious mid-word capture

def test_autofill_empty_text_key_terms_is_empty_tuple() -> None:
    """Component with plain prose text produces key_terms=() to retrieval."""
    # ... assert retrieval receives key_terms=()
```

---

## Info

### IN-01: `autofill.py` — `routing_reason` variable assigned before its use context is clear

**File:** `apps/email-listener/app/application/use_cases/autofill.py:170`

**Issue:** `routing_reason = "few_shot_autofill" if examples else "cold_start_autofill"` is computed
before `result = await self._autofiller.autofill(...)` (line 171). This is functionally correct (the
variable is used at line 187 in the `ExtractionRecord` constructor), but the placement reads as if
`routing_reason` might be used in the autofill call — it is not. Moving the assignment to just before
the `ExtractionRecord` constructor would improve readability.

**Fix:** Move the assignment to immediately before the `ExtractionRecord` construction at line 179.

### IN-02: `key_terms.py` comment block contains a self-correction artifact

**File:** `apps/email-listener/app/domain/services/key_terms.py:44`

**Issue:** Line 44 reads:
```
#   S=28 … wait — let me spell it out carefully:
```
This "wait — let me spell it out carefully" is a visible revision artifact in production code. While
harmless, it is informal and should be removed from the module docstring.

**Fix:** Delete line 44 or replace with a clean header line.

### IN-03: Integration test cleanup does not delete the seeded importer row

**File:** `apps/email-listener/tests/test_integration_real_postgres.py:243-250`

**Issue:** The `finally` block in `_run_pipeline()` cleans up extraction_records, components,
attachments, emails, and entity_types (if created here), but does NOT delete the importer row created
(or resolved) by `importer_repo.resolve(_SENDER)`. The comment on line 243 acknowledges this:
`"# Cleanup in FK order; the find-or-create importer row is left in place"`. This means repeated
test runs accumulate importer rows tied to `"it-pipeline@integration-test.example"`. Depending on
the `resolve()` implementation's find-or-create logic, this may be harmless (idempotent create) or
may leave orphan rows in the `importers` table across test runs.

**Fix:** If `resolve()` is idempotent (returns the same row for the same sender address), document
this explicitly. If it creates a new row on each run, add cleanup:
```python
# at the bottom of the finally block
client.table("importers").delete().eq("id", importer_id).execute()
```
But only if FK constraints permit it (emails FK → importers, so the email row must be deleted first).

---

_Reviewed: 2026-06-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
