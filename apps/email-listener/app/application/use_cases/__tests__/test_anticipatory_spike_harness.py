"""End-to-end anticipatory-prompting SPIKE harness — the go/no-go evidence matrix (D-03).

This is the SPIKE's actual deliverable's raw material (Plan 25-03, ANTIC-01/ANTIC-02):
drives the REAL `EvaluateAnticipatoryCandidates` gate chain (Plan 25-02) over each of the
three Plan-25-01 fixtures across a small appropriateness-score/cap scenario matrix and
asserts the terminal lifecycle outcome for every cell. `25-SPIKE-FINDINGS.md`'s evidence
table transcribes this exact matrix (`build_spike_outcome_matrix()`).

Deterministic only — `StubAppropriatenessJudge` (Plan 25-02, D-09) and a test-local
in-memory cap store double stand in for Bedrock + persistence; NO live Bedrock call, no
network. `FakeAnticipatoryCapStore` mirrors `InMemoryAnticipatoryCapStore` exactly but is
defined locally rather than imported from `app.infrastructure.anticipatory` — this test
file lives under `app.application.use_cases.__tests__` and the "Application does not
import infrastructure" lint-imports contract forbids that cross-layer import (same
convention `test_evaluate_anticipatory_candidates.py` established in Plan 25-02).

Scenario matrix (Task 1's action text):
    A — appropriate + cap room   (score=0.9, empty cap)                  -> shown
    B — appropriate + capped     (score=0.9, cap seeded at the window
                                   limit)                                 -> suppressed_by_cap
    C — inappropriate + cap room (score=0.3, empty cap)                  -> suppressed_by_eval
    D — flag OFF                 (enabled=False)                         -> zero candidates/events

Each of the three fixtures (idle_after_genui, completed_artifact, ambiguous_intent) fires
exactly one trigger (proven in Plan 25-01's own tests), so every fixture x scenario cell
has a single unambiguous terminal outcome.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Literal

import pytest

from app.application.use_cases.evaluate_anticipatory_candidates import (
    AnticipatoryPipelineResult,
    EvaluateAnticipatoryCandidates,
    record_candidate_outcome,
    to_proposal_card_declaration,
)
from app.application.use_cases.run_chat_turn_widgets import derive_declared_response_schema
from app.domain.anticipatory.candidate import AnticipatoryStateSnapshot, TriggerId
from app.domain.anticipatory.fixtures import (
    ambiguous_intent_snapshot,
    completed_artifact_snapshot,
    idle_after_genui_snapshot,
)
from app.domain.anticipatory.stubs import StubAppropriatenessJudge

# Mirrors settings.py's documented spike tunables (25-01-SUMMARY.md's key-decisions):
# 0.75 appropriateness threshold, 1-per-10min window, 3-per-day ceiling, 45s idle threshold.
_APPROPRIATENESS_THRESHOLD = 0.75
_CAP_PER_WINDOW = 1
_CAP_WINDOW_MINUTES = 10
_CAP_PER_DAY = 3
_IDLE_THRESHOLD_SECONDS = 45.0

FixtureName = Literal["idle_after_genui", "completed_artifact", "ambiguous_intent"]
ScenarioName = Literal["A_appropriate_cap_room", "B_appropriate_capped", "C_inappropriate_cap_room", "D_flag_off"]

_FIXTURE_BUILDERS: dict[FixtureName, Callable[[], AnticipatoryStateSnapshot]] = {
    "idle_after_genui": idle_after_genui_snapshot,
    "completed_artifact": completed_artifact_snapshot,
    "ambiguous_intent": ambiguous_intent_snapshot,
}

# The expected TERMINAL lifecycle outcome for every scenario, independent of which
# fixture is under test (D-08's independence guarantee holds per-fixture too).
_EXPECTED_TERMINAL_OUTCOME: dict[ScenarioName, str] = {
    "A_appropriate_cap_room": "shown",
    "B_appropriate_capped": "suppressed_by_cap",
    "C_inappropriate_cap_room": "suppressed_by_eval",
    "D_flag_off": "none",
}


class FakeAnticipatoryCapStore:
    """In-process AnticipatoryCapStore test double — mirrors InMemoryAnticipatoryCapStore.

    Defined locally (not imported from app.infrastructure) to keep this
    application-layer test file lint-imports-clean.
    """

    def __init__(self) -> None:
        self._shown_by_conversation: dict[str, list[float]] = {}

    def seed(self, conversation_id: str, timestamps: list[float]) -> None:
        self._shown_by_conversation.setdefault(conversation_id, []).extend(timestamps)

    async def count_shown(self, *, conversation_id: str, since_epoch_s: float) -> int:
        timestamps = self._shown_by_conversation.get(conversation_id, [])
        return sum(1 for ts in timestamps if ts >= since_epoch_s)

    async def record_shown(self, *, conversation_id: str, at_epoch_s: float) -> None:
        self._shown_by_conversation.setdefault(conversation_id, []).append(at_epoch_s)


class _ExplodingJudge:
    """A judge double that fails the test if ever called (flag-OFF proof, D-12)."""

    async def score(self, **_kwargs: object) -> object:
        raise AssertionError("judge must never be called when the pipeline is disabled")


class _ExplodingCapStore:
    """A cap-store double that fails the test if ever called (flag-OFF proof, D-12)."""

    async def count_shown(self, **_kwargs: object) -> int:
        raise AssertionError("cap store must never be called when the pipeline is disabled")

    async def record_shown(self, **_kwargs: object) -> None:
        raise AssertionError("cap store must never be called when the pipeline is disabled")


async def _run_scenario(
    fixture_name: FixtureName, scenario_name: ScenarioName
) -> tuple[AnticipatoryPipelineResult, AnticipatoryStateSnapshot]:
    """Build one fixture x scenario pipeline run — the harness's single execution path."""
    snapshot = _FIXTURE_BUILDERS[fixture_name]()

    if scenario_name == "D_flag_off":
        pipeline = EvaluateAnticipatoryCandidates(judge=_ExplodingJudge(), cap_store=_ExplodingCapStore())  # type: ignore[arg-type]
        result = await pipeline.evaluate(
            snapshot,
            enabled=False,
            idle_threshold_seconds=_IDLE_THRESHOLD_SECONDS,
            appropriateness_threshold=_APPROPRIATENESS_THRESHOLD,
            cap_per_window=_CAP_PER_WINDOW,
            cap_window_minutes=_CAP_WINDOW_MINUTES,
            cap_per_day=_CAP_PER_DAY,
        )
        return result, snapshot

    cap_store = FakeAnticipatoryCapStore()
    if scenario_name == "B_appropriate_capped":
        # One prior "shown" 60s ago — well within the 10-minute window, at the per-window limit.
        cap_store.seed(snapshot.conversation_id, [snapshot.now_epoch_s - 60.0])

    score = 0.9 if scenario_name in ("A_appropriate_cap_room", "B_appropriate_capped") else 0.3
    pipeline = EvaluateAnticipatoryCandidates(judge=StubAppropriatenessJudge(score_value=score), cap_store=cap_store)
    result = await pipeline.evaluate(
        snapshot,
        enabled=True,
        idle_threshold_seconds=_IDLE_THRESHOLD_SECONDS,
        appropriateness_threshold=_APPROPRIATENESS_THRESHOLD,
        cap_per_window=_CAP_PER_WINDOW,
        cap_window_minutes=_CAP_WINDOW_MINUTES,
        cap_per_day=_CAP_PER_DAY,
    )
    return result, snapshot


