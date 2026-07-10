"""Tests for scripts/backfill_threads.py (Phase 45, THRD-01).

Uses a small stateful in-memory fake Client (not a MagicMock) because the
idempotency proof requires running the backfill TWICE against the SAME
evolving table state — a canned-response mock can't express that. Mirrors
the supabase-py chain shape (table().select/insert/update().eq/in_().execute()).
"""

from __future__ import annotations

import asyncio
import copy
from typing import Any
from unittest.mock import patch

from scripts.backfill_threads import _backfill_importer, _load_importer_emails, run_backfill

from app.domain.services.thread_grouping import DEFAULT_TIER2_WINDOW

IMPORTER_A = "aaaaaaaa-0000-0000-0000-000000000001"
IMPORTER_B = "bbbbbbbb-0000-0000-0000-000000000002"


# ---------------------------------------------------------------------------
# Minimal stateful fake Client
# ---------------------------------------------------------------------------


class _FakeResult:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _FakeTable:
    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []
        self._next_id = 1

    def _matches(self, row: dict[str, Any], filters: list[tuple[str, str, Any]]) -> bool:
        for op, col, val in filters:
            if op == "eq" and row.get(col) != val:
                return False
            if op == "in" and row.get(col) not in val:
                return False
        return True

    def select(self, filters: list[tuple[str, str, Any]]) -> list[dict[str, Any]]:
        return [copy.deepcopy(row) for row in self.rows if self._matches(row, filters)]

    def insert(self, payload: dict[str, Any]) -> dict[str, Any]:
        new_id = f"generated-thread-{self._next_id}"
        self._next_id += 1
        row = {**payload, "id": new_id}
        self.rows.append(row)
        return copy.deepcopy(row)

    def update(self, payload: dict[str, Any], filters: list[tuple[str, str, Any]]) -> list[dict[str, Any]]:
        updated = []
        for row in self.rows:
            if self._matches(row, filters):
                row.update(payload)
                updated.append(copy.deepcopy(row))
        return updated


class _FakeQuery:
    def __init__(self, table: _FakeTable) -> None:
        self._table = table
        self._filters: list[tuple[str, str, Any]] = []
        self._insert_payload: dict[str, Any] | None = None
        self._update_payload: dict[str, Any] | None = None

    def select(self, _cols: str) -> _FakeQuery:
        return self

    def eq(self, col: str, val: Any) -> _FakeQuery:
        self._filters.append(("eq", col, val))
        return self

    def in_(self, col: str, vals: list[Any]) -> _FakeQuery:
        self._filters.append(("in", col, list(vals)))
        return self

    def insert(self, payload: dict[str, Any]) -> _FakeQuery:
        self._insert_payload = payload
        return self

    def update(self, payload: dict[str, Any]) -> _FakeQuery:
        self._update_payload = payload
        return self

    def execute(self) -> _FakeResult:
        if self._insert_payload is not None:
            return _FakeResult([self._table.insert(self._insert_payload)])
        if self._update_payload is not None:
            return _FakeResult(self._table.update(self._update_payload, self._filters))
        return _FakeResult(self._table.select(self._filters))


class FakeClient:
    """In-memory fake for the supabase Client — supports table().select/insert/update()."""

    def __init__(self) -> None:
        self._tables: dict[str, _FakeTable] = {}

    def table(self, name: str) -> _FakeQuery:
        if name not in self._tables:
            self._tables[name] = _FakeTable()
        return _FakeQuery(self._tables[name])

    def seed(self, table_name: str, rows: list[dict[str, Any]]) -> None:
        self._tables.setdefault(table_name, _FakeTable()).rows.extend(copy.deepcopy(rows))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _email_row(
    *,
    email_id: str,
    importer_id: str,
    message_id: str,
    subject: str,
    received_at: str,
    in_reply_to: str | None = None,
    references_ids: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "id": email_id,
        "importer_id": importer_id,
        "message_id": message_id,
        "in_reply_to": in_reply_to,
        "references_ids": references_ids or [],
        "subject": subject,
        "received_at": received_at,
        "body_text": None,
        "body_html": None,
        "thread_id": None,
    }


def _reply_chain_rows(importer_id: str) -> list[dict[str, Any]]:
    return [
        _email_row(
            email_id="email-1",
            importer_id=importer_id,
            message_id="<root@x.com>",
            subject="Invoice 123",
            received_at="2026-07-01T10:00:00+00:00",
        ),
        _email_row(
            email_id="email-2",
            importer_id=importer_id,
            message_id="<reply1@x.com>",
            subject="Re: Invoice 123",
            received_at="2026-07-01T10:05:00+00:00",
            in_reply_to="<root@x.com>",
            references_ids=["<root@x.com>"],
        ),
        _email_row(
            email_id="email-3",
            importer_id=importer_id,
            message_id="<reply2@x.com>",
            subject="Re: Invoice 123",
            received_at="2026-07-01T10:10:00+00:00",
            in_reply_to="<reply1@x.com>",
            references_ids=["<root@x.com>", "<reply1@x.com>"],
        ),
    ]


# ---------------------------------------------------------------------------
# A reply chain collapses to exactly one thread.
# ---------------------------------------------------------------------------


