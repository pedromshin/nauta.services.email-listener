"""Text-layer quality detection for PDF pages.

Determines whether the extracted text from a PDF page is usable (a real text
layer) or garbage/absent (scanned/image-only page requiring OCR).
"""

from __future__ import annotations

import unicodedata

# Minimum printable character count for a page to be considered text-layer usable.
MIN_CHARS_PER_PAGE: int = 20

# Maximum ratio of non-printable characters before text is considered garbage.
GARBAGE_RATIO: float = 0.3


def _printable_ratio(text: str) -> float:
    """Return fraction of characters in *text* that are printable (visible + whitespace)."""
    if not text:
        return 0.0
    printable_count = sum(
        1 for ch in text if unicodedata.category(ch)[0] not in ("C",) or ch in ("\t", "\n", "\r", " ")
    )
    return printable_count / len(text)


def is_garbage(text: str) -> bool:
    """Return True when *text* contains too many non-printable characters."""
    if not text:
        return True
    return _printable_ratio(text) < (1.0 - GARBAGE_RATIO)


def detect_text_layer(page_text: str) -> bool:
    """Return True when *page_text* looks like a usable text layer.

    A page passes when:
    - It has at least MIN_CHARS_PER_PAGE printable characters.
    - The printable ratio is above the GARBAGE_RATIO threshold.
    """
    if not page_text:
        return False
    printable_chars = [
        ch for ch in page_text if unicodedata.category(ch)[0] not in ("C",) or ch in ("\t", "\n", "\r", " ")
    ]
    if len(printable_chars) < MIN_CHARS_PER_PAGE:
        return False
    return not is_garbage(page_text)
