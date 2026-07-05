"""Interactive-widget finalization helpers for RunChatTurn (Phase 24-02, D-01/D-04).

Split out of run_chat_turn.py to stay under the CLAUDE.md 800-line file cap.
Pure functions only (no I/O, no ports) — this keeps run_chat_turn.py's own
"imports only domain ports/services" architecture contract unaffected.

Turns a finalized emit_proposal_cards tool call's accumulated JSON into the
`interactive_widget` message-part shape from 24-CONTEXT.md's <interfaces>
contract (mirrored verbatim in 24-01-PLAN.md's <interfaces> block), and
derives the `declared_response_schema` persisted alongside it on the
chat_widget_interactions row (D-01/D-10 — later submits are re-validated
against this STORED schema, never a client-supplied one).

A malformed/unusable tool call is DROPPED (returns None) rather than
persisting a non-conforming widget — mirrors emit_ui_spec's existing
parse-failure drop in run_chat_turn.py's _finalize_pending_tool (fail-closed).
"""

from __future__ import annotations

import json
import uuid
from typing import Any

PROPOSAL_CARDS_TOOL_NAME = "emit_proposal_cards"

# Tool names this module knows how to finalize into an interactive_widget part
# (D-04: at most one pending widget per turn). A later plan (24-04, clarify
# widgets) extends this tuple with its own tool name.
INTERACTIVE_WIDGET_TOOL_NAMES: tuple[str, ...] = (PROPOSAL_CARDS_TOOL_NAME,)


def build_interactive_widget_part(tool_name: str, raw_json: str) -> dict[str, Any] | None:
    """Parse a finalized interactive-widget tool call's accumulated JSON into a part.

    Returns None (dropped) when tool_name is not a recognized interactive-widget
    tool, the JSON never parses, or the parsed shape has no usable options.
    """
    if tool_name == PROPOSAL_CARDS_TOOL_NAME:
        return _build_proposal_cards_part(raw_json)
    return None


def _build_proposal_cards_part(raw_json: str) -> dict[str, Any] | None:
    try:
        raw: Any = json.loads(raw_json) if raw_json else {}
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(raw, dict):
        return None
    options = raw.get("options")
    if not isinstance(options, list) or not options:
        return None

    declared_options: list[dict[str, Any]] = []
    for index, option in enumerate(options):
        if not isinstance(option, dict):
            return None
        title = option.get("title")
        if not isinstance(title, str) or not title:
            return None
        # id is server-assigned + index-derived (D-05) — never trusts a
        # model-supplied id, so downstream option lookups are unambiguous.
        declared_option: dict[str, Any] = {"id": f"opt-{index}", "title": title, "value": option.get("value")}
        description = option.get("description")
        if isinstance(description, str):
            declared_option["description"] = description
        declared_options.append(declared_option)

    declaration: dict[str, Any] = {"options": declared_options}
    prompt = raw.get("prompt")
    if isinstance(prompt, str):
        declaration["prompt"] = prompt

    return {
        "type": "interactive_widget",
        "interactionId": str(uuid.uuid4()),
        "widgetKind": "proposal_cards",
        "declaration": declaration,
    }


def build_create_pending_kwargs(message_parts: Any) -> dict[str, Any] | None:
    """Find message.parts' interactive_widget part (if any) and build its create_pending() kwargs.

    D-04: at most one pending interactive widget per turn — the first (and
    only) interactive_widget part found is used. Returns None when no such
    part exists (the caller should not call create_pending at all). Callers
    merge in conversation_id/message_id/turn_index/sibling_group_id, which
    this pure function has no access to.
    """
    for part_index, part in enumerate(message_parts):
        if part.get("type") != "interactive_widget":
            continue
        widget_kind = part["widgetKind"]
        declaration = part["declaration"]
        return {
            "interaction_id": part["interactionId"],
            "part_index": part_index,
            "widget_kind": widget_kind,
            "declaration": declaration,
            "declared_response_schema": derive_declared_response_schema(widget_kind, declaration),
        }
    return None


def derive_declared_response_schema(widget_kind: str, declaration: dict[str, Any]) -> dict[str, Any]:
    """Derive the STORED response schema a later submit is re-validated against (D-01/D-10).

    proposal_cards: an enum-of-option-ids schema — the client can only submit
    one of the server-assigned option ids (T-24-01: the real payload is
    resolved server-side from the stored declaration, never trusted from the
    client, a later plan's SubmitWidgetInteraction concern).
    """
    if widget_kind == "proposal_cards":
        option_ids = [option["id"] for option in declaration.get("options", [])]
        return {
            "type": "object",
            "required": ["optionId"],
            "additionalProperties": False,
            "properties": {"optionId": {"enum": option_ids}},
        }
    raise ValueError(f"no declared_response_schema deriver registered for widget_kind {widget_kind!r}")


def content_block_stand_in(part: dict[str, Any]) -> dict[str, Any]:
    """Compact text stand-in for interactive_widget/interaction_result parts (history replay).

    Mirrors _provider_content_blocks' existing genui_spec stand-in (Phase
    22-07): neither shape is a valid Anthropic content block on its own, so
    replaying either verbatim (e.g. as a bare tool_use block with no paired
    tool_result) would violate the API's block-alternation contract.
    """
    part_type = part.get("type")
    if part_type == "interactive_widget":
        widget_kind = part.get("widgetKind", "widget")
        declaration_json = json.dumps(part.get("declaration", {}), ensure_ascii=False)
        return {"type": "text", "text": f"[emitted {widget_kind} interactive widget: {declaration_json}]"}
    if part_type == "interaction_result":
        widget_kind = part.get("widgetKind", "widget")
        summary_json = json.dumps(part.get("summary", {}), ensure_ascii=False)
        return {"type": "text", "text": f"[user responded to {widget_kind} widget: {summary_json}]"}
    return part


__all__ = [
    "INTERACTIVE_WIDGET_TOOL_NAMES",
    "PROPOSAL_CARDS_TOOL_NAME",
    "build_create_pending_kwargs",
    "build_interactive_widget_part",
    "content_block_stand_in",
    "derive_declared_response_schema",
]
