"""RunChatTurn — the chat agent/run orchestration loop (SEAM-04, SEAM-03, Phase 22-06).

Assembles token-budget-trimmed history (D-26), routes to the right transport via
the ChatProviderRouter (D-04..D-07), gates the turn through the CostCircuitBreaker
(fail-closed pre-turn, D-21), streams the provider's deltas as typed run events
(D-27), and persists the user + assistant messages as canonical interleaved typed
parts (FOUND-1) plus the run and its append-only events.

Built as an async generator with NO HTTP dependency — the SSE transport (22-07)
is a thin wrapper over `run()`/`regenerate()`.

Architecture contract (lint-imports): imports only domain ports/services and
standard library / structlog — no infrastructure at module level (mirrors
generate_ui_spec.py's "Application does not import infrastructure" contract).
"""

from __future__ import annotations

import json
import uuid
from typing import TYPE_CHECKING, Any

from app.domain.ports.chat_provider import StreamEnd, TextDelta, ToolCallDelta, UsageDelta
from app.domain.ports.chat_repositories import (
    ChatConversationRepository,
    ChatMessage,
    ChatMessageRepository,
    ChatRunEvent,
    ChatRunRepository,
)
from app.domain.ports.cost_ledger_repository import CostLedgerRepository, UsageEvent
from app.domain.services.chat_model_registry import ChatModel, get_model
from app.domain.services.chat_provider_router import ChatModelNotFoundError, ChatProviderRouter
from app.domain.services.cost_circuit_breaker import CostCircuitBreaker, estimate_prompt_tokens

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Sequence

    from app.domain.ports.chat_provider import ChatProvider

# SEAM-04: one agent, one run per turn today.
_AGENT_ID = "chat-agent-v1"

# D-01: minimal neutral persona — no product identity yet.
_SYSTEM_PROMPT = (
    "You are a helpful, neutral AI assistant. Respond clearly and concisely to the user's requests."
)

_TITLE_SNIPPET_MAX_LEN = 60


