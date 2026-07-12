"""Tests for ResolveRethemeUseCase (PANL-04 — one-shot NL re-theme resolution).

Mirrors GenerateUiSpecUseCase's test idiom: a fake resolver double (no
Bedrock, no network) drives every branch — happy path, unknown-pack
coercion, disallowed-override-key filtering, and resolver-exception
fallback (52-05-PLAN.md Task 1 acceptance criteria).
"""

from __future__ import annotations

import pytest

from app.application.use_cases.resolve_retheme import ResolveRethemeUseCase
from app.domain.ports.retheme_resolver import RethemeResolution

_KNOWN_PACK_IDS = frozenset(
    {
        "polytoken-teal",
        "linear-clean",
        "warm-editorial",
        "brutalist",
        "corporate-saas",
        "playful-rounded",
    }
)
_DEFAULT_PACK_ID = "polytoken-teal"


def _is_known_pack_id(pack_id: str) -> bool:
    return pack_id in _KNOWN_PACK_IDS


class _FakeResolver:
    """Test double implementing RethemeResolverPort structurally (no Bedrock)."""

    def __init__(
        self,
        resolution: RethemeResolution | None = None,
        *,
        raises: Exception | None = None,
    ) -> None:
        self._resolution = resolution
        self._raises = raises
        self.calls: list[tuple[str, str | None]] = []

    async def resolve(self, *, instruction: str, current_style_pack_id: str | None) -> RethemeResolution:
        self.calls.append((instruction, current_style_pack_id))
        if self._raises is not None:
            raise self._raises
        assert self._resolution is not None, "test misconfiguration: no resolution or raises supplied"
        return self._resolution


def _use_case(resolver: _FakeResolver) -> ResolveRethemeUseCase:
    return ResolveRethemeUseCase(
        resolver=resolver,
        is_known_pack_id=_is_known_pack_id,
        default_pack_id=_DEFAULT_PACK_ID,
    )


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
async def test_valid_resolution_passes_through() -> None:
    resolver = _FakeResolver(
        RethemeResolution(style_pack_id="linear-clean", token_overrides={"primary": "220 14% 10%"})
    )
    use_case = _use_case(resolver)

    result = await use_case.execute(instruction="make it cleaner", current_style_pack_id="polytoken-teal")

    assert result.style_pack_id == "linear-clean"
    assert result.token_overrides == {"primary": "220 14% 10%"}
    assert result.outcome == "ok"
    assert resolver.calls == [("make it cleaner", "polytoken-teal")]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_valid_resolution_with_empty_overrides_stays_ok() -> None:
    resolver = _FakeResolver(RethemeResolution(style_pack_id="brutalist", token_overrides={}))
    use_case = _use_case(resolver)

    result = await use_case.execute(instruction="bolder", current_style_pack_id=None)

    assert result.style_pack_id == "brutalist"
    assert result.token_overrides == {}
    assert result.outcome == "ok"


# ---------------------------------------------------------------------------
# Unknown / hallucinated style_pack_id -> coerce + fallback outcome (T-52-05-01)
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
async def test_unknown_style_pack_id_coerced_to_current_and_marks_fallback() -> None:
    resolver = _FakeResolver(RethemeResolution(style_pack_id="hallucinated-pack", token_overrides={}))
    use_case = _use_case(resolver)

    result = await use_case.execute(instruction="surprise me", current_style_pack_id="brutalist")

    assert result.style_pack_id == "brutalist"
    assert result.outcome == "fallback"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_unknown_style_pack_id_with_no_current_pack_coerces_to_default() -> None:
    resolver = _FakeResolver(RethemeResolution(style_pack_id="nope", token_overrides={}))
    use_case = _use_case(resolver)

    result = await use_case.execute(instruction="anything", current_style_pack_id=None)

    assert result.style_pack_id == _DEFAULT_PACK_ID
    assert result.outcome == "fallback"


# ---------------------------------------------------------------------------
# Disallowed override key dropped (T-52-05-02)
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
async def test_disallowed_override_key_is_dropped() -> None:
    resolver = _FakeResolver(
        RethemeResolution(
            style_pack_id="linear-clean",
            token_overrides={"primary": "220 14% 10%", "background-image": "url(evil)"},
        )
    )
    use_case = _use_case(resolver)

    result = await use_case.execute(instruction="cleaner", current_style_pack_id="polytoken-teal")

    assert result.token_overrides == {"primary": "220 14% 10%"}
    assert "background-image" not in result.token_overrides
    assert result.outcome == "ok"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_all_disallowed_override_keys_yields_empty_overrides_but_stays_ok() -> None:
    """Dropping bad keys is a silent filter, not a fallback trigger — only an
    unknown style_pack_id or a resolver exception marks outcome='fallback'."""
    resolver = _FakeResolver(
        RethemeResolution(style_pack_id="linear-clean", token_overrides={"font-family": "Comic Sans"})
    )
    use_case = _use_case(resolver)

    result = await use_case.execute(instruction="x", current_style_pack_id="polytoken-teal")

    assert result.token_overrides == {}
    assert result.outcome == "ok"


# ---------------------------------------------------------------------------
# Resolver exception -> fallback with unchanged current pack + empty overrides
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resolver_exception_yields_fallback_with_current_pack_and_empty_overrides() -> None:
    resolver = _FakeResolver(raises=RuntimeError("Bedrock timeout"))
    use_case = _use_case(resolver)

    result = await use_case.execute(instruction="anything", current_style_pack_id="warm-editorial")

    assert result.style_pack_id == "warm-editorial"
    assert result.token_overrides == {}
    assert result.outcome == "fallback"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resolver_exception_with_no_current_pack_falls_back_to_default() -> None:
    resolver = _FakeResolver(raises=TimeoutError())
    use_case = _use_case(resolver)

    result = await use_case.execute(instruction="anything", current_style_pack_id=None)

    assert result.style_pack_id == _DEFAULT_PACK_ID
    assert result.token_overrides == {}
    assert result.outcome == "fallback"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_never_raises_past_execute() -> None:
    """Mirrors GenerateUiSpecUseCase's best-effort contract: no exception escapes."""
    resolver = _FakeResolver(raises=ValueError("malformed tool_use"))
    use_case = _use_case(resolver)

    result = await use_case.execute(instruction="x", current_style_pack_id="brutalist")

    assert result.outcome == "fallback"
