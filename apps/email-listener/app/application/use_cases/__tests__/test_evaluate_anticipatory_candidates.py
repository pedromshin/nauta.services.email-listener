"""Tests for EvaluateAnticipatoryCandidates — the gate chain (D-08/D-10/D-11/D-12/D-13).

RED (this file) -> GREEN (evaluate_anticipatory_candidates.py). Exercises the
Plan 25-01 idle_after_genui fixture through both independent gates using this
plan's stub judge + in-memory cap store — no live Bedrock call (D-09).
"""

from __future__ import annotations

import pytest

from app.application.use_cases.evaluate_anticipatory_candidates import (
    EvaluateAnticipatoryCandidates,
    record_candidate_outcome,
    to_proposal_card_declaration,
)
from app.application.use_cases.run_chat_turn_widgets import derive_declared_response_schema
from app.domain.anticipatory.candidate import AnticipatoryCandidate, SourceStateRef
from app.domain.anticipatory.fixtures import idle_after_genui_snapshot
from app.domain.anticipatory.stubs import StubAppropriatenessJudge
from app.infrastructure.anticipatory.in_memory_cap_store import InMemoryAnticipatoryCapStore

_APPROPRIATENESS_THRESHOLD = 0.75
_CAP_PER_WINDOW = 1
_CAP_WINDOW_MINUTES = 10
_CAP_PER_DAY = 3
_IDLE_THRESHOLD_SECONDS = 45.0


def _gate_kwargs() -> dict[str, float | int]:
    return {
        "idle_threshold_seconds": _IDLE_THRESHOLD_SECONDS,
        "appropriateness_threshold": _APPROPRIATENESS_THRESHOLD,
        "cap_per_window": _CAP_PER_WINDOW,
        "cap_window_minutes": _CAP_WINDOW_MINUTES,
        "cap_per_day": _CAP_PER_DAY,
    }


# ---------------------------------------------------------------------------
# Both gates active — independent checks (D-08)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_both_gates_pass_shows_candidate_and_records_shown() -> None:
    snapshot = idle_after_genui_snapshot()
    cap_store = InMemoryAnticipatoryCapStore()
    pipeline = EvaluateAnticipatoryCandidates(judge=StubAppropriatenessJudge(score_value=0.9), cap_store=cap_store)

    result = await pipeline.evaluate(snapshot, enabled=True, **_gate_kwargs())

    assert [e.type for e in result.events] == ["proposed", "shown"]
    assert len(result.shown) == 1
    assert result.shown[0].trigger_id == "idle_after_genui"
    assert await cap_store.count_shown(conversation_id=snapshot.conversation_id, since_epoch_s=0.0) == 1


@pytest.mark.asyncio
async def test_cap_suppresses_even_when_eval_would_approve() -> None:
    """D-10: the cap denies even though the (never-consulted-for-nothing) eval would pass."""
    snapshot = idle_after_genui_snapshot()
    cap_store = InMemoryAnticipatoryCapStore()
    cap_store.seed(snapshot.conversation_id, [snapshot.now_epoch_s - 60.0])  # already at the per-window limit
    pipeline = EvaluateAnticipatoryCandidates(judge=StubAppropriatenessJudge(score_value=0.9), cap_store=cap_store)

    result = await pipeline.evaluate(snapshot, enabled=True, **_gate_kwargs())

    assert [e.type for e in result.events] == ["proposed", "suppressed_by_cap"]
    assert result.shown == ()
    # record_shown must NOT have been called again for the suppressed candidate.
    assert await cap_store.count_shown(conversation_id=snapshot.conversation_id, since_epoch_s=0.0) == 1


@pytest.mark.asyncio
async def test_eval_suppresses_when_cap_has_room() -> None:
    """D-07: a below-threshold score suppresses even though the cap has room."""
    snapshot = idle_after_genui_snapshot()
    cap_store = InMemoryAnticipatoryCapStore()
    pipeline = EvaluateAnticipatoryCandidates(judge=StubAppropriatenessJudge(score_value=0.3), cap_store=cap_store)

    result = await pipeline.evaluate(snapshot, enabled=True, **_gate_kwargs())

    assert [e.type for e in result.events] == ["proposed", "suppressed_by_eval"]
    assert result.shown == ()
    assert await cap_store.count_shown(conversation_id=snapshot.conversation_id, since_epoch_s=0.0) == 0


@pytest.mark.asyncio
async def test_independence_same_candidate_three_outcomes() -> None:
    """Proves D-08: the SAME candidate is shown / suppressed_by_cap / suppressed_by_eval
    depending only on which gate is made to fail — neither check substitutes for the other.
    """
    snapshot = idle_after_genui_snapshot()

    shown_result = await EvaluateAnticipatoryCandidates(
        judge=StubAppropriatenessJudge(score_value=0.9), cap_store=InMemoryAnticipatoryCapStore()
    ).evaluate(snapshot, enabled=True, **_gate_kwargs())
    assert [e.type for e in shown_result.events] == ["proposed", "shown"]

    full_cap_store = InMemoryAnticipatoryCapStore()
    full_cap_store.seed(snapshot.conversation_id, [snapshot.now_epoch_s - 60.0])
    cap_result = await EvaluateAnticipatoryCandidates(
        judge=StubAppropriatenessJudge(score_value=0.9), cap_store=full_cap_store
    ).evaluate(snapshot, enabled=True, **_gate_kwargs())
    assert [e.type for e in cap_result.events] == ["proposed", "suppressed_by_cap"]

    eval_result = await EvaluateAnticipatoryCandidates(
        judge=StubAppropriatenessJudge(score_value=0.3), cap_store=InMemoryAnticipatoryCapStore()
    ).evaluate(snapshot, enabled=True, **_gate_kwargs())
    assert [e.type for e in eval_result.events] == ["proposed", "suppressed_by_eval"]


