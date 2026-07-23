"""Pure domain service: deterministic extraction of business identifiers from region text.

``extract_key_terms(text)`` returns a deduplicated, order-stable, uppercased tuple of
canonical business identifiers (purchase-order and invoice numbers) found in *text*.
No I/O, no dependencies beyond stdlib ``re`` and ``typing`` — satisfies the
domain-purity constraint (lint-imports: domain has no external deps).

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
# Pre-compiled regexes (compiled once at import time)
# ---------------------------------------------------------------------------

# Label separator: optional whitespace then NO / NUMBER / # / : (all optional/interchangeable)
# Handles: "NO:", "NO.", "No:", "NUMBER:", "#", ":"
# Linear-time design (T-08-01): a single alternation — either a keyword+optional-punct
# surrounded by optional spaces, OR plain whitespace — prevents the two adjacent \s*
# groups from competing to consume the same whitespace characters (O(n²) backtracking).
_SEP = r"(?:\s*(?:(?:NO|NUMBER)[.:]?|[#:])\s*|\s+)?"

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
# Canonicalization
# ---------------------------------------------------------------------------

# Strip stray leading/trailing punctuation (everything except alphanumeric and /-.)
_RE_STRIP_PUNCT: re.Pattern[str] = re.compile(r"^[^A-Z0-9]+|[^A-Z0-9]+$", re.IGNORECASE)


def _canonical(term: str) -> str:
    """Uppercase *term* and strip surrounding non-alphanumeric noise.

    Internal hyphens and slashes are preserved — they are structurally meaningful
    in business identifiers (e.g. INV-2024-10001, PO-2024-00551).
    """
    upper = term.upper()
    return _RE_STRIP_PUNCT.sub("", upper)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def extract_key_terms(text: str) -> tuple[str, ...]:
    """Extract canonical business identifiers from *text*.

    Returns a deduplicated, order-stable, uppercased tuple of at most
    ``_MAX_TERMS`` terms.  Precision over recall: only identifier-bearing
    text yields results; bare prose returns ``()``.

    The input is sliced to ``_MAX_SCAN_CHARS`` before scanning to keep
    worst-case time linear and bounded on megabyte documents (T-08-01).
    """
    if not text:
        return ()

    scan_text = text[:_MAX_SCAN_CHARS]

    terms: list[str] = []
    seen: set[str] = set()

    def _add(raw: str) -> None:
        term = _canonical(raw)
        if term and term not in seen:
            seen.add(term)
            terms.append(term)

    # 1. Purchase order numbers (label-anchored)
    for m in _RE_PO.finditer(scan_text):
        _add(m.group(1))

    # 2. Invoice numbers (label-anchored)
    for m in _RE_INVOICE.finditer(scan_text):
        _add(m.group(1))

    return tuple(terms[:_MAX_TERMS])
