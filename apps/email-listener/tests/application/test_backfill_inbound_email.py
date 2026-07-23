"""Unit tests for BackfillInboundEmailUseCase + the raw-store routing.

Covers:
- id namespacing (bf- prefix added exactly once), store-then-ingest ordering
- invalid backfill ids raise BEFORE any store/ingest side effect
- RoutingRawEmailStore routes bf- ids to the backfill store, SES ids to S3
- reprocess round-trip: raw_storage_key -> rsplit -> same routing decision
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.application.use_cases.backfill_inbound_email import (
    BackfillInboundEmailUseCase,
    InvalidBackfillIdError,
)
from app.infrastructure.raw_email_store_routing import RoutingRawEmailStore

_RAW = b"From: a@example.com\r\n\r\nbody"


def _use_case() -> tuple[BackfillInboundEmailUseCase, MagicMock, MagicMock]:
    store = MagicMock()
    store.store = AsyncMock()
    ingest = MagicMock()
    ingest.execute = AsyncMock(return_value="email-sentinel")
    return BackfillInboundEmailUseCase(store=store, ingest=ingest), store, ingest


@pytest.mark.unit
@pytest.mark.asyncio
async def test_prefixes_id_and_stores_before_ingest() -> None:
    uc, store, ingest = _use_case()
    result = await uc.execute(backfill_id="gmail-abc123", raw_mime=_RAW, recipients=["u-t@x.test"])

    assert result == "email-sentinel"
    store.store.assert_awaited_once_with("bf-gmail-abc123", _RAW)
    ingest.execute.assert_awaited_once_with("bf-gmail-abc123", recipients=["u-t@x.test"])


@pytest.mark.unit
@pytest.mark.asyncio
async def test_existing_bf_prefix_is_not_doubled() -> None:
    uc, store, _ = _use_case()
    await uc.execute(backfill_id="bf-abc", raw_mime=_RAW)
    store.store.assert_awaited_once_with("bf-abc", _RAW)


@pytest.mark.unit
@pytest.mark.asyncio
@pytest.mark.parametrize("bad_id", ["has space", "slash/id", "", "a" * 201, "semi;colon"])
async def test_invalid_id_raises_without_side_effects(bad_id: str) -> None:
    uc, store, ingest = _use_case()
    with pytest.raises(InvalidBackfillIdError):
        await uc.execute(backfill_id=bad_id, raw_mime=_RAW)
    store.store.assert_not_awaited()
    ingest.execute.assert_not_awaited()


# ---------------------------------------------------------------------------
# RoutingRawEmailStore
# ---------------------------------------------------------------------------


def _routing() -> tuple[RoutingRawEmailStore, MagicMock, MagicMock]:
    ses = MagicMock()
    ses.key_for = MagicMock(return_value="inbound/prod/ses-id")
    ses.fetch = AsyncMock(return_value=b"ses-bytes")
    backfill = MagicMock()
    backfill.key_for = MagicMock(return_value="backfill/bf-abc")
    backfill.fetch = AsyncMock(return_value=b"bf-bytes")
    return RoutingRawEmailStore(ses_store=ses, backfill_store=backfill), ses, backfill


@pytest.mark.unit
@pytest.mark.asyncio
async def test_routing_bf_ids_hit_backfill_store() -> None:
    router, ses, _backfill = _routing()
    assert await router.fetch("bf-abc") == b"bf-bytes"
    assert router.key_for("bf-abc") == "backfill/bf-abc"
    ses.fetch.assert_not_awaited()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_routing_ses_ids_hit_s3_store() -> None:
    router, _ses, backfill = _routing()
    assert await router.fetch("ses-id") == b"ses-bytes"
    assert router.key_for("ses-id") == "inbound/prod/ses-id"
    backfill.fetch.assert_not_awaited()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reprocess_round_trip_re_routes_to_backfill_store() -> None:
    """raw_storage_key -> bare id (reprocess derivation) -> same store."""
    from app.infrastructure.supabase.raw_email_backfill_store import SupabaseRawEmailBackfillStore

    supabase_store = SupabaseRawEmailBackfillStore(client=MagicMock(), bucket="raw-emails")
    raw_storage_key = supabase_store.key_for("bf-gmail-xyz")
    bare_id = raw_storage_key.rsplit("/", 1)[-1]

    assert bare_id == "bf-gmail-xyz"
    router, _, backfill = _routing()
    await router.fetch(bare_id)
    backfill.fetch.assert_awaited_once_with(bare_id)
