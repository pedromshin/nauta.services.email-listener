"""TDD test suite for app.domain.services.key_terms.extract_key_terms.

Covers:
- Container positive: valid ISO 6346 check digit → extracted
- Container negative: invalid check digit → rejected
- Label-anchored captures: BL, BOOKING, PO, INVOICE across punctuation/spacing variants
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
# Container numbers (ISO 6346, self-validating)
# ---------------------------------------------------------------------------


def test_valid_container_tcku3456783_extracted() -> None:
    """TCKU3456783 has a valid ISO 6346 check digit (digit=3) — must be returned."""
    result = _extract("Container: TCKU3456783")
    assert "TCKU3456783" in result


def test_valid_container_mscu9876541_extracted() -> None:
    """MSCU9876541 has a valid ISO 6346 check digit (digit=1) — must be returned."""
    result = _extract("MSCU9876541")
    assert "MSCU9876541" in result


def test_valid_container_tcku3001233_extracted() -> None:
    """TCKU3001233 (corpus nested-entities case, digit=3) — must be returned."""
    result = _extract("container TCKU3001233 shipped")
    assert "TCKU3001233" in result


def test_invalid_check_digit_mscu1234567_rejected() -> None:
    """MSCU1234567 as a bare container number has an invalid check digit — must NOT be extracted.

    ISO 6346 check digit algorithm applied to MSCU123456 (body):
      M=24, S=30, C=13, U=32, 1,2,3,4,5,6
      Weights: 2^0..2^9 = 1,2,4,8,16,32,64,128,256,512
      Sum = 24*1 + 30*2 + 13*4 + 32*8 + 1*16 + 2*32 + 3*64 + 4*128 + 5*256 + 6*512
          = 24 + 60 + 52 + 256 + 16 + 64 + 192 + 512 + 1280 + 3072 = 5528
      5528 mod 11 = 6 (11*502=5522, rem=6) → valid check digit is 6
      The stored digit is '7', not '6' → INVALID → bare container extraction must reject it.
      The valid version is MSCU1234566.

    Note: bare (no BL label) prevents label-anchored BL regex from capturing it.
    """
    result = _extract("Container number MSCU1234567 on the manifest")
    assert "MSCU1234567" not in result


def test_container_bare_in_dense_text() -> None:
    """Container extracted even when surrounded by other text."""
    result = _extract("Please refer to container TCKU3456783 for your shipment.")
    assert "TCKU3456783" in result


def test_known_bad_check_digit_tstu0000001_rejected() -> None:
    """Construct a known-bad check digit container and verify rejection.

    ISO 6346 check digit for TSTU000000 (body):
      T=31, S=30, T=31, U=32, 0,0,0,0,0,0
      Sum = 31*1 + 30*2 + 31*4 + 32*8 + 0..0
          = 31 + 60 + 124 + 256 = 471
      471 mod 11 = 9 (11*42=462, rem=9) → check digit should be 9
    TSTU0000009 is valid; TSTU0000001 is invalid (digit 1 ≠ 9).
    """
    result = _extract("TSTU0000001")
    assert "TSTU0000001" not in result


def test_valid_container_tstu0000009() -> None:
    """TSTU0000009 should pass check digit validation (digit=9)."""
    result = _extract("Container TSTU0000009")
    assert "TSTU0000009" in result


# ---------------------------------------------------------------------------
# Label-anchored BL captures
# ---------------------------------------------------------------------------


def test_bl_with_slash_label() -> None:
    """B/L No: MSCU2024-00551 — standard shipping label variant."""
    result = _extract("B/L No: MSCU2024-00551")
    assert "MSCU2024-00551" in result


def test_bl_with_number_sign() -> None:
    """BL#MSCU2024-00551 — hash variant."""
    result = _extract("BL#MSCU2024-00551")
    assert "MSCU2024-00551" in result


def test_bill_of_lading_full_label() -> None:
    """BILL OF LADING #MSCU2024-00551 — full-word label variant."""
    result = _extract("BILL OF LADING #MSCU2024-00551")
    assert "MSCU2024-00551" in result


def test_bl_no_dot_label() -> None:
    """B.L. No. MSCU2024-00551 — dotted label."""
    result = _extract("B.L. No. MSCU2024-00551")
    assert "MSCU2024-00551" in result


# ---------------------------------------------------------------------------
# Booking captures
# ---------------------------------------------------------------------------


def test_booking_no_label() -> None:
    """BOOKING NO: BKG-10001 — standard booking reference."""
    result = _extract("BOOKING NO: BKG-10001")
    assert "BKG-10001" in result


def test_booking_hash_label() -> None:
    """BOOKING#BKG-10002 — hash variant."""
    result = _extract("BOOKING#BKG-10002")
    assert "BKG-10002" in result


def test_booking_colon_label() -> None:
    """BOOKING: BKG-2024-00551 — colon separator."""
    result = _extract("BOOKING: BKG-2024-00551")
    assert "BKG-2024-00551" in result


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
    result = _extract("BOOKING NO:   BKG-10001   rest of line")
    assert "BKG-10001" in result
    assert any(t == "BKG-10001" for t in result)


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
    result = _extract("BOOKING NO: BKG-10001 and again BOOKING NO: BKG-10001")
    assert result.count("BKG-10001") == 1


def test_dedupe_order_stable() -> None:
    """First-seen order is preserved across multiple identifiers."""
    result = _extract("BOOKING NO: BKG-10001\nINVOICE No: INV-2024-10001")
    idx_bkg = result.index("BKG-10001")
    idx_inv = result.index("INV-2024-10001")
    assert idx_bkg < idx_inv


# ---------------------------------------------------------------------------
# Cap
# ---------------------------------------------------------------------------


def test_cap_more_than_20_terms_returns_at_most_max() -> None:
    """More than ~20 distinct identifiers in one text → at most _MAX_TERMS returned."""
    from app.domain.services.key_terms import _MAX_TERMS

    lines = [f"BOOKING NO: BKG-{i:04d}" for i in range(1, 30)]
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
    """Plain prose with no logistics identifiers → ()."""
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
    chunk = "booking ref 1234abc " * 500
    big_text = chunk * 25  # ~250 KB
    start = time.monotonic()
    result = _extract(big_text)
    elapsed = time.monotonic() - start
    # Must be fast — bounded patterns, _MAX_SCAN_CHARS slice
    assert elapsed < 1.0, f"extract_key_terms took {elapsed:.2f}s on large input"
    assert isinstance(result, tuple)


def test_sep_long_whitespace_run_completes_promptly() -> None:
    """Long whitespace run between label and non-matching suffix must not backtrack quadratically."""
    # 500 spaces between BOOKING and a non-identifier suffix (punctuation only) — the old
    # two-adjacent-[\s]* design would produce O(n²) backtracking; the new _SEP uses a
    # linear alternation.  The suffix "!!!" cannot match the identifier group [A-Z0-9]...
    long_sep = "BOOKING" + " " * 500 + "!!!"
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