class RunChatTurn:
    """The chat turn agent: history -> route -> gate -> stream -> events -> persist -> ledger.

    Collaborators are accepted as constructor arguments typed via domain ports —
    the router/breaker are concrete domain services (not infrastructure).
    """

    def __init__(
        self,
        *,
        messages: ChatMessageRepository,
        runs: ChatRunRepository,
        conversations: ChatConversationRepository,
        router: ChatProviderRouter,
        breaker: CostCircuitBreaker,
        ledger: CostLedgerRepository,
        default_importer_id: str,
        max_output_tokens: int = 4096,
    ) -> None:
        self._messages = messages
        self._runs = runs
        self._conversations = conversations
        self._router = router
        self._breaker = breaker
        self._ledger = ledger
        self._default_importer_id = default_importer_id
        self._max_output_tokens = max_output_tokens

    async def run(
        self,
        *,
        conversation_id: str,
        user_text: str,
        model_id: str,
        importer_id: str | None = None,
    ) -> AsyncIterator[ChatRunEvent]:
        """Run one full chat turn for conversation_id, yielding typed ChatRunEvents.

        Persists the user message first (next turn_index) regardless of the
        pre-turn cost decision — only the assistant call is withheld on BLOCK
        (fail-closed, D-21).
        """
        resolved_importer_id = importer_id or self._default_importer_id
        model = get_model(model_id)
        if model is None:
            raise ChatModelNotFoundError(model_id)
        provider = self._router.select(model_id)

        history = await self._messages.list_active_context(conversation_id)
        is_first_turn = len(history) == 0
        turn_index = max((m.turn_index for m in history), default=-1) + 1

        await self._messages.insert_message(
            conversation_id=conversation_id,
            role="user",
            parts=({"type": "text", "text": user_text},),
            turn_index=turn_index,
            status="completed",
        )

        prompt_tokens_est = estimate_prompt_tokens(len(user_text))
        decision = await self._breaker.check_pre_turn(
            model=model,
            importer_id=resolved_importer_id,
            conversation_id=conversation_id,
            prompt_tokens_est=prompt_tokens_est,
            max_output_tokens=self._max_output_tokens,
        )
        if not decision.allowed:
            yield ChatRunEvent(type="cost_capped", data={"breached_cap": decision.breached_cap})
            return

        async for event in self._execute_turn(
            provider=provider,
            model=model,
            model_id=model_id,
            conversation_id=conversation_id,
            history=history,
            turn_index=turn_index,
            importer_id=resolved_importer_id,
            is_first_turn=is_first_turn,
            user_text=user_text,
        ):
            yield event

    async def _execute_turn(
        self,
        *,
        provider: ChatProvider,
        model: ChatModel,
        model_id: str,
        conversation_id: str,
        history: Sequence[ChatMessage],
        turn_index: int,
        importer_id: str,
        is_first_turn: bool,
        user_text: str,
    ) -> AsyncIterator[ChatRunEvent]:
        """Shared engine: create the run, stream the provider, persist, and finish.

        Task 2 scope: happy-path lifecycle only (started -> checkpoints -> usage
        -> completed). Cancellation, mid-stream cost abort, provider failure, and
        regenerate-as-sibling are added in Task 3.
        """
        run = await self._runs.create_run(conversation_id=conversation_id, agent_id=_AGENT_ID, model_id=model_id)
        yield await self._emit(run.id, "started", {"model_id": model_id})

        trimmed_history = _trim_history_to_budget(history, context_tokens=model.capabilities.context_tokens)
        provider_messages = _build_provider_messages(trimmed_history)

        accumulated_text = ""
        input_tokens = 0
        output_tokens = 0

        async for delta in provider.stream(
            model_id=model_id,
            system=_SYSTEM_PROMPT,
            messages=provider_messages,
            tools=(),
            max_tokens=self._max_output_tokens,
        ):
            if isinstance(delta, TextDelta):
                accumulated_text += delta.text
                yield await self._emit(run.id, "text_delta_checkpoint", {"text": delta.text})
            elif isinstance(delta, UsageDelta):
                input_tokens = delta.input_tokens
                output_tokens = delta.output_tokens
            elif isinstance(delta, ToolCallDelta):
                # D-03: no data tools are offered in 22-06 — defensive no-op if a
                # provider still emits one; emit_ui_spec lands capability-gated in 22-07.
                continue
            elif isinstance(delta, StreamEnd):
                continue

        await self._messages.insert_message(
            conversation_id=conversation_id,
            role="assistant",
            parts=({"type": "text", "text": accumulated_text},) if accumulated_text else (),
            turn_index=turn_index,
            status="completed",
            run_id=run.id,
            sibling_group_id=str(uuid.uuid4()),
            version=1,
            is_active=True,
        )
        cost = self._breaker.estimate_turn_cost(
            model=model, prompt_tokens_est=input_tokens, max_output_tokens=output_tokens
        )
        await self._ledger.record(
            UsageEvent(
                importer_id=importer_id,
                model_id=model_id,
                execution_locus=model.execution_locus,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost,
                conversation_id=conversation_id,
                run_id=run.id,
            )
        )
        yield await self._emit(run.id, "usage", {"input_tokens": input_tokens, "output_tokens": output_tokens})
        yield await self._emit(run.id, "completed", {})
        await self._runs.finish_run(run_id=run.id, status="completed")

        if is_first_turn:
            await self._conversations.touch(
                conversation_id=conversation_id, model_id=model_id, title=_title_snippet(user_text)
            )
        else:
            await self._conversations.touch(conversation_id=conversation_id, model_id=model_id)

    async def _emit(self, run_id: str, event_type: Any, data: dict[str, Any]) -> ChatRunEvent:
        """Persist one run event (append-only) and return it for the caller to yield."""
        return await self._runs.append_event(run_id=run_id, event_type=event_type, data=data)


def _build_provider_messages(history: Sequence[ChatMessage]) -> list[dict[str, Any]]:
    """Anthropic-shaped {role, content} dicts from active-sibling ChatMessage rows (FOUND-1)."""
    return [
        {"role": message.role, "content": list(message.parts)}
        for message in history
        if message.role in ("user", "assistant")
    ]


def _estimate_message_tokens(message: ChatMessage) -> int:
    serialized = json.dumps(list(message.parts), ensure_ascii=False)
    return estimate_prompt_tokens(len(serialized))


def _trim_history_to_budget(history: Sequence[ChatMessage], *, context_tokens: int) -> list[ChatMessage]:
    """Keep the most recent messages that fit context_tokens, recent-first (D-26).

    Always keeps at least the single most recent message, even if it alone
    exceeds the budget — a caller should never end up with an empty history
    just because one message is large.
    """
    kept: list[ChatMessage] = []
    budget = context_tokens
    for message in reversed(history):
        cost = _estimate_message_tokens(message)
        if kept and cost > budget:
            break
        kept.append(message)
        budget -= cost
    kept.reverse()
    return kept


def _title_snippet(user_text: str, *, max_len: int = _TITLE_SNIPPET_MAX_LEN) -> str:
    """Deterministic truncated first-message snippet for the conversation title (D-12).

    No LLM call — whitespace-collapsed, hard-truncated at max_len with an
    ellipsis when the source text is longer. Falls back to a neutral default
    for empty/whitespace-only text (defence-in-depth).
    """
    collapsed = " ".join(user_text.split())
    if not collapsed:
        return "Untitled conversation"
    if len(collapsed) <= max_len:
        return collapsed
    return collapsed[: max_len - 1].rstrip() + "…"
