"""build_emit_ui_spec_tool — the emit_ui_spec tool offered to genui-capable chat models.

Phase 22-07 (STREAM-02, D-02, D-05), corrected after live testing (2026-07-04):
the tool's input IS the SpecRoot document itself, constrained by the real
Bedrock-valid SpecRoot JSON schema from the genui artifacts (the same schema
the studio's forced-tool generator uses). The original hand-written
`{"spec": {"type": "object"}}` wrapper gave the model ZERO grammar (every
emission was invented and rejected by the strict web-boundary safeParse) and
persisted the wrapper object as the spec — so genui-in-chat ALWAYS fell back.

Unlike the studio's forced-tool-use path, emit_ui_spec is OFFERED (never
forced) on the chat turn — the agent decides whether/when to call it (D-02).
The accumulated tool JSON is persisted as the genui_spec part VERBATIM — no
server-side schema validation or fallback happens here (that gate is the web
boundary, FOUND-6); the input_schema exists to make the model emit something
that will actually survive that gate.

Layering note: the chat agent (run_chat_turn.py, application layer) does NOT
import this module directly — the "Application does not import infrastructure"
import-linter contract forbids app.application -> app.infrastructure. Instead,
RunChatTurn accepts the tool definition as a plain `dict[str, Any]` constructor
parameter, and app/container.py (the composition root, exempt from that
contract) calls build_emit_ui_spec_tool() and wires it in.
"""

from __future__ import annotations

from typing import Any

from app.infrastructure.llm.genui_artifacts import load_spec_schema

EMIT_UI_SPEC_TOOL_NAME = "emit_ui_spec"

_DESCRIPTION = (
    "Emit a declarative UI spec (a SpecRoot JSON document) for the trusted genui renderer "
    "when an interactive widget or structured visual summary would serve the user's request "
    "better than plain text (dashboards, comparisons, forms, structured data). The input MUST "
    "strictly conform to this tool's JSON schema — only the registered component types and "
    "their declared props render; anything else is rejected and shown as an error to the user. "
    "The spec renders through the Catalog -> Spec -> Registry -> Renderer pipeline (no code "
    "execution). Only call this when a UI genuinely helps — a normal conversational reply "
    "does not need it. You may interleave prose before/after the tool call."
)


def build_emit_ui_spec_tool() -> dict[str, Any]:
    """Build the emit_ui_spec tool dict with the real SpecRoot schema as input_schema.

    The schema comes from the committed genui artifacts via load_spec_schema()
    (root `type: object`, no root $ref — Bedrock-valid; the loader asserts this).
    Loaded once at composition time (container.py), not per turn.
    """
    return {
        "name": EMIT_UI_SPEC_TOOL_NAME,
        "description": _DESCRIPTION,
        "input_schema": load_spec_schema(),
    }
