"""Pure domain service: deterministic extraction of logistics identifiers from region text.

``extract_key_terms(text)`` returns a deduplicated, order-stable, uppercased tuple of
canonical logistics identifiers found in *text*.  No I/O, no dependencies beyond stdlib
``re`` and ``typing`` — satisfies the domain-purity constraint (lint-imports: domain has
no external deps).

Security / performance notes
----------------------------
- **ReDoS (T-08-01):** every regex uses bounded repetition only (``{m,n}`` syntax); no
  nested quantifiers; no catastrophic backtracking.  Input is sliced to ``_MAX_SCAN_CHARS``
  before scanning — documents may be megabytes, regex scanning is linear in length.
- **Output cap:** ``_MAX_TERMS`` prevents a degenerate document from producing an unbounded
  list of trigram search terms.
- **SQL injection:** terms are returned as data and passed as bound parameters downstream
  (RetrievalPort → match_components_by_trgm RPC); no string interpolation here.
"""

from __future__ import annotations

import re
from typing import Final

# ---------------------------------------------------------------------------
# Module constants
# ---------------------------------------------------------------------------

# Slice input to this length before scanning (guards against megabyte blobs).
_MAX_SCAN_CHARS: Final[int] = 200_000

# Return at most this many distinct terms.
_MAX_TERMS: Final[int] = 20

# ---------------------------------------------------------------------------
# ISO 6346 letter-to-value map
#
# Source: ISO 6346 §3.1.2 — each letter is assigned a numeric equivalent
# starting at 10 for A, incrementing by 1 and *skipping* multiples of 11
# (i.e. 11, 22, 33 …).
#
# Sequence (A→Z = values 10..38, skipping 11, 22, 33):
#   A=10, B=12, C=13, D=14, E=15, F=16, G=17, H=18, I=19,
#   J=20, K=21, L=23, M=24, N=25, O=26, P=27, Q=28, R=29,
#   Sequence spelled out:
#
#   Position  Letter  Raw  Skip 11/22/33  Assigned value
#   0         A       10   —              10
#   1         B       11   skip → 12      12
#   2         C       12→13              13
#   3         D       13→14              14
#   4         E       14→15              15
#   5         F       15→16              16
#   6         G       16→17              17
#   7         H       17→18              18
#   8         I       18→19              19
#   9         J       19→20              20
#   10        K       20→21              21
#   11        L       21→ skip 22 →23    23
#   12        M       22→24              24
#   13        N       23→25              25
#   14        O       24→26              26
#   15        P       25→27              27
#   16        Q       26→28              28
#   17        R       27→29              29
#   18        S       28→30              (skip 33 not yet reached) → 30
#   19        T       29→31              31
#   20        U       30→32              32
#   21        V       31→ skip 33 → 34   34
#   22        W       32→35              35
#   23        X       33→36              36
#   24        Y       34→37              37
#   25        Z       35→38              38
# ---------------------------------------------------------------------------
_ISO6346_LETTER_VALUES: Final[dict[str, int]] = {
    "A": 10,
    "B": 12,
    "C": 13,
    "D": 14,
    "E": 15,
    "F": 16,
    "G": 17,
    "H": 18,
    "I": 19,
    "J": 20,
    "K": 21,
    "L": 23,
    "M": 24,
    "N": 25,
    "O": 26,
    "P": 27,
    "Q": 28,
    "R": 29,
    "S": 30,
    "T": 31,
    "U": 32,
    "V": 34,
    "W": 35,
    "X": 36,
    "Y": 37,
    "Z": 38,
}

# ---------------------------------------------------------------------------
# Pre-compiled regexes (compiled once at import time)
# ---------------------------------------------------------------------------

# Container number: 3 owner letters + 1 equipment category (U/J/Z) + 6 serial + 1 check digit
# Pattern: exactly 11 uppercase alphanumeric chars matching [A-Z]{3}[UJZ]\d{7}
# We match the whole 11-char token; check-digit validation is done in code.
# Word boundaries ensure we don't match fragments.
_RE_CONTAINER: re.Pattern[str] = re.compile(r"\b([A-Z]{3}[UJZ]\d{7})\b")

# Label separator: optional whitespace then NO / NUMBER / # / : (all optional/interchangeable)
# Handles: "NO:", "NO.", "No:", "NUMBER:", "#", ":"
# Linear-time design (T-08-01): a single alternation — either a keyword+optional-punct
# surrounded by optional spaces, OR plain whitespace — prevents the two adjacent \s*
# groups from competing to consume the same whitespace characters (O(n²) backtracking).
_SEP = r"(?:\s*(?:(?:NO|NUMBER)[.:]?|[#:])\s*|\s+)?"

# BL (bill of lading) label: B/L, BL, B.L., BILL OF LADING
# Identifier group: alphanumeric + hyphens/slashes, 6-32 chars (precision over recall)
_RE_BL: re.Pattern[str] = re.compile(
    r"(?:B[/.]?L\.?|BILL\s+OF\s+LADING)" + _SEP + r"([A-Z0-9][A-Z0-9/\-]{4,30})",
    re.IGNORECASE,
)

