"""Shared citation/truncation envelope helpers for real ToolExecutors (Phase 36).

Pure, stdlib-only -- no domain/application imports needed (infrastructure MAY
import either, per the import-linter contract, but this module has no need
to). Both `LookupEntityExecutor` (36-01) and `SearchEmailsExecutor` (36-02)
build their result envelopes with these helpers so citation routes are
constructed in exactly ONE place, server-side, never model-echoed
(36-CONTEXT.md: "Citations must be constructed server-side from result ids
-- never model-echoed").
"""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass
from typing import Literal

CitationKind = Literal["entity", "email"]

# Fork 5's per-result-field truncation convention (36-CONTEXT.md) -- distinct
# from `cap_tool_output`'s whole-envelope MAX_TOOL_OUTPUT_CHARS (2000) cap.
MAX_RESULT_FIELD_CHARS = 300

_ROUTE_TEMPLATES: dict[str, str] = {
    "entity": "/entities/{id}",
    "email": "/emails/{id}",
}


@dataclass(frozen=True)
class ToolCitation:
    """One server-built citation entry: `{kind, id, route}`."""

    kind: str
    id: str
    route: str


def build_citation(kind: CitationKind, entity_or_email_id: str) -> ToolCitation:
    """Build a `ToolCitation` from a result id -- the ONLY place a citation route is constructed.

    Callers never hand-build `/entities/...`/`/emails/...` strings themselves.
    """
    route = _ROUTE_TEMPLATES[kind].format(id=entity_or_email_id)
    return ToolCitation(kind=kind, id=entity_or_email_id, route=route)


def citation_to_dict(citation: ToolCitation) -> dict[str, str]:
    """Convert a `ToolCitation` to a plain dict, ready for `json.dumps`."""
    return dataclasses.asdict(citation)


def truncate_field(text: str, limit: int = MAX_RESULT_FIELD_CHARS) -> str:
    """Truncate `text` to `limit` chars, appending a visible truncation marker when cut.

    Same visible-marker convention `cap_tool_output` (run_chat_turn_tool_loop.py)
    already uses, kept independent since domain purity/layering does not
    require sharing the literal -- this module has zero dependency on that one.
    """
    if len(text) <= limit:
        return text
    return text[:limit] + "…[truncated]"


__all__ = [
    "MAX_RESULT_FIELD_CHARS",
    "CitationKind",
    "ToolCitation",
    "build_citation",
    "citation_to_dict",
    "truncate_field",
]
