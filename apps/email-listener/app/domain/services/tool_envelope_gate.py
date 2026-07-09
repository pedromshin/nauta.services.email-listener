"""validate_tool_envelope -- FOUND-6-style structural envelope gate for ToolExecutor output (Phase 38, QUAR-01).

Enforces, as a TESTED interface obligation, the quarantine promise
`app.domain.ports.tool_executor.ToolExecutor` only documents in its docstring:
every registered executor's non-error output is validated against this
structural envelope contract at ONE boundary point (`_run_server_tool_round`,
`run_chat_turn.py`) before it can ever enter the model's context or a
persisted message part. A violation never passes through raw -- the caller
replaces `result.content` with a generic, safe visible text and marks the
result `is_error=True` (mirrors `widget_result_validator.py`'s D-10
fail-closed / generic-reason / detailed-log-only shape exactly).

This function takes NO `tool_name` parameter -- the checks below are generic
across every current and future tool, deliberately not per-tool field
knowledge, so a future 4th executor is covered by default without anyone
remembering to register a schema for it.

Four checks, walked recursively through every dict/list-item at any nesting
depth:
  1. `json.loads(content)` succeeds AND the top-level value is a `dict` (a
     JSON array or scalar at top level fails).
  2. No key literally equal to one of the 4 canonical forbidden names
     (`content_text`/`body_html`/`body_text`/`raw_storage_key` -- the exact
     set already established by 36-01/36-02's own source-grep tests)
     appears anywhere in the structure.
  3. For every dict encountered during the walk that has BOTH a `"tier"` key
     and a `"label"` key: if `tier != "EXTRACTED"`, the mere PRESENCE of the
     `"label"` key (regardless of its value) is a violation -- the executor
     convention (`search_knowledge_executor.py`'s `_belt_two_label`) is to
     OMIT the key entirely for a non-EXTRACTED row, so this gate re-derives
     that same field-omission rule independently (belt 4, defense-in-depth
     against a future regression in belt 2).
  4. If the top-level object has a `"citations"` key that is a list, every
     entry must be a dict with `"kind"`/`"id"`/`"route"` keys where
     `route == <local template for kind>.format(id=entry["id"])` exactly; a
     `kind` absent from the local 3-entry map is also a violation.

Fail-closed (never raises past this boundary): a JSON-parse failure and any
other check failure each get their own FIXED generic reason string -- never
the actual forbidden field name, tier value, or citation route (mirrors
`widget_result_validator.py`'s D-10 guardrail: detail logged server-side via
`structlog.warning` only, never returned to the caller).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

# Re-declared locally from app.infrastructure.tools.envelope._ROUTE_TEMPLATES
# -- domain cannot import infrastructure (import-linter "Domain has no
# external deps" contract forbids app.domain -> app.infrastructure). Mirrors
# run_chat_turn_tool_loop.py's existing EMIT_UI_SPEC_TOOL_NAME
# local-redeclaration precedent, done for the identical reason.
_ROUTE_TEMPLATES: dict[str, str] = {
    "entity": "/entities/{id}",
    "email": "/emails/{id}",
    "knowledge": "/knowledge?focus={id}",
}

# The canonical forbidden raw-body field names, established by 36-01/36-02's
# own source-grep tests -- do not add to this set without a corresponding
# plan decision.
_FORBIDDEN_FIELD_NAMES = frozenset({"content_text", "body_html", "body_text", "raw_storage_key"})

_MALFORMED_JSON_REASON = "tool result was not valid structured data"
_FAILED_CHECK_REASON = "tool result failed an envelope safety check"


@dataclass(frozen=True)
class EnvelopeGateOutcome:
    """Immutable pass/fail verdict -- `reason` never leaks which field/rule tripped (mirrors ValidationOutcome)."""

    ok: bool
    reason: str = ""


def validate_tool_envelope(content: str) -> EnvelopeGateOutcome:
    """Validate one ToolExecutor's raw `content` string against the structural envelope contract.

    Pure, never raises past this boundary -- every branch below is
    fail-closed. Called once, at the ONE wiring point in the round loop,
    for every registered executor's non-error output.
    """
    try:
        parsed = json.loads(content)
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        logger.warning("tool_envelope_gate_rejected", check="json_parse", error_type=type(exc).__name__)
        return EnvelopeGateOutcome(ok=False, reason=_MALFORMED_JSON_REASON)

    try:
        reasons = _collect_violations(parsed)
    except Exception as exc:  # fail-closed: an unexpected walk error is also a rejection, never a crash
        logger.warning("tool_envelope_gate_rejected", check="unexpected_exception", error_type=type(exc).__name__)
        return EnvelopeGateOutcome(ok=False, reason=_FAILED_CHECK_REASON)

    if reasons:
        logger.warning("tool_envelope_gate_rejected", reasons=reasons)
        return EnvelopeGateOutcome(ok=False, reason=_FAILED_CHECK_REASON)

    return EnvelopeGateOutcome(ok=True)


def _collect_violations(parsed: object) -> list[str]:
    """Run all 4 checks against the parsed JSON value; return short internal debug strings, never leaked to the caller."""
    if not isinstance(parsed, dict):
        return ["top_level_not_object"]
    reasons: list[str] = []
    _walk(parsed, reasons)
    _check_citations(parsed, reasons)
    return reasons


def _walk(node: object, reasons: list[str]) -> None:
    """Recursively visit every dict/list-item at any depth, running the per-dict checks (2) and (3)."""
    if isinstance(node, dict):
        _check_dict_node(node, reasons)
        for value in node.values():
            _walk(value, reasons)
    elif isinstance(node, list):
        for item in node:
            _walk(item, reasons)


def _check_dict_node(node: dict[str, Any], reasons: list[str]) -> None:
    """Check (2): no forbidden field name. Check (3): tier/label field-omission (belt 4)."""
    for key in node:
        if key in _FORBIDDEN_FIELD_NAMES:
            reasons.append(f"forbidden_field:{key}")
    if "tier" in node and "label" in node and node.get("tier") != "EXTRACTED":
        # Presence of the key is the violation, regardless of its value --
        # the executor convention is to OMIT "label" entirely for a
        # non-EXTRACTED row (search_knowledge_executor.py's _belt_two_label).
        reasons.append("label_present_for_non_extracted_tier")


def _check_citations(top: dict[str, Any], reasons: list[str]) -> None:
    """Check (4): every citations[] entry's route matches its kind's canonical template."""
    citations = top.get("citations")
    if not isinstance(citations, list):
        return
    for entry in citations:
        if not isinstance(entry, dict) or not {"kind", "id", "route"} <= entry.keys():
            reasons.append("citation_entry_malformed")
            continue
        kind = entry["kind"]
        template = _ROUTE_TEMPLATES.get(kind) if isinstance(kind, str) else None
        if template is None:
            reasons.append("citation_unknown_kind")
            continue
        if entry["route"] != template.format(id=entry["id"]):
            reasons.append("citation_route_mismatch")


__all__ = ["EnvelopeGateOutcome", "validate_tool_envelope"]
