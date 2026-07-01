"""Tests for GenerateCodeIslandUseCase (PARALLEL code-island path).

Verifies:
- quarantine → code-generate pipeline orchestration
- SHA-256 intent hash (never raw string) in GenerationEvent (D-19)
- One GenerationEvent row per execute() call, best-effort (GEN-05, T-13-10)
- audit failure is swallowed, never propagates (T-13-10)
- fallback path: is_fallback → outcome 'fallback', audit still called
- escalated path: escalated → outcome 'escalated'
- use_case imports NO infrastructure (lint-imports contract)
- registry_version marker + neutral spec-field defaults on the audit row
"""

from __future__ import annotations

import hashlib
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.application.use_cases.generate_code_island import (
    GenerateCodeIslandResult,
    GenerateCodeIslandUseCase,
)
from app.domain.ports.generation_audit_repository import GenerationEvent
from app.infrastructure.llm.genui_code_generator_adapter import (
    SAFE_FALLBACK_CODE,
    CodeGeneratorResult,
)
from app.infrastructure.llm.genui_quarantine_adapter import QuarantineExtraction

# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

_VALID_CODE = "const r = document.getElementById('island-root'); r.textContent = 'hi';"


def _make_extraction(
    *,
    entity_type: str = "card",
    intent_summary: str = "Build a card",
    confidence: str = "high",
    input_tokens: int = 10,
    output_tokens: int = 5,
) -> QuarantineExtraction:
    return QuarantineExtraction(
        entity_type=entity_type,
        intent_summary=intent_summary,
        confidence=confidence,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )


@pytest.fixture
def mock_quarantine() -> MagicMock:
    quarantine = MagicMock()
    quarantine.extract = AsyncMock(return_value=_make_extraction())
    return quarantine


@pytest.fixture
def mock_code_generator() -> MagicMock:
    generator = MagicMock()
    generator.generate = AsyncMock(
        return_value=CodeGeneratorResult(
            code=_VALID_CODE, language="javascript", attempts=1, escalated=False
        )
    )
    return generator


@pytest.fixture
def mock_audit() -> MagicMock:
    audit = MagicMock()
    audit.record = AsyncMock(return_value=None)
    return audit


@pytest.fixture
def use_case(
    mock_quarantine: MagicMock,
    mock_code_generator: MagicMock,
    mock_audit: MagicMock,
) -> GenerateCodeIslandUseCase:
    return GenerateCodeIslandUseCase(
        quarantine=mock_quarantine,
        code_generator=mock_code_generator,
        audit=mock_audit,
    )


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
async def test_happy_path_quarantine_then_generate(
    use_case: GenerateCodeIslandUseCase,
    mock_quarantine: MagicMock,
    mock_code_generator: MagicMock,
) -> None:
    """execute() runs quarantine then code-generate and returns ok code."""
    result = await use_case.execute(intent="Build a dashboard", raw_content="rows...")

    assert isinstance(result, GenerateCodeIslandResult)
    assert result.code == _VALID_CODE
    assert result.language == "javascript"
    assert result.outcome == "ok"
    assert result.attempts == 1

    mock_quarantine.extract.assert_awaited_once()
    # Raw content goes ONLY through quarantine (SAFE-01).
    q_kwargs = mock_quarantine.extract.call_args.kwargs
    assert q_kwargs["intent"] == "Build a dashboard"
    assert q_kwargs["raw_content"] == "rows..."

    # Generator receives the extraction, never raw prose (SAFE-02).
    g_kwargs = mock_code_generator.generate.call_args.kwargs
    assert isinstance(g_kwargs["extraction"], QuarantineExtraction)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_intent_hash_is_sha256_not_raw(
    use_case: GenerateCodeIslandUseCase,
    mock_audit: MagicMock,
) -> None:
    """The audit row must store SHA-256(intent), never the raw intent string (D-19)."""
    intent = "Build a very secret dashboard"
    await use_case.execute(intent=intent)

    mock_audit.record.assert_awaited_once()
    event: GenerationEvent = mock_audit.record.call_args.args[0]
    expected = hashlib.sha256(intent.encode()).hexdigest()
    assert event.intent_hash == expected
    assert intent not in event.intent_hash


@pytest.mark.unit
@pytest.mark.asyncio
async def test_audit_row_uses_code_island_registry_and_neutral_spec_fields(
    use_case: GenerateCodeIslandUseCase,
    mock_audit: MagicMock,
) -> None:
    """Audit row uses the code-island registry marker + neutral spec-specific defaults."""
    await use_case.execute(intent="Build a widget", importer_id="imp-1")

    event: GenerationEvent = mock_audit.record.call_args.args[0]
    assert event.registry_version == "code-island-v1"
    assert event.spec_node_count is None
    assert event.spec_depth is None
    assert event.style_pack_id is None
    assert event.retrieved_ids == ()
    assert event.retrieved_overlap_count == 0
    assert event.importer_id == "imp-1"
    assert event.outcome == "ok"
    assert event.spec_validation_passed is True


# ---------------------------------------------------------------------------
# Fallback path
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
async def test_fallback_outcome_when_generator_returns_fallback(
    use_case: GenerateCodeIslandUseCase,
    mock_code_generator: MagicMock,
    mock_audit: MagicMock,
) -> None:
    """is_fallback=True → outcome 'fallback', SAFE_FALLBACK_CODE, audit still best-effort called."""
    mock_code_generator.generate = AsyncMock(
        return_value=CodeGeneratorResult(
            code=SAFE_FALLBACK_CODE, language="javascript", attempts=3, escalated=True, is_fallback=True
        )
    )

    result = await use_case.execute(intent="garbage")

    assert result.outcome == "fallback"
    assert result.code == SAFE_FALLBACK_CODE
    assert result.attempts == 3
    # Audit is still recorded on the fallback path (best-effort).
    mock_audit.record.assert_awaited_once()
    event: GenerationEvent = mock_audit.record.call_args.args[0]
    assert event.outcome == "fallback"
    assert event.spec_validation_passed is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_escalated_outcome(
    use_case: GenerateCodeIslandUseCase,
    mock_code_generator: MagicMock,
) -> None:
    """escalated=True (not fallback) → outcome 'escalated'."""
    mock_code_generator.generate = AsyncMock(
        return_value=CodeGeneratorResult(
            code=_VALID_CODE, language="javascript", attempts=3, escalated=True, is_fallback=False
        )
    )

    result = await use_case.execute(intent="Build something tricky")

    assert result.outcome == "escalated"
    assert result.code == _VALID_CODE


# ---------------------------------------------------------------------------
# Audit best-effort (T-13-10)
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
async def test_audit_failure_is_swallowed(
    use_case: GenerateCodeIslandUseCase,
    mock_audit: MagicMock,
) -> None:
    """An audit repository error must NOT propagate; execute() returns the code normally."""
    mock_audit.record = AsyncMock(side_effect=RuntimeError("db down"))

    result = await use_case.execute(intent="Build a card")

    assert result.code == _VALID_CODE
    assert result.outcome == "ok"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_one_audit_row_per_execute(
    use_case: GenerateCodeIslandUseCase,
    mock_audit: MagicMock,
) -> None:
    """Exactly one GenerationEvent is recorded per execute() call (GEN-05)."""
    await use_case.execute(intent="Build a card")
    assert mock_audit.record.await_count == 1
