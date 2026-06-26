"""Row helpers shared by Supabase repositories."""

from __future__ import annotations

from typing import Any


def parse_embedding(raw: Any) -> tuple[float, ...] | None:
    """Parse a pgvector/halfvec column value into a float tuple, or None.

    PostgREST serializes vector/halfvec columns as a STRING like "[0.1,0.2,...]"
    (not a JSON array), so iterating it directly yields characters and breaks
    float() on '['. Accept both the string form and an already-parsed list/tuple;
    return None for null/empty so callers treat unembedded rows as having no vector.
    """
    if raw is None:
        return None
    if isinstance(raw, str):
        inner = raw.strip().strip("[]").strip()
        if not inner:
            return None
        return tuple(float(v) for v in inner.split(","))
    if isinstance(raw, (list, tuple)):
        if not raw:
            return None
        return tuple(float(v) for v in raw)
    return None


def strip_nul(value: Any) -> Any:
    """Recursively remove NUL (U+0000) chars, which Postgres text/jsonb reject (22P05).

    PDF/OCR text extraction frequently yields embedded NUL bytes, and LLM output
    echoed back into jsonb columns can carry them too. Strip them from every string
    in the payload (including nested dict/list values) before persist.
    """
    if isinstance(value, str):
        return value.replace("\x00", "")
    if isinstance(value, dict):
        return {k: strip_nul(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [strip_nul(v) for v in value]
    return value