def _terminal_outcome(result: AnticipatoryPipelineResult) -> str:
    """The last lifecycle event's type, or "none" when the pipeline produced nothing (D-12)."""
    if not result.events:
        return "none"
    return result.events[-1].type


async def build_spike_outcome_matrix() -> dict[FixtureName, dict[ScenarioName, str]]:
    """Run the FULL ANTIC-01/ANTIC-02 gate chain over every fixture x scenario pair.

    Returns the fixture x scenario -> terminal lifecycle outcome matrix that IS the
    spike's go/no-go evidence (D-03) — `25-SPIKE-FINDINGS.md`'s evidence table
    transcribes this exact structure verbatim. Deterministic: `StubAppropriatenessJudge`
    + an in-memory cap-store double only, no live Bedrock call (D-09).
    """
    matrix: dict[FixtureName, dict[ScenarioName, str]] = {}
    for fixture_name in _FIXTURE_BUILDERS:
        matrix[fixture_name] = {}
        for scenario_name in _EXPECTED_TERMINAL_OUTCOME:
            result, _snapshot = await _run_scenario(fixture_name, scenario_name)
            matrix[fixture_name][scenario_name] = _terminal_outcome(result)
    return matrix


# ---------------------------------------------------------------------------
# Per-cell matrix assertions — every fixture x scenario outcome (D-07/D-08/D-10/D-12)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("scenario_name", list(_EXPECTED_TERMINAL_OUTCOME))
@pytest.mark.parametrize("fixture_name", list(_FIXTURE_BUILDERS))
async def test_gate_chain_matrix_outcome(fixture_name: FixtureName, scenario_name: ScenarioName) -> None:
    """Every fixture x scenario cell resolves to its expected terminal lifecycle outcome."""
    result, _snapshot = await _run_scenario(fixture_name, scenario_name)

    assert _terminal_outcome(result) == _EXPECTED_TERMINAL_OUTCOME[scenario_name]

    if scenario_name == "D_flag_off":
        assert result.shown == ()
        assert result.events == ()
    elif scenario_name == "A_appropriate_cap_room":
        assert len(result.shown) == 1
        assert result.shown[0].trigger_id == fixture_name
        assert [e.type for e in result.events] == ["proposed", "shown"]
    elif scenario_name == "B_appropriate_capped":
        assert result.shown == ()
        assert [e.type for e in result.events] == ["proposed", "suppressed_by_cap"]
    else:  # C_inappropriate_cap_room
        assert result.shown == ()
        assert [e.type for e in result.events] == ["proposed", "suppressed_by_eval"]


