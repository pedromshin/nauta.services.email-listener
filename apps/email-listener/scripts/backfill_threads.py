"""Idempotent, re-runnable thread backfill over existing emails (Phase 45, THRD-01).

Groups each importer's existing emails through the SAME algorithm the live
ThreadResolver uses (app.domain.services.thread_grouping.group_emails —
Union-Find over RFC headers + Tier 1 embedded-id + Tier 2 subject/window
fallback), then assigns/reuses a thread_id per computed group:

- If any group member already carries a thread_id, the deterministic
  canonical (lexicographically-min existing thread_id in the group) is
  reused and every other member is reassigned to it.
- Otherwise a new threads row is created (importer_id + the earliest
  member's raw subject) and every member is assigned to it.

Idempotency: group_emails is deterministic and existing thread_ids are
always reused (never replaced by a fresh id when a canonical already
exists) — a second run over the resulting state computes zero net changes
(0 threads created, 0 emails reassigned).

Same-importer scoping (T-45-03-01): every query/update is scoped to a
single importer_id — this script never assigns a thread across importers.

Usage:
    cd apps/email-listener
    uv run python -m scripts.backfill_threads [--dry-run]
    uv run python scripts/backfill_threads.py [--dry-run]

Options:
    --dry-run    Log intended changes without writing to the database.

This module is NOT imported by any app code. It is a standalone script.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, cast

import structlog
from supabase import Client

from app.domain.services.thread_grouping import DEFAULT_TIER2_WINDOW, ThreadableEmail, group_emails
from app.infrastructure.supabase.client import get_supabase_client

logger = structlog.get_logger(__name__)

# Sentinel distinct from any real (UUID string) thread_id and from None —
# used only to compute dry-run "would reassign" counts without ever writing.
_DRY_RUN_NEW_THREAD_SENTINEL = "<dry-run-new-thread>"

_EMAIL_SELECT_COLUMNS = (
    "id, message_id, in_reply_to, references_ids, subject, received_at, body_text, body_html, thread_id"
)


@dataclass(frozen=True)
class ImporterBackfillResult:
    """Per-importer backfill counts, logged and rolled up into the run total."""

    importer_id: str
    emails_scanned: int
    threads_created: int
    emails_reassigned: int


def _row_to_threadable(row: dict[str, Any]) -> ThreadableEmail:
    return ThreadableEmail(
        id=str(row["id"]),
        message_id=row.get("message_id"),
        in_reply_to=row.get("in_reply_to"),
        references_ids=tuple(row.get("references_ids") or []),
        subject=row.get("subject"),
        received_at=datetime.fromisoformat(row["received_at"]),
        body_text=row.get("body_text"),
        body_html=row.get("body_html"),
    )


async def _load_importer_ids(client: Client) -> list[str]:
    result = client.table("importers").select("id").execute()
    rows = cast("list[dict[str, Any]]", result.data)
    return sorted({str(row["id"]) for row in rows})


async def _load_importer_emails(client: Client, importer_id: str) -> dict[str, dict[str, Any]]:
    result = client.table("emails").select(_EMAIL_SELECT_COLUMNS).eq("importer_id", importer_id).execute()
    rows = cast("list[dict[str, Any]]", result.data)
    return {str(row["id"]): row for row in rows}


async def _create_thread(client: Client, *, importer_id: str, subject: str | None) -> str:
    result = client.table("threads").insert({"importer_id": importer_id, "subject": subject}).execute()
    row = cast("dict[str, Any]", result.data[0])
    return str(row["id"])


async def _assign_thread_to_emails(client: Client, *, importer_id: str, email_ids: list[str], thread_id: str) -> None:
    (
        client.table("emails")
        .update({"thread_id": thread_id})
        .eq("importer_id", importer_id)
        .in_("id", email_ids)
        .execute()
    )


async def _resolve_group_canonical(
    client: Client,
    *,
    importer_id: str,
    rows: dict[str, dict[str, Any]],
    member_ids: list[str],
    dry_run: bool,
) -> tuple[str, bool]:
    """Return (canonical_thread_id, was_newly_created) for one computed group."""
    existing_thread_ids = {str(rows[mid]["thread_id"]) for mid in member_ids if rows[mid].get("thread_id")}
    if existing_thread_ids:
        return min(existing_thread_ids), False

    if dry_run:
        return _DRY_RUN_NEW_THREAD_SENTINEL, True

    # Earliest member (group_emails sorts members by (received_at, id)) donates
    # its raw subject — the most "original" subject line in the group.
    anchor_subject = rows[member_ids[0]].get("subject")
    canonical = await _create_thread(client, importer_id=importer_id, subject=anchor_subject)
    return canonical, True


async def _backfill_importer(
    client: Client,
    importer_id: str,
    *,
    dry_run: bool,
    window: timedelta,
) -> ImporterBackfillResult:
    rows = await _load_importer_emails(client, importer_id)
    if not rows:
        return ImporterBackfillResult(importer_id=importer_id, emails_scanned=0, threads_created=0, emails_reassigned=0)

    emails = [_row_to_threadable(row) for row in rows.values()]
    groups = group_emails(emails, window=window)

    threads_created = 0
    emails_reassigned = 0

    for group in groups:
        member_ids = list(group)
        canonical, was_created = await _resolve_group_canonical(
            client, importer_id=importer_id, rows=rows, member_ids=member_ids, dry_run=dry_run
        )
        if was_created:
            threads_created += 1

        ids_needing_update = [mid for mid in member_ids if str(rows[mid].get("thread_id") or "") != canonical]
        emails_reassigned += len(ids_needing_update)

        if ids_needing_update and not dry_run:
            await _assign_thread_to_emails(
                client, importer_id=importer_id, email_ids=ids_needing_update, thread_id=canonical
            )

    return ImporterBackfillResult(
        importer_id=importer_id,
        emails_scanned=len(emails),
        threads_created=threads_created,
        emails_reassigned=emails_reassigned,
    )


async def run_backfill(*, dry_run: bool) -> list[ImporterBackfillResult]:
    """Run the backfill across every importer; returns per-importer results."""
    client = get_supabase_client()
    importer_ids = await _load_importer_ids(client)

    results: list[ImporterBackfillResult] = []
    for importer_id in importer_ids:
        result = await _backfill_importer(client, importer_id, dry_run=dry_run, window=DEFAULT_TIER2_WINDOW)
        results.append(result)
        logger.info(
            "backfill_importer_complete",
            importer_id=importer_id,
            dry_run=dry_run,
            emails_scanned=result.emails_scanned,
            threads_created=result.threads_created,
            emails_reassigned=result.emails_reassigned,
        )

    return results


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Idempotent thread backfill over existing emails (THRD-01).")
    parser.add_argument("--dry-run", action="store_true", help="Log intended changes without writing to the database.")
    return parser.parse_args()


def main() -> None:
    """CLI entry point for the thread backfill."""
    logging.basicConfig(level=logging.INFO)
    args = _parse_args()

    results = asyncio.run(run_backfill(dry_run=args.dry_run))

    total_scanned = sum(r.emails_scanned for r in results)
    total_created = sum(r.threads_created for r in results)
    total_reassigned = sum(r.emails_reassigned for r in results)
    logger.info(
        "backfill_complete",
        dry_run=args.dry_run,
        importers_scanned=len(results),
        emails_scanned=total_scanned,
        threads_created=total_created,
        emails_reassigned=total_reassigned,
    )
    mode = "DRY RUN — no writes" if args.dry_run else "APPLIED"
    print(
        f"Thread backfill complete ({mode}): {len(results)} importers, "
        f"{total_scanned} emails scanned, {total_created} threads created, "
        f"{total_reassigned} emails reassigned."
    )


if __name__ == "__main__":
    main()
