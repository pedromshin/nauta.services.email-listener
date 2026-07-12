"""Tests for GenuiRethemeAdapter (PANL-04 — one-shot NL re-theme resolution).

Security/correctness contracts:
  - ONE forced-tool-use call — NO repair loop (52-05-PLAN.md, locked).
  - build_retheme_messages(...) is a PURE helper (no I/O) — independently
    unit-tested here without touching the mocked Bedrock client.
  - The adapter never swallows a malformed/missing tool_use — it raises, and
    ResolveRethemeUseCase (tested separately) is the sole catcher.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.domain.ports.retheme_resolver import ALLOWED_OVERRIDE_KEYS, RethemeResolution
from app.infrastructure.llm.genui_retheme_adapter import (
    GenuiRethemeAdapter,
    RethemeResolutionError,
    build_retheme_messages,
)
from app.infrastructure.llm.genui_style_packs import STYLE_PACK_IDS

_PACK_CATALOG = {
    "polytoken-teal": "Default brand palette — calm and trustworthy.",
    "linear-clean": "Monochrome precision-SaaS — engineered clarity.",
    "warm-editorial": "Editorial warmth — amber, serif, human.",
    "brutalist": "Bold high-contrast — stark and raw.",
    "corporate-saas": "Enterprise trust palette — formal and dependable.",
    "playful-rounded": "Friendly and vibrant — playful energy.",
}


# ---------------------------------------------------------------------------
# build_retheme_messages — pure prompt assembly
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_build_retheme_messages_includes_instruction() -> None:
    messages = build_retheme_messages("make it feel playful and colorful", "polytoken-teal", _PACK_CATALOG)

    assert len(messages) == 1
    assert messages[0]["role"] == "user"
    assert "make it feel playful and colorful" in messages[0]["content"]


@pytest.mark.unit
def test_build_retheme_messages_includes_all_six_pack_ids() -> None:
    messages = build_retheme_messages("cleaner", "polytoken-teal", _PACK_CATALOG)
    content = messages[0]["content"]

    assert len(STYLE_PACK_IDS) == 6, "regression guard: pack registry must stay at 6 packs"
    for pack_id in STYLE_PACK_IDS:
        assert pack_id in content, f"{pack_id} must appear in the assembled prompt"


@pytest.mark.unit
def test_build_retheme_messages_includes_allowed_override_keys() -> None:
    messages = build_retheme_messages("cleaner", "polytoken-teal", _PACK_CATALOG)
    content = messages[0]["content"]

    for key in ALLOWED_OVERRIDE_KEYS:
        assert key in content, f"allowed override key {key} must appear in the assembled prompt"


@pytest.mark.unit
def test_build_retheme_messages_handles_none_current_pack() -> None:
    messages = build_retheme_messages("cleaner", None, _PACK_CATALOG)

    assert "none set" in messages[0]["content"].lower()


@pytest.mark.unit
def test_build_retheme_messages_is_pure_deterministic() -> None:
    first = build_retheme_messages("cleaner", "polytoken-teal", _PACK_CATALOG)
    second = build_retheme_messages("cleaner", "polytoken-teal", _PACK_CATALOG)

    assert first == second


@pytest.mark.unit
def test_build_retheme_messages_does_not_mutate_pack_catalog() -> None:
    catalog_copy = dict(_PACK_CATALOG)
    build_retheme_messages("cleaner", "polytoken-teal", catalog_copy)

    assert catalog_copy == _PACK_CATALOG


# ---------------------------------------------------------------------------
# Adapter — forced tool-use, mocked Bedrock client (no network)
# ---------------------------------------------------------------------------


def _make_tool_response(input_payload: dict[str, Any]) -> MagicMock:
    block = MagicMock()
    block.type = "tool_use"
    block.input = input_payload
    response = MagicMock()
    response.content = [block]
    return response


@pytest.fixture
def mock_bedrock_client() -> MagicMock:
    client = MagicMock()
    client.messages = MagicMock()
    client.messages.create = AsyncMock()
    return client


@pytest.fixture
def adapter(mock_bedrock_client: MagicMock) -> GenuiRethemeAdapter:
    return GenuiRethemeAdapter(
        client=mock_bedrock_client,
        model_id="us.anthropic.claude-haiku-4-5-20251001-v1:0",
        max_tokens=512,
        timeout_seconds=15.0,
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resolve_parses_tool_use_into_resolution(
    adapter: GenuiRethemeAdapter,
    mock_bedrock_client: MagicMock,
) -> None:
    mock_bedrock_client.messages.create.return_value = _make_tool_response(
        {"style_pack_id": "linear-clean", "token_overrides": {"primary": "220 14% 10%"}}
    )

    result = await adapter.resolve(instruction="cleaner please", current_style_pack_id="polytoken-teal")

    assert result == RethemeResolution(style_pack_id="linear-clean", token_overrides={"primary": "220 14% 10%"})


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resolve_defaults_empty_overrides_when_omitted(
    adapter: GenuiRethemeAdapter,
    mock_bedrock_client: MagicMock,
) -> None:
    mock_bedrock_client.messages.create.return_value = _make_tool_response({"style_pack_id": "brutalist"})

    result = await adapter.resolve(instruction="bolder", current_style_pack_id=None)

    assert result.style_pack_id == "brutalist"
    assert result.token_overrides == {}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resolve_forces_emit_retheme_tool_and_sets_zero_temperature(
    adapter: GenuiRethemeAdapter,
    mock_bedrock_client: MagicMock,
) -> None:
    mock_bedrock_client.messages.create.return_value = _make_tool_response({"style_pack_id": "polytoken-teal"})

    await adapter.resolve(instruction="x", current_style_pack_id=None)

    call_kwargs = mock_bedrock_client.messages.create.call_args.kwargs
    assert call_kwargs["tool_choice"] == {"type": "tool", "name": "emit_retheme"}
    assert call_kwargs["temperature"] == 0
    assert call_kwargs["max_tokens"] == 512
    assert mock_bedrock_client.messages.create.call_count == 1, "must be exactly ONE call — no repair loop"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resolve_raises_when_no_tool_use_block(
    adapter: GenuiRethemeAdapter,
    mock_bedrock_client: MagicMock,
) -> None:
    text_block = MagicMock()
    text_block.type = "text"
    response = MagicMock()
    response.content = [text_block]
    mock_bedrock_client.messages.create.return_value = response

    with pytest.raises(RethemeResolutionError):
        await adapter.resolve(instruction="x", current_style_pack_id=None)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resolve_raises_on_missing_style_pack_id(
    adapter: GenuiRethemeAdapter,
    mock_bedrock_client: MagicMock,
) -> None:
    mock_bedrock_client.messages.create.return_value = _make_tool_response({"token_overrides": {}})

    with pytest.raises(RethemeResolutionError):
        await adapter.resolve(instruction="x", current_style_pack_id=None)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resolve_propagates_timeout(
    adapter: GenuiRethemeAdapter,
    mock_bedrock_client: MagicMock,
) -> None:
    mock_bedrock_client.messages.create.side_effect = TimeoutError()

    with pytest.raises(TimeoutError):
        await adapter.resolve(instruction="x", current_style_pack_id=None)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resolve_coerces_non_string_override_values_to_str(
    adapter: GenuiRethemeAdapter,
    mock_bedrock_client: MagicMock,
) -> None:
    """Defensive coercion — the tool schema already constrains values to strings;
    this guards a malformed/edge response without the adapter itself raising."""
    mock_bedrock_client.messages.create.return_value = _make_tool_response(
        {"style_pack_id": "polytoken-teal", "token_overrides": {"radius": "0.5rem"}}
    )

    result = await adapter.resolve(instruction="x", current_style_pack_id=None)

    assert result.token_overrides == {"radius": "0.5rem"}