# Booking reference: BOOKING followed by optional separator + identifier
_RE_BOOKING: re.Pattern[str] = re.compile(
    r"BOOKING" + _SEP + r"([A-Z0-9][A-Z0-9/\-]{4,30})",
    re.IGNORECASE,
)

# Purchase order: PO / P.O. followed by optional separator + identifier
# \b on the left ensures P starts a word token (prevents mid-word matches from
# "EXPORT", "DEPOSIT" where no word boundary precedes the P).
# (?!\w) negative lookahead after the optional trailing dot prevents matching
# "PORT" (next char is R, a word-char) while still allowing "PO-1000", "P.O. 1000",
# "PO NUMBER: 1000" (next chars are -, space, or separator — all non-word).
_RE_PO: re.Pattern[str] = re.compile(
    r"\bP\.?O\.?(?!\w)" + _SEP + r"([A-Z0-9][A-Z0-9/\-]{3,30})",
    re.IGNORECASE,
)

# Invoice: INVOICE / INV followed by optional separator + identifier
# \b word boundary prevents partial match (e.g. "INVOICE" split as "INV" + "OICE")
_RE_INVOICE: re.Pattern[str] = re.compile(
    r"\bINV(?:OICE)?\b" + _SEP + r"([A-Z0-9][A-Z0-9/\-]{3,30})",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Check-digit validation
# ---------------------------------------------------------------------------


def _iso6346_check_digit_valid(code: str) -> bool:
    """Return True if *code* is a valid 11-character ISO 6346 container number.

    Algorithm (ISO 6346 §3.1.2):
      1. Map each of the first 10 characters to its numeric value:
         digits map to their face value; letters use _ISO6346_LETTER_VALUES.
      2. Multiply each value by 2**i for i = 0 … 9 (position 0 = leftmost).
      3. Sum the 10 weighted values.
      4. Compute sum mod 11; if the result is 10, use 0 as the check digit.
      5. Compare to the 11th character (index 10) parsed as an integer.

    Returns False for any malformed input (wrong length, non-digit check char, etc.)
    """
    if len(code) != 11:
        return False
    body = code[:10]
    check_char = code[10]
    if not check_char.isdigit():
        return False
    check_digit = int(check_char)

    total = 0
    for i, ch in enumerate(body):
        ch_upper = ch.upper()
        if ch_upper.isdigit():
            value = int(ch_upper)
        elif ch_upper in _ISO6346_LETTER_VALUES:
            value = _ISO6346_LETTER_VALUES[ch_upper]
        else:
            return False
        total += value * (2**i)

    remainder = total % 11
    expected_digit = 0 if remainder == 10 else remainder
    return check_digit == expected_digit


# ---------------------------------------------------------------------------
# Canonicalization
# ---------------------------------------------------------------------------

# Strip stray leading/trailing punctuation (everything except alphanumeric and /-.)
_RE_STRIP_PUNCT: re.Pattern[str] = re.compile(r"^[^A-Z0-9]+|[^A-Z0-9]+$", re.IGNORECASE)


def _canonical(term: str) -> str:
    """Uppercase *term* and strip surrounding non-alphanumeric noise.

    Internal hyphens and slashes are preserved — they are structurally meaningful
    in logistics identifiers (e.g. INV-2024-10001, MSCU2024-00551).
    """
    upper = term.upper()
    return _RE_STRIP_PUNCT.sub("", upper)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def extract_key_terms(text: str) -> tuple[str, ...]:
    """Extract canonical logistics identifiers from *text*.

    Returns a deduplicated, order-stable, uppercased tuple of at most
    ``_MAX_TERMS`` terms.  Precision over recall: only identifier-bearing
    text yields results; bare prose returns ``()``.

    The input is sliced to ``_MAX_SCAN_CHARS`` before scanning to keep
    worst-case time linear and bounded on megabyte documents (T-08-01).
    """
    if not text:
        return ()

    scan_text = text[:_MAX_SCAN_CHARS]
    # Work in uppercase for case-insensitive matching on extracted groups
    scan_upper = scan_text.upper()

    terms: list[str] = []
    seen: set[str] = set()

    def _add(raw: str) -> None:
        term = _canonical(raw)
        if term and term not in seen:
            seen.add(term)
            terms.append(term)

    # 1. Container numbers (bare pattern + check-digit validation)
    for m in _RE_CONTAINER.finditer(scan_upper):
        candidate = m.group(1)
        if _iso6346_check_digit_valid(candidate):
            _add(candidate)

    # 2. BL numbers (label-anchored)
    for m in _RE_BL.finditer(scan_text):
        _add(m.group(1))

    # 3. Booking references (label-anchored)
    for m in _RE_BOOKING.finditer(scan_text):
        _add(m.group(1))

    # 4. Purchase order numbers (label-anchored)
    for m in _RE_PO.finditer(scan_text):
        _add(m.group(1))

    # 5. Invoice numbers (label-anchored)
    for m in _RE_INVOICE.finditer(scan_text):
        _add(m.group(1))

    return tuple(terms[:_MAX_TERMS])
