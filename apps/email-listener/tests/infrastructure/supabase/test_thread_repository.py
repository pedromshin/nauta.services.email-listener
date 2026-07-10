"""Tests for SupabaseThreadRepository (ThreadResolver adapter).

Uses unittest.mock to assert table/op/filter call shapes and drive resolve()
through its reuse / create / merge / Tier-2-fallback branches — no live DB.
Mirrors tests/test_importer_repository.py's chain-mock style.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from unittest.mock import MagicMock

IMPORTER_A = "aaaaaaaa-0000-0000-0000-000000000001"
IMPORTER_B = "bbbbbbbb-0000-0000-0000-000000000002"
NOW = datetime(2026, 7, 1, 12, 0, 0, tzinfo=UTC)

_CHAIN_METHODS = ("select", "eq", "in_", "contains", "gte", "lte", "insert", "update")


def _make_chain() -> MagicMock:
    """Build a chainable mock covering every postgrest method resolve() calls."""
    chain = MagicMock()
    for method in _CHAIN_METHODS:
        getattr(chain, method).return_value = chain
    return chain


def _make_client(chain: MagicMock) -> MagicMock:
    client = MagicMock()
    client.table.return_value = chain
    return client


def _result(data: list[dict]) -> MagicMock:
    return MagicMock(data=data)


# ---------------------------------------------------------------------------
# Tier 0 — forward header link (this email's in_reply_to/references point at
# an existing email) reuses that email's thread_id.
# ---------------------------------------------------------------------------


def test_resolve_reuses_existing_thread_via_forward_in_reply_to() -> None:
    from app.infrastructure.supabase.thread_repository import SupabaseThreadRepository

    chain = _make_chain()
    chain.execute.side_effect = [
        _result([{"thread_id": "thread-1"}]),  # forward (message_id IN candidate_ids)
        _result([]),  # backward_reply
        _result([]),  # backward_ref
    ]
    client = _make_client(chain)
    repo = SupabaseThreadRepository(client=client)

    result = asyncio.run(
        repo.resolve(
            importer_id=IMPORTER_A,
            message_id="<child@x.com>",
            in_reply_to="<parent@x.com>",
            references_ids=(),
            subject="Invoice 123",
            received_at=NOW,
            body_text=None,
            body_html=None,
        )
    )

    assert result == "thread-1"
    # No new thread created, no merge update issued.
    chain.insert.assert_not_called()
    chain.update.assert_not_called()


def test_resolve_reuses_existing_thread_via_forward_references() -> None:
    from app.infrastructure.supabase.thread_repository import SupabaseThreadRepository

    chain = _make_chain()
    chain.execute.side_effect = [
        _result([{"thread_id": "thread-2"}]),
        _result([]),
        _result([]),
    ]
    client = _make_client(chain)
    repo = SupabaseThreadRepository(client=client)

    result = asyncio.run(
        repo.resolve(
            importer_id=IMPORTER_A,
            message_id="<reply3@x.com>",
            in_reply_to=None,
            references_ids=("<root@x.com>", "<reply2@x.com>"),
            subject="Re: Invoice 123",
            received_at=NOW,
            body_text=None,
            body_html=None,
        )
    )

    assert result == "thread-2"


def test_resolve_tier1_embedded_message_id_forward_link() -> None:
    """A Gmail-forward-stripped email with an embedded Message-ID still joins its original thread."""
    from app.infrastructure.supabase.thread_repository import SupabaseThreadRepository

    chain = _make_chain()
    chain.execute.side_effect = [
        _result([{"thread_id": "thread-3"}]),
        _result([]),
        _result([]),
    ]
    client = _make_client(chain)
    repo = SupabaseThreadRepository(client=client)

    body = "---------- Forwarded message ----------\nMessage-ID: <original@x.com>\nSubject: Original\n"
    result = asyncio.run(
        repo.resolve(
            importer_id=IMPORTER_A,
            message_id="<forward@x.com>",
            in_reply_to=None,
            references_ids=(),
            subject="Fwd: Original",
            received_at=NOW,
            body_text=body,
            body_html=None,
        )
    )

    assert result == "thread-3"
    # The forward query's candidate set must include the embedded id.
    forward_in_call = chain.in_.call_args_list[0]
    assert forward_in_call.args[0] == "message_id"
    assert "<original@x.com>" in forward_in_call.args[1]


# ---------------------------------------------------------------------------
# Tier 0 — backward header link (an already-ingested email points AT this
# email via in_reply_to or references_ids) also reuses that thread_id.
# ---------------------------------------------------------------------------


def test_resolve_reuses_existing_thread_via_backward_in_reply_to() -> None:
    from app.infrastructure.supabase.thread_repository import SupabaseThreadRepository

    chain = _make_chain()
    chain.execute.side_effect = [
        _result([{"thread_id": "thread-4"}]),  # backward_reply hit
        _result([]),  # backward_ref
    ]
    client = _make_client(chain)
    repo = SupabaseThreadRepository(client=client)

    result = asyncio.run(
        repo.resolve(
            importer_id=IMPORTER_A,
            message_id="<parent-arrived-late@x.com>",
            in_reply_to=None,
            references_ids=(),
            subject="Original",
            received_at=NOW,
            body_text=None,
            body_html=None,
        )
    )

    assert result == "thread-4"
    # No forward query issued (no candidate ids) — only backward_reply + backward_ref.
    assert chain.execute.call_count == 2


def test_resolve_reuses_existing_thread_via_backward_references_contains() -> None:
    from app.infrastructure.supabase.thread_repository import SupabaseThreadRepository

    chain = _make_chain()
    chain.execute.side_effect = [
        _result([]),  # backward_reply
        _result([{"thread_id": "thread-5"}]),  # backward_ref (references_ids contains us)
    ]
    client = _make_client(chain)
    repo = SupabaseThreadRepository(client=client)

    result = asyncio.run(
        repo.resolve(
            importer_id=IMPORTER_A,
            message_id="<root@x.com>",
            in_reply_to=None,
            references_ids=(),
            subject="Original",
            received_at=NOW,
            body_text=None,
            body_html=None,
        )
    )

    assert result == "thread-5"
    contains_call = chain.contains.call_args_list[0]
    assert contains_call.args == ("references_ids", ["<root@x.com>"])


# ---------------------------------------------------------------------------
# No neighbors — Tier 2 conservative subject/window fallback, then create.
# ---------------------------------------------------------------------------


def test_resolve_creates_new_thread_when_no_neighbors_and_empty_subject() -> None:
    from app.infrastructure.supabase.thread_repository import SupabaseThreadRepository

    new_thread_id = "cccccccc-0000-0000-0000-000000000099"
    chain = _make_chain()
    chain.execute.side_effect = [
        _result([]),  # backward_reply
        _result([]),  # backward_ref
        _result([{"id": new_thread_id}]),  # threads insert
    ]
    client = _make_client(chain)
    repo = SupabaseThreadRepository(client=client)

    result = asyncio.run(
        repo.resolve(
            importer_id=IMPORTER_A,
            message_id="<standalone@x.com>",
            in_reply_to=None,
            references_ids=(),
            subject=None,
            received_at=NOW,
            body_text=None,
            body_html=None,
        )
    )

    assert result == new_thread_id
    insert_payload = chain.insert.call_args.args[0]
    assert insert_payload["importer_id"] == IMPORTER_A


def test_resolve_tier2_fallback_matches_subject_within_window() -> None:
    """A singleton with no header link but a matching normalized subject within the window joins that thread."""
    from app.infrastructure.supabase.thread_repository import SupabaseThreadRepository

    chain = _make_chain()
    chain.execute.side_effect = [
        _result([]),  # backward_reply
        _result([]),  # backward_ref
        _result([{"subject": "Re: Invoice 123", "thread_id": "thread-6"}]),  # tier2 window query
    ]
    client = _make_client(chain)
    repo = SupabaseThreadRepository(client=client)

    result = asyncio.run(
        repo.resolve(
            importer_id=IMPORTER_A,
            message_id="<forward-no-headers@x.com>",
            in_reply_to=None,
            references_ids=(),
            subject="Fwd: Invoice 123",
            received_at=NOW,
            body_text="plain forward, no embedded Message-ID",
            body_html=None,
        )
    )

    assert result == "thread-6"
    chain.insert.assert_not_called()


def test_resolve_tier2_refuses_ambiguous_match_and_creates_new_thread() -> None:
    """Two distinct threads matching the normalized subject is ambiguous — refuses to merge, creates new."""
    from app.infrastructure.supabase.thread_repository import SupabaseThreadRepository

    new_thread_id = "dddddddd-0000-0000-0000-000000000042"
    chain = _make_chain()
    chain.execute.side_effect = [
        _result([]),  # backward_reply
        _result([]),  # backward_ref
        _result(
            [
                {"subject": "Invoice 123", "thread_id": "thread-7"},
                {"subject": "invoice 123", "thread_id": "thread-8"},
            ]
        ),  # tier2 — two distinct threads share the normalized subject
        _result([{"id": new_thread_id}]),  # falls through to create
    ]
    client = _make_client(chain)
    repo = SupabaseThreadRepository(client=client)

    result = asyncio.run(
        repo.resolve(
            importer_id=IMPORTER_A,
            message_id="<ambiguous@x.com>",
            in_reply_to=None,
            references_ids=(),
            subject="Invoice 123",
            received_at=NOW,
            body_text=None,
            body_html=None,
        )
    )

    assert result == new_thread_id


# ---------------------------------------------------------------------------
# Merge — neighbors span more than one existing thread.
# ---------------------------------------------------------------------------


def test_resolve_merges_two_threads_into_canonical_min_id_and_reassigns() -> None:
    from app.infrastructure.supabase.thread_repository import SupabaseThreadRepository

    chain = _make_chain()
    chain.execute.side_effect = [
        _result([{"thread_id": "thread-z"}, {"thread_id": "thread-a"}]),  # forward — two distinct threads
        _result([]),  # backward_reply
        _result([]),  # backward_ref
        _result([]),  # merge update
    ]
    client = _make_client(chain)
    repo = SupabaseThreadRepository(client=client)

    result = asyncio.run(
        repo.resolve(
            importer_id=IMPORTER_A,
            message_id="<bridge@x.com>",
            in_reply_to=None,
            references_ids=("<a-member@x.com>", "<z-member@x.com>"),
            subject="Bridging reply",
            received_at=NOW,
            body_text=None,
            body_html=None,
        )
    )

    # Lexicographically-min of {"thread-a", "thread-z"} is "thread-a".
    assert result == "thread-a"
    update_payload = chain.update.call_args.args[0]
    assert update_payload == {"thread_id": "thread-a"}
    in_call = chain.in_.call_args_list[-1]
    assert in_call.args[0] == "thread_id"
    assert set(in_call.args[1]) == {"thread-z"}


# ---------------------------------------------------------------------------
# Cross-importer isolation — every emails-table query must scope to the
# caller's importer_id, regardless of what the candidate headers reference.
# ---------------------------------------------------------------------------


def test_resolve_never_matches_across_importers() -> None:
    """Every query resolve() issues is scoped by .eq('importer_id', <caller's importer>)."""
    from app.infrastructure.supabase.thread_repository import SupabaseThreadRepository

    new_thread_id = "eeeeeeee-0000-0000-0000-000000000007"
    chain = _make_chain()
    chain.execute.side_effect = [
        _result([]),  # forward — candidate id belongs to IMPORTER_B in a real DB, never matched here
        _result([]),  # backward_reply
        _result([]),  # backward_ref
        _result([{"id": new_thread_id}]),  # create (no cross-importer leak possible)
    ]
    client = _make_client(chain)
    repo = SupabaseThreadRepository(client=client)

    result = asyncio.run(
        repo.resolve(
            importer_id=IMPORTER_A,
            message_id="<msg-a@x.com>",
            in_reply_to="<parent-in-importer-b@x.com>",
            references_ids=(),
            subject=None,
            received_at=NOW,
            body_text=None,
            body_html=None,
        )
    )

    assert result == new_thread_id
    importer_scoped_calls = [call for call in chain.eq.call_args_list if call.args and call.args[0] == "importer_id"]
    assert importer_scoped_calls, "expected every query to filter on importer_id"
    assert all(call.args == ("importer_id", IMPORTER_A) for call in importer_scoped_calls)
    assert not any(call.args == ("importer_id", IMPORTER_B) for call in importer_scoped_calls)
