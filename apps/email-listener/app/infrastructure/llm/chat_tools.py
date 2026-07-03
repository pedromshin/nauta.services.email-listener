"""EMIT_UI_SPEC_TOOL — the emit_ui_spec tool definition offered to genui-capable models.

Phase 22-07 (STREAM-02, D-02, D-05): a plain, provider-agnostic tool dict (name /
description / input_schema) mirroring genui_code_generator_adapter.py's hand-written
_EMIT_CODE_ISLAND_TOOL shape. Unlike that forced-tool-use path, emit_ui_spec is
OFFERED (never forced) on the chat turn -- the agent decides whether/when to call
it (D-02). Its `spec` input is passed through to the persisted genui_spec part
VERBATIM -- no server-side schema validation or fallback happens here (that gate
is the web boundary, FOUND-6).

Layering note: the chat agent (run_chat_turn.py, application layer) does NOT
import this module directly -- the "Application does not import infrastructure"
import-linter contract forbids app.application -> app.infrastructure. Instead,
RunChatTurn accepts the tool definition as a plain `dict[str, Any]` constructor
parameter, and app/container.py (the composition root, exempt from that
contract) imports EMIT_UI_SPEC_TOOL from here and wires it in. See
run_chat_turn.py / container.py for the wiring.
"""

from __future__ import annotations

from typing import Any

EMIT_UI_SPEC_TOOL_NAME = "emit_ui_spec"

EMIT_UI_SPEC_TOOL: dict[str, Any] = {
    "name": EMIT_UI_SPEC_TOOL_NAME,
    "description": (
        "Emit a declarative UI spec (a SpecRoot JSON tree) for the existing genui renderer "
        "when an interactive widget or structured visual summary would serve the user's "
        "request better than plain text. The spec is rendered through the trusted "
        "Catalog -> Spec -> Registry -> Renderer pipeline (no code execution). Only call "
        "this when a UI spec genuinely helps -- a normal conversational reply does not need it."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "spec": {
                "type": "object",
                "description": (
                    "The declarative SpecRoot JSON tree to render (the same shape as the "
                    "existing genui SpecRoot schema). Passed through verbatim -- validated "
                    "at the web boundary, not here (FOUND-6)."
                ),
            },
        },
        "required": ["spec"],
        "additionalProperties": False,
    },
}
