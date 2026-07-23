"""TDD test suite for app.domain.services.key_terms.extract_key_terms.

Covers:
- Label-anchored captures: PO, INVOICE across punctuation/spacing variants
- Canonicalization: uppercase, stripped, internal hyphens/slashes preserved
- Dedupe + order-stable: same identifier twice → one term, first-seen order
- Cap: more than ~20 distinct identifiers → at most _MAX_TERMS returned
- Empty / non-identifier text → ()
- ReDoS / large input: multi-KB near-matches complete promptly
"""

from __future__ import annotations

import time


def _extract(text: str) -> tuple[str, ...]:
    from app.domain.services.key_terms import extract_key_terms

    return extract_key_terms(text)


# ---------------------------------------------------------------------------
# PO captures
# ---------------------------------------------------------------------------


def test_po_no_label() -> None:
    """PO NO: PO-1234 — purchase order."""
    result = _extract("PO NO: PO-1234")
    assert "PO-1234" in result


def test_po_hash_label() -> None:
    """PO#ORDER-001 — hash variant."""
    result = _extract("PO#ORDER-001")
    assert "ORDER-001" in result


def test_p_dot_o_dot_label() -> None:
    """P.O. No: PO-5678 — dotted label."""
    result = _extract("P.O. No: PO-5678")
    assert "PO-5678" in result


# ---------------------------------------------------------------------------
# Invoice captures
# ---------------------------------------------------------------------------


def test_invoice_no_label() -> None:
    """INVOICE No: INV-2024-10001 — standard invoice label."""
    result = _extract("INVOICE No: INV-2024-10001")
    assert "INV-2024-10001" in result


def test_inv_hash_label() -> None:
    """INV#INV-2024-10002 — abbreviated label."""
    result = _extract("INV#INV-2024-10002")
    assert "INV-2024-10002" in result


def test_invoice_no_dot_label() -> None:
    """Invoice No. INV-NEST-0099."""
    result = _extract("Invoice No. INV-NEST-0099")
    assert "INV-NEST-0099" in result


# ---------------------------------------------------------------------------
# Canonicalization
# ---------------------------------------------------------------------------


def test_canonicalization_uppercased() -> None:
    """Lower-case label still extracts uppercased identifier."""
    result = _extract("invoice no: inv-2024-10001")
    assert "INV-2024-10001" in result


def test_canonicalization_strips_surrounding_whitespace() -> None:
    """Leading/trailing spaces around the match are stripped from the term."""
    result = _extract("PO NO:   PO-10001   rest of line")
    assert "PO-10001" in result
    assert any(t == "PO-10001" for t in result)


def test_canonicalization_internal_hyphen_preserved() -> None:
    """Hyphens inside identifiers are preserved (e.g. INV-2024-10001)."""
    result = _extract("INVOICE No: INV-2024-10001")
    # Must not strip the hyphens
    assert "INV-2024-10001" in result


# ---------------------------------------------------------------------------
# Deduplication (order-stable)
# ---------------------------------------------------------------------------


def test_dedupe_same_identifier_twice() -> None:
    """The same identifier appearing twice yields exactly one term."""
    result = _extract("PO NO: PO-10001 and again PO NO: PO-10001")
    assert result.count("PO-10001") == 1


def test_dedupe_order_stable() -> None:
    """First-seen order is preserved across multiple identifiers."""
    result = _extract("PO NO: PO-10001\nINVOICE No: INV-2024-10001")
    idx_po = result.index("PO-10001")
    idx_inv = result.index("INV-2024-10001")
    assert idx_po < idx_inv


# ---------------------------------------------------------------------------
# Cap
# ---------------------------------------------------------------------------


def test_cap_more_than_20_terms_returns_at_most_max() -> None:
    """More than ~20 distinct identifiers in one text → at most _MAX_TERMS returned."""
    from app.domain.services.key_terms import _MAX_TERMS

    lines = [f"PO NO: PO-{i:04d}" for i in range(1, 30)]
    text = "\n".join(lines)
    result = _extract(text)
    assert len(result) <= _MAX_TERMS


