"""Tests for SupabaseUiSpecTemplateRepository — best-effort cache adapter.

TDD (Phase 14-03, CACHE-01, D-15, D-17):
  1. find_by_cache_key returns CachedTemplate on a matching row.
  2. find_by_cache_key returns None on an empty result (cache miss).
  3. find_by_cache_key returns None on a client exception (best-effort miss, D-17).
  4. find_by_cache_key filters by BOTH cache_key AND validation_status='validated' (D-15).
  5. persist calls upsert with on_conflict="cache_key" (D-12 concurrency-safe upsert).
  6. persist swallows an exception without propagating (best-effort, D-17).
  7. increment_use_count issues an update and swallows a raised exception (D-17).
  8. CachedTemplate / TemplateToPersist are frozen (immutable, CLAUDE.md).
  9. SupabaseUiSpecTemplateRepository satisfies the UiSpecTemplateRepository Protocol structurally.

These tests use MagicMock for the Supabase client — no live DB required.
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import MagicMock, call, patch

import pytest

from app.domain.ports.ui_spec_template_repository import (
    CachedTemplate,
    TemplateToPersist,
    UiSpecTemplateRepository,
)
from app.infrastructure.supabase.supabase_ui_spec_template_repository import (
    SupabaseUiSpecTemplateRepository,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SAMPLE_CACHE_KEY = "a" * 64  # 64-char hex string
_SAMPLE_TEMPLATE_ID = "11111111-1111-1111-1111-111111111111"
_SAMPLE_SPEC_JSON: dict[str, Any] = {"v": 1, "root": {"type": "card", "title": "Invoice"}}

_SAMPLE_TEMPLATE_TO_PERSIST = TemplateToPersist(
    cache_key=_SAMPLE_CACHE_KEY,
    intent_text="show invoice details",
    data_shape_hash="b" * 64,
    registry_version="abc123" * 10 + "abcd",
    catalog_id="global",
    spec_json=_SAMPLE_SPEC_JSON,
    validation_status="validated",
    spec_node_count=5,
    spec_depth=2,
    importer_id="00000000-0000-0000-0003-000000000001",
)


def _make_client(
    *,
    select_rows: list[dict[str, Any]] | None = None,
    select_raises: Exception | None = None,
    upsert_raises: Exception | None = None,
    update_raises: Exception | None = None,
) -> MagicMock:
    """Build a MagicMock Supabase client with chainable table().select/upsert/update paths."""
    client = MagicMock()

    # ── select chain: .table().select().eq().eq().limit().execute() ──────────
    select_execute = MagicMock()
    if select_raises is not None:
        select_execute.side_effect = select_raises
    else:
        rows = select_rows if select_rows is not None else []
        select_execute.return_value = MagicMock(data=rows)

    limit_mock = MagicMock()
    limit_mock.execute = select_execute

    eq2_mock = MagicMock()
    eq2_mock.limit = MagicMock(return_value=limit_mock)

    eq1_mock = MagicMock()
    eq1_mock.eq = MagicMock(return_value=eq2_mock)

    select_mock = MagicMock()
    select_mock.eq = MagicMock(return_value=eq1_mock)

    # ── upsert chain: .table().upsert().execute() ────────────────────────────
    upsert_execute = MagicMock()
    if upsert_raises is not None:
        upsert_execute.side_effect = upsert_raises
    else:
        upsert_execute.return_value = MagicMock(data=[])

    upsert_mock = MagicMock()
    upsert_mock.execute = upsert_execute

    # ── update chain: .table().update().eq().execute() ───────────────────────
    update_execute = MagicMock()
    if update_raises is not None:
        update_execute.side_effect = update_raises
    else:
        update_execute.return_value = MagicMock(data=[])

    update_eq_mock = MagicMock()
    update_eq_mock.execute = update_execute

    update_mock = MagicMock()
    update_mock.eq = MagicMock(return_value=update_eq_mock)

    table_mock = MagicMock()
    table_mock.select = MagicMock(return_value=select_mock)
    table_mock.upsert = MagicMock(return_value=upsert_mock)
    table_mock.update = MagicMock(return_value=update_mock)

    client.table = MagicMock(return_value=table_mock)
    return client


# ---------------------------------------------------------------------------
# Test 1: find_by_cache_key returns CachedTemplate on a matching row
# ---------------------------------------------------------------------------


def test_find_by_cache_key_returns_cached_template_on_hit() -> None:
    """find_by_cache_key returns a CachedTemplate when the query returns a row."""
    rows = [{"id": _SAMPLE_TEMPLATE_ID, "spec_json": _SAMPLE_SPEC_JSON}]
    client = _make_client(select_rows=rows)
    repo = SupabaseUiSpecTemplateRepository(client=client)

    result = asyncio.run(repo.find_by_cache_key(_SAMPLE_CACHE_KEY))

    assert result is not None
    assert isinstance(result, CachedTemplate)
    assert result.id == _SAMPLE_TEMPLATE_ID
    assert result.spec_json == _SAMPLE_SPEC_JSON


# ---------------------------------------------------------------------------
# Test 2: find_by_cache_key returns None on empty result (cache miss)
# ---------------------------------------------------------------------------


def test_find_by_cache_key_returns_none_on_miss() -> None:
    """find_by_cache_key returns None when the query returns no rows."""
    client = _make_client(select_rows=[])
    repo = SupabaseUiSpecTemplateRepository(client=client)

    result = asyncio.run(repo.find_by_cache_key(_SAMPLE_CACHE_KEY))

    assert result is None


# ---------------------------------------------------------------------------
# Test 3: find_by_cache_key returns None on exception (best-effort, D-17)
# ---------------------------------------------------------------------------


def test_find_by_cache_key_returns_none_on_exception() -> None:
    """find_by_cache_key treats any lookup exception as a miss (D-17)."""
    client = _make_client(select_raises=RuntimeError("DB unavailable"))
    repo = SupabaseUiSpecTemplateRepository(client=client)

    result = asyncio.run(repo.find_by_cache_key(_SAMPLE_CACHE_KEY))

    assert result is None


# ---------------------------------------------------------------------------
# Test 4: find_by_cache_key filters by BOTH cache_key AND validation_status (D-15)
# ---------------------------------------------------------------------------


def test_find_by_cache_key_filters_by_cache_key_and_validation_status() -> None:
    """find_by_cache_key must apply eq('cache_key', ...) AND eq('validation_status', 'validated') (D-15)."""
    rows = [{"id": _SAMPLE_TEMPLATE_ID, "spec_json": _SAMPLE_SPEC_JSON}]
    client = _make_client(select_rows=rows)
    table_mock = client.table.return_value
    repo = SupabaseUiSpecTemplateRepository(client=client)

    asyncio.run(repo.find_by_cache_key(_SAMPLE_CACHE_KEY))

    # First eq: cache_key
    table_mock.select.return_value.eq.assert_called_once_with("cache_key", _SAMPLE_CACHE_KEY)
    # Second eq: validation_status='validated'
    eq1 = table_mock.select.return_value.eq.return_value
    eq1.eq.assert_called_once_with("validation_status", "validated")


# ---------------------------------------------------------------------------
# Test 5: persist calls upsert with on_conflict="cache_key" (D-12)
# ---------------------------------------------------------------------------


def test_persist_calls_upsert_with_on_conflict() -> None:
    """persist uses ON CONFLICT (cache_key) upsert for concurrency-safe writes (D-12)."""
    client = _make_client()
    table_mock = client.table.return_value
    repo = SupabaseUiSpecTemplateRepository(client=client)

    asyncio.run(repo.persist(_SAMPLE_TEMPLATE_TO_PERSIST))

    assert table_mock.upsert.called
    call_kwargs = table_mock.upsert.call_args
    # The on_conflict kwarg must be "cache_key"
    _, kwargs = call_kwargs if isinstance(call_kwargs, tuple) and len(call_kwargs) == 2 else ([], {})
    if not kwargs:
        # call_args may be a Call object — inspect keyword args
        kwargs = table_mock.upsert.call_args.kwargs if hasattr(table_mock.upsert.call_args, "kwargs") else {}
    assert kwargs.get("on_conflict") == "cache_key", (
        f"Expected on_conflict='cache_key', got: {kwargs}"
    )


# ---------------------------------------------------------------------------
# Test 6: persist swallows an exception without propagating (D-17)
# ---------------------------------------------------------------------------


def test_persist_swallows_exception() -> None:
    """persist must not raise even when the upsert call fails (best-effort, D-17)."""
    client = _make_client(upsert_raises=RuntimeError("DB unavailable"))
    repo = SupabaseUiSpecTemplateRepository(client=client)

    # Must not raise
    result = asyncio.run(repo.persist(_SAMPLE_TEMPLATE_TO_PERSIST))
    assert result is None


# ---------------------------------------------------------------------------
# Test 7: increment_use_count issues an update and swallows exceptions (D-17)
# ---------------------------------------------------------------------------


def test_increment_use_count_swallows_exception() -> None:
    """increment_use_count must not raise when the update fails (best-effort, D-17)."""
    client = _make_client(update_raises=RuntimeError("DB unavailable"))
    repo = SupabaseUiSpecTemplateRepository(client=client)

    result = asyncio.run(repo.increment_use_count(_SAMPLE_TEMPLATE_ID))
    assert result is None


def test_increment_use_count_calls_update() -> None:
    """increment_use_count must call the DB update on the ui_spec_templates table."""
    client = _make_client()
    table_mock = client.table.return_value
    repo = SupabaseUiSpecTemplateRepository(client=client)

    asyncio.run(repo.increment_use_count(_SAMPLE_TEMPLATE_ID))

    assert table_mock.update.called


# ---------------------------------------------------------------------------
# Test 8: DTOs are frozen (immutable, CLAUDE.md)
# ---------------------------------------------------------------------------


def test_cached_template_is_frozen() -> None:
    """CachedTemplate dataclass must be frozen (immutable, CLAUDE.md)."""
    ct = CachedTemplate(id=_SAMPLE_TEMPLATE_ID, spec_json=_SAMPLE_SPEC_JSON)
    with pytest.raises(AttributeError):
        ct.id = "mutated"  # type: ignore[misc]


def test_template_to_persist_is_frozen() -> None:
    """TemplateToPersist dataclass must be frozen (immutable, CLAUDE.md)."""
    with pytest.raises(AttributeError):
        _SAMPLE_TEMPLATE_TO_PERSIST.cache_key = "mutated"  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Test 9: SupabaseUiSpecTemplateRepository satisfies the Protocol structurally
# ---------------------------------------------------------------------------


def test_adapter_satisfies_protocol() -> None:
    """SupabaseUiSpecTemplateRepository must structurally satisfy UiSpecTemplateRepository."""
    client = _make_client()
    repo = SupabaseUiSpecTemplateRepository(client=client)

    assert callable(getattr(repo, "find_by_cache_key", None))
    assert callable(getattr(repo, "persist", None))
    assert callable(getattr(repo, "increment_use_count", None))