@pytest.mark.asyncio
async def test_daily_ceiling_suppresses_even_with_window_room() -> None:
    """D-10: both windows (per-window AND per-day) are independently enforced."""
    snapshot = idle_after_genui_snapshot()
    cap_store = InMemoryAnticipatoryCapStore()
    window_seconds = _CAP_WINDOW_MINUTES * 60.0
    # 3 prior shows, all OUTSIDE the 10-minute window but WITHIN the 24h day window.
    old_timestamps = [snapshot.now_epoch_s - window_seconds - (60.0 * i) for i in range(1, _CAP_PER_DAY + 1)]
    cap_store.seed(snapshot.conversation_id, old_timestamps)
    pipeline = EvaluateAnticipatoryCandidates(judge=StubAppropriatenessJudge(score_value=0.9), cap_store=cap_store)

    result = await pipeline.evaluate(snapshot, enabled=True, **_gate_kwargs())

    assert [e.type for e in result.events] == ["proposed", "suppressed_by_cap"]


# ---------------------------------------------------------------------------
# Explicit-accept mapping (D-11) — Phase-24 proposal-card reuse, unchanged
# ---------------------------------------------------------------------------


def test_to_proposal_card_declaration_round_trips_with_phase_24() -> None:
    candidate = AnticipatoryCandidate(
        trigger_id="idle_after_genui",
        proposed_prompt_text="Want me to build on that, or try something different?",
        rationale="idle after a settled genui turn",
        source_refs=(SourceStateRef(kind="run_event", ref_id="msg-1"),),
    )

    declaration = to_proposal_card_declaration(candidate)

    assert declaration["options"] == [
        {
            "id": "opt-0",
            "title": declaration["options"][0]["title"],
            "value": candidate.proposed_prompt_text,
        }
    ]
    assert declaration["prompt"] == candidate.proposed_prompt_text

    schema = derive_declared_response_schema("proposal_cards", declaration)
    assert schema["properties"]["optionId"]["enum"] == ["opt-0"]
    assert schema["required"] == ["optionId"]
    assert schema["additionalProperties"] is False


# ---------------------------------------------------------------------------
# Outcome recording (D-13) — accepted/dismissed + dismissal cooldown
# ---------------------------------------------------------------------------


def test_record_candidate_outcome_accepted_appends_event_and_no_cooldown() -> None:
    candidate = AnticipatoryCandidate(
        trigger_id="completed_artifact",
        proposed_prompt_text="Want me to export this table as a CSV?",
        rationale="settled panel with a next-best-action",
    )
    cooldowns: set[str] = set()

    event = record_candidate_outcome(candidate, "accepted", cooldowns=cooldowns)

    assert event.type == "accepted"
    assert cooldowns == set()


@pytest.mark.asyncio
async def test_record_candidate_outcome_dismissed_registers_cooldown_suppressing_next_evaluation() -> None:
    snapshot = idle_after_genui_snapshot()
    candidate = AnticipatoryCandidate(
        trigger_id="idle_after_genui",
        proposed_prompt_text="Want me to build on that, or try something different?",
        rationale="idle after a settled genui turn",
    )
    cooldowns: set[str] = set()

    event = record_candidate_outcome(candidate, "dismissed", cooldowns=cooldowns)

    assert event.type == "dismissed"
    assert "idle_after_genui" in cooldowns

    pipeline = EvaluateAnticipatoryCandidates(
        judge=StubAppropriatenessJudge(score_value=0.9), cap_store=InMemoryAnticipatoryCapStore()
    )
    result = await pipeline.evaluate(snapshot, enabled=True, cooldowns=cooldowns, **_gate_kwargs())

    assert result.events == ()
    assert result.shown == ()


# ---------------------------------------------------------------------------
# Flag OFF (D-12) — the whole pipeline short-circuits
# ---------------------------------------------------------------------------


class _ExplodingJudge:
    """A judge/cap-store double that fails the test if ever called (flag-OFF proof)."""

    async def score(self, **_kwargs: object) -> object:
        raise AssertionError("judge must never be called when the pipeline is disabled")


class _ExplodingCapStore:
    async def count_shown(self, **_kwargs: object) -> int:
        raise AssertionError("cap store must never be called when the pipeline is disabled")

    async def record_shown(self, **_kwargs: object) -> None:
        raise AssertionError("cap store must never be called when the pipeline is disabled")


@pytest.mark.asyncio
async def test_flag_off_short_circuits_everything() -> None:
    snapshot = idle_after_genui_snapshot()
    pipeline = EvaluateAnticipatoryCandidates(judge=_ExplodingJudge(), cap_store=_ExplodingCapStore())  # type: ignore[arg-type]

    result = await pipeline.evaluate(snapshot, enabled=False, **_gate_kwargs())

    assert result.shown == ()
    assert result.events == ()