# ---------------------------------------------------------------------------
# Empty / non-identifier text
# ---------------------------------------------------------------------------


def test_empty_text_returns_empty_tuple() -> None:
    """Empty string → ()."""
    assert _extract("") == ()


def test_no_identifiers_returns_empty_tuple() -> None:
    """Plain prose with no business identifiers → ()."""
    result = _extract("Please confirm receipt of goods. No special instructions.")
    assert result == ()


def test_very_short_text_returns_empty_tuple() -> None:
    """Very short text → ()."""
    assert _extract("OK") == ()


# ---------------------------------------------------------------------------
# ReDoS / large input guard
# ---------------------------------------------------------------------------


def test_large_input_completes_promptly() -> None:
    """Multi-KB text of repeated near-matches must complete within 1 second."""
    # Generate a 250 KB block of repeated near-match fragments (no valid identifiers)
    chunk = "invoice ref !!! abc " * 500
    big_text = chunk * 25  # ~250 KB
    start = time.monotonic()
    result = _extract(big_text)
    elapsed = time.monotonic() - start
    # Must be fast — bounded patterns, _MAX_SCAN_CHARS slice
    assert elapsed < 1.0, f"extract_key_terms took {elapsed:.2f}s on large input"
    assert isinstance(result, tuple)


def test_sep_long_whitespace_run_completes_promptly() -> None:
    """Long whitespace run between label and non-matching suffix must not backtrack quadratically."""
    # 500 spaces between INVOICE and a non-identifier suffix (punctuation only) — the old
    # two-adjacent-[\s]* design would produce O(n²) backtracking; the current _SEP uses a
    # linear alternation.  The suffix "!!!" cannot match the identifier group [A-Z0-9]...
    long_sep = "INVOICE" + " " * 500 + "!!!"
    start = time.monotonic()
    result = _extract(long_sep)
    elapsed = time.monotonic() - start
    assert elapsed < 1.0, f"long whitespace sep took {elapsed:.2f}s — possible O(n²) backtrack"
    assert result == ()


# ---------------------------------------------------------------------------
# Negative-label tests for _RE_PO (WR-04 / CR-01 regression guard)
# ---------------------------------------------------------------------------


def test_po_does_not_match_mid_word_port() -> None:
    """Bare 'PORT-1001' must NOT be extracted as a PO number (no PO label)."""
    result = _extract("Ship arrived at PORT-1001 terminal")
    # Prior bug: P + O prefix of PORT consumed, yielding spurious "RT-1001"
    assert "RT-1001" not in result
    assert "PORT-1001" not in result


def test_po_does_not_match_export() -> None:
    """The substring 'PO' inside 'EXPORT' must not trigger a PO capture."""
    result = _extract("We will export ORDER-9999 tomorrow")
    assert "ORDER-9999" not in result
    assert result == ()


def test_po_does_not_match_deposit() -> None:
    """The substring 'PO' inside 'deposit' must not trigger a PO capture."""
    result = _extract("Please process the deposit 2024 PORT-1001")
    assert not any("RT" in t for t in result)


def test_po_does_not_match_proof() -> None:
    """'PROOF' starts with P followed by nothing useful — should yield no PO term."""
    result = _extract("Send PROOF-001 for verification")
    assert result == ()


def test_po_label_still_extracts_valid_forms() -> None:
    """Positive regression: labelled PO forms must still extract correctly after anchor fix."""
    assert "PO-1234" in _extract("PO NO: PO-1234")
    assert "ORDER-001" in _extract("PO#ORDER-001")
    assert "PO-5678" in _extract("P.O. No: PO-5678")
    assert "PO-1000" in _extract("PO Number: PO-1000")
    assert "ABC-1234" in _extract("P.O. ABC-1234")