def test_backfill_collapses_reply_chain_into_one_thread() -> None:
    client = FakeClient()
    client.seed("emails", _reply_chain_rows(IMPORTER_A))

    result = asyncio.run(
        _backfill_importer(client, IMPORTER_A, dry_run=False, window=DEFAULT_TIER2_WINDOW)  # type: ignore[arg-type]
    )

    assert result.emails_scanned == 3
    assert result.threads_created == 1
    assert result.emails_reassigned == 3

    emails_after = asyncio.run(_load_importer_emails(client, IMPORTER_A))  # type: ignore[arg-type]
    thread_ids = {row["thread_id"] for row in emails_after.values()}
    assert len(thread_ids) == 1
    assert None not in thread_ids

    threads = client.table("threads").select("*").execute().data
    assert len(threads) == 1
    assert threads[0]["importer_id"] == IMPORTER_A


# ---------------------------------------------------------------------------
# Disjoint chains stay separate.
# ---------------------------------------------------------------------------


def test_backfill_keeps_disjoint_chains_separate() -> None:
    client = FakeClient()
    client.seed(
        "emails",
        [
            _email_row(
                email_id="email-a",
                importer_id=IMPORTER_A,
                message_id="<a@x.com>",
                subject="Invoice 123",
                received_at="2026-07-01T10:00:00+00:00",
            ),
            _email_row(
                email_id="email-b",
                importer_id=IMPORTER_A,
                message_id="<b@x.com>",
                subject="Payment 456",
                received_at="2026-08-15T09:00:00+00:00",
            ),
        ],
    )

    result = asyncio.run(
        _backfill_importer(client, IMPORTER_A, dry_run=False, window=DEFAULT_TIER2_WINDOW)  # type: ignore[arg-type]
    )

    assert result.emails_scanned == 2
    assert result.threads_created == 2
    assert result.emails_reassigned == 2

    emails_after = asyncio.run(_load_importer_emails(client, IMPORTER_A))  # type: ignore[arg-type]
    thread_ids = {row["thread_id"] for row in emails_after.values()}
    assert len(thread_ids) == 2


# ---------------------------------------------------------------------------
# Idempotency — a second run over the resulting state is a no-op.
# ---------------------------------------------------------------------------


def test_second_run_over_resulting_state_is_a_no_op() -> None:
    client = FakeClient()
    client.seed("emails", _reply_chain_rows(IMPORTER_A))

    first = asyncio.run(
        _backfill_importer(client, IMPORTER_A, dry_run=False, window=DEFAULT_TIER2_WINDOW)  # type: ignore[arg-type]
    )
    assert first.threads_created == 1
    assert first.emails_reassigned == 3

    emails_after_first = asyncio.run(_load_importer_emails(client, IMPORTER_A))  # type: ignore[arg-type]
    thread_id_after_first = next(iter({row["thread_id"] for row in emails_after_first.values()}))

    second = asyncio.run(
        _backfill_importer(client, IMPORTER_A, dry_run=False, window=DEFAULT_TIER2_WINDOW)  # type: ignore[arg-type]
    )

    assert second.threads_created == 0
    assert second.emails_reassigned == 0
    assert second.emails_scanned == 3

    threads = client.table("threads").select("*").execute().data
    assert len(threads) == 1  # no duplicate thread created on the second run

    emails_after_second = asyncio.run(_load_importer_emails(client, IMPORTER_A))  # type: ignore[arg-type]
    thread_ids_after_second = {row["thread_id"] for row in emails_after_second.values()}
    assert thread_ids_after_second == {thread_id_after_first}


# ---------------------------------------------------------------------------
# --dry-run writes nothing.
# ---------------------------------------------------------------------------


def test_dry_run_writes_nothing_but_reports_intended_counts() -> None:
    client = FakeClient()
    client.seed("emails", _reply_chain_rows(IMPORTER_A))

    result = asyncio.run(
        _backfill_importer(client, IMPORTER_A, dry_run=True, window=DEFAULT_TIER2_WINDOW)  # type: ignore[arg-type]
    )

    # Preview counts are still reported...
    assert result.emails_scanned == 3
    assert result.threads_created == 1
    assert result.emails_reassigned == 3

    # ...but nothing was actually written.
    threads = client.table("threads").select("*").execute().data
    assert threads == []
    emails_after = asyncio.run(_load_importer_emails(client, IMPORTER_A))  # type: ignore[arg-type]
    assert all(row["thread_id"] is None for row in emails_after.values())


# ---------------------------------------------------------------------------
# Cross-importer isolation.
# ---------------------------------------------------------------------------


def test_backfill_never_assigns_thread_across_importers() -> None:
    """Two importers with colliding Message-ID/subject patterns never share a thread."""
    client = FakeClient()
    client.seed(
        "importers",
        [{"id": IMPORTER_A}, {"id": IMPORTER_B}],
    )
    client.seed("emails", _reply_chain_rows(IMPORTER_A))
    # Same message_id/subject pattern in a DIFFERENT importer — must never merge.
    client.seed("emails", _reply_chain_rows(IMPORTER_B))

    with patch("scripts.backfill_threads.get_supabase_client", return_value=client):
        results = asyncio.run(run_backfill(dry_run=False))

    assert len(results) == 2
    results_by_importer = {r.importer_id: r for r in results}
    assert results_by_importer[IMPORTER_A].threads_created == 1
    assert results_by_importer[IMPORTER_B].threads_created == 1

    emails_a = asyncio.run(_load_importer_emails(client, IMPORTER_A))  # type: ignore[arg-type]
    emails_b = asyncio.run(_load_importer_emails(client, IMPORTER_B))  # type: ignore[arg-type]
    thread_ids_a = {row["thread_id"] for row in emails_a.values()}
    thread_ids_b = {row["thread_id"] for row in emails_b.values()}
    assert len(thread_ids_a) == 1
    assert len(thread_ids_b) == 1
    assert thread_ids_a.isdisjoint(thread_ids_b)