# ---------------------------------------------------------------------------
# Shown -> proposal card (D-11) + dismissal cooldown (D-13) — per fixture
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("fixture_name", list(_FIXTURE_BUILDERS))
async def test_shown_candidate_maps_to_proposal_card_and_dismissal_registers_cooldown(
    fixture_name: FixtureName,
) -> None:
    """D-11: a shown candidate round-trips through the UNCHANGED Phase-24 proposal-card
    declaration; D-13: dismissing it registers a cooldown that suppresses re-evaluation.
    """
    result, snapshot = await _run_scenario(fixture_name, "A_appropriate_cap_room")
    assert len(result.shown) == 1
    candidate = result.shown[0]

    declaration = to_proposal_card_declaration(candidate)
    assert declaration["prompt"] == candidate.proposed_prompt_text
    assert declaration["options"] == [
        {"id": "opt-0", "title": declaration["options"][0]["title"], "value": candidate.proposed_prompt_text}
    ]
    schema = derive_declared_response_schema("proposal_cards", declaration)
    assert schema["properties"]["optionId"]["enum"] == ["opt-0"]
    assert schema["required"] == ["optionId"]
    assert schema["additionalProperties"] is False

    cooldowns: set[TriggerId] = set()
    dismiss_event = record_candidate_outcome(candidate, "dismissed", cooldowns=cooldowns)
    assert dismiss_event.type == "dismissed"
    assert candidate.trigger_id in cooldowns

    # A later evaluate() call passed the SAME cooldowns registry skips this trigger entirely.
    pipeline = EvaluateAnticipatoryCandidates(
        judge=StubAppropriatenessJudge(score_value=0.9), cap_store=FakeAnticipatoryCapStore()
    )
    suppressed_result = await pipeline.evaluate(
        snapshot,
        enabled=True,
        idle_threshold_seconds=_IDLE_THRESHOLD_SECONDS,
        appropriateness_threshold=_APPROPRIATENESS_THRESHOLD,
        cap_per_window=_CAP_PER_WINDOW,
        cap_window_minutes=_CAP_WINDOW_MINUTES,
        cap_per_day=_CAP_PER_DAY,
        cooldowns=cooldowns,
    )
    assert suppressed_result.shown == ()
    assert suppressed_result.events == ()


# ---------------------------------------------------------------------------
# The evidence matrix itself — Task 2 transcribes this into 25-SPIKE-FINDINGS.md
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_build_spike_outcome_matrix_matches_expected_and_prints_evidence() -> None:
    """The single source of truth Task 2 transcribes verbatim into 25-SPIKE-FINDINGS.md's
    '## Evidence (fixture matrix)' table (D-03). Run with `-s` to see the printed table.
    """
    matrix = await build_spike_outcome_matrix()

    for fixture_name, scenario_outcomes in matrix.items():
        for scenario_name, outcome in scenario_outcomes.items():
            expected = _EXPECTED_TERMINAL_OUTCOME[scenario_name]
            assert outcome == expected, f"{fixture_name} / {scenario_name} -> {outcome!r}, expected {expected!r}"

    scenario_names = list(_EXPECTED_TERMINAL_OUTCOME)
    print("\n--- Spike outcome matrix (fixture x scenario -> terminal lifecycle outcome) ---")
    print("fixture".ljust(22) + "".join(name.ljust(26) for name in scenario_names))
    for fixture_name, scenario_outcomes in matrix.items():
        row = fixture_name.ljust(22) + "".join(scenario_outcomes[name].ljust(26) for name in scenario_names)
        print(row)
