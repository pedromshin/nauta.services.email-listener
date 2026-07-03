"""ChatProvider port — provider-agnostic streamed chat abstraction (D-04..D-07, D-22).

One port, many transports. Two real adapters exist today (BedrockChatAdapter,
Anthropic via AWS Bedrock IAM; OpenRouterChatAdapter, OpenAI-compatible SSE
over a single OPENROUTER_API_KEY). A future self-hosted / run-it-yourself
OpenAI-compatible endpoint (D-07 — the sovereign/distributed-inference seam)
is designed to slot in as a THIRD implementation of this exact port, with no
per-provider leak here and no change to callers.

Streaming contract every implementation must honor:
  - Yield TextDelta / ToolCallDelta as content arrives.
  - Yield exactly one UsageDelta carrying REAL captured input/output token
    counts (D-22 — the known gap where only quarantine tokens were recorded
    is fixed by this contract applying uniformly to every adapter).
  - Yield a terminal StreamEnd last, always — including on error. Adapters
    must never let an exception escape this boundary; provider/network
    failures surface as StreamEnd(stop_reason='error') instead.

ToolResultDelta is modeled now (not emitted by either Phase 22 adapter) so the
delta union never needs to change when the tool-call/tool-result round-trip
(Phase 24, D-02's emit_ui_spec extended to widget interactions) lands.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class TextDelta:
    """A chunk of streamed assistant text."""

    text: str


@dataclass(frozen=True)
class ToolCallDelta:
    """A chunk of a streamed tool-call's partial JSON input (e.g. emit_ui_spec, D-02).

    tool_name / id are carried on every chunk (not just the first) so callers
    never need to correlate against an earlier "start" event to know which
    tool a given partial_json fragment belongs to.
    """

    tool_name: str
    id: str
    partial_json: str


@dataclass(frozen=True)
class ToolResultDelta:
    """A tool execution result fed back into the conversation.

    Reserved for the Phase 24 widget round-trip seam (D-02) — no Phase 22
    adapter emits this today, but the union carries it so downstream callers
    (chat agent, persistence) can pattern-match on the full ChatDelta shape
    from day one without a breaking change later.
    """

    tool_use_id: str
    content: str
    is_error: bool = False


@dataclass(frozen=True)
class UsageDelta:
    """Real input/output token usage for the turn (D-22 — never dropped)."""

    input_tokens: int
    output_tokens: int


@dataclass(frozen=True)
class StreamEnd:
    """Terminal event closing a stream. Always the last delta yielded."""

    stop_reason: str


ChatDelta = TextDelta | ToolCallDelta | ToolResultDelta | UsageDelta | StreamEnd


class ChatProvider(Protocol):
    """Provider-agnostic streamed chat transport (D-04..D-07).

    Implementations: BedrockChatAdapter (server, Anthropic/Bedrock, IAM auth),
    OpenRouterChatAdapter (server, OpenAI-compatible SSE, OPENROUTER_API_KEY).
    A future self-hosted OpenAI-compatible adapter is the intended third
    implementation (D-07) — it must be addable without changing this Protocol.
    """

    def stream(
        self,
        *,
        model_id: str,
        system: str | list[dict[str, Any]],
        messages: Sequence[dict[str, Any]],
        tools: Sequence[dict[str, Any]] = (),
        max_tokens: int,
        temperature: float = 1.0,
    ) -> AsyncIterator[ChatDelta]:
        """Stream chat deltas for one turn.

        Args:
            model_id: Curated registry model id (chat_model_registry.CHAT_MODEL_REGISTRY).
            system: System prompt — either a plain string or a list of Anthropic-style
                content blocks (allows cache_control on static prefixes, D-21 idiom).
            messages: Conversation turns so far, Anthropic-shaped (role + content,
                where content is either a string or a list of typed content blocks).
            tools: Tool definitions to offer the model. Empty by default — when empty,
                implementations must NOT force any tool_choice (D-02: the agent decides
                whether/when to call a tool, e.g. emit_ui_spec).
            max_tokens: Hard cap on generated tokens (always set, no implicit default).
            temperature: Sampling temperature.

        Yields:
            TextDelta / ToolCallDelta as content streams in, then exactly one
            UsageDelta with real captured usage (D-22), then a terminal StreamEnd.
            Implementations must never raise past this boundary — provider errors
            surface as StreamEnd(stop_reason='error').
        """
        ...
