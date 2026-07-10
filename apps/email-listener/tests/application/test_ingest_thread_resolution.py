"""Tests for IngestInboundEmailUseCase's ThreadResolver wiring (Phase 45, THRD-01).

Uses a fake ThreadResolver — no real Supabase adapter — to prove: the saved
Email carries the resolver's returned thread_id; a resolver exception leaves
thread_id=None and does NOT raise; redelivery calls resolve() with a stable
message_id/importer_id pair.
"""

from __future__ import annotations

import asyncio
from email.message import EmailMessage
from unittest.mock import AsyncMock, MagicMock

from app.application.use_cases.ingest_inbound_email import IngestInboundEmailUseCase, IngestionConfig
from app.domain.entities.email import Email

IMPORTER_ID = "imp-default"
SES_MESSAGE_ID = "ses-abc-123"
THREAD_ID = "thread-xyz-789"


def _raw_email() -> bytes:
    msg = EmailMessage()
    msg["From"] = "Maria <maria@exporter.com>"
    msg["To"] = "agent@magnitudetech.com.br"
    msg["Subject"] = "Docs"
    msg["Date"] = "Wed, 10 Jun 2026 14:30:00 +0000"
    msg["Message-ID"] = "<mime-001@exporter.com>"
    msg["In-Reply-To"] = "<parent@exporter.com>"
    msg.set_content("see attached")
    return bytes(msg)


def _make_use_case(
    *,
    thread_resolver: MagicMock,
    existing_email: Email | None = None,
) -> tuple[IngestInboundEmailUseCase, dict[str, MagicMock]]:
    raw_store = MagicMock()
    raw_store.fetch = AsyncMock(return_value=_raw_email())
    raw_store.key_for.return_value = f"inbound/local/{SES_MESSAGE_ID}"

    email_repo = MagicMock()
    email_repo.find_by_message_id = AsyncMock(return_value=existing_email)
    email_repo.save = AsyncMock(side_effect=lambda email: email)

    attachment_repo = MagicMock()
    attachment_repo.save = AsyncMock(side_effect=lambda att: att)

    attachment_storage = MagicMock()
    attachment_storage.store = AsyncMock()

    components = MagicMock()
    components.save_many = AsyncMock(side_effect=lambda cs: cs)
    components.find_by_email_id = AsyncMock(return_value=[])

    parser_registry = MagicMock(return_value=None)

    propose_regions = MagicMock()
    propose_regions.execute = AsyncMock(return_value=[])

    importer_resolver = MagicMock()
    importer_resolver.resolve = AsyncMock(return_value=IMPORTER_ID)

    use_case = IngestInboundEmailUseCase(
        raw_store=raw_store,
        email_repo=email_repo,
        attachment_repo=attachment_repo,
        attachment_storage=attachment_storage,
        config=IngestionConfig(default_importer_id=IMPORTER_ID),
        components=components,
        parser_registry=parser_registry,
        propose_regions=propose_regions,
        importer_resolver=importer_resolver,
        thread_resolver=thread_resolver,
    )
    mocks: dict[str, MagicMock] = {
        "raw_store": raw_store,
        "email_repo": email_repo,
        "attachment_repo": attachment_repo,
        "importer_resolver": importer_resolver,
        "thread_resolver": thread_resolver,
    }
    return use_case, mocks


# ---------------------------------------------------------------------------
# Happy path — saved Email carries the resolver's returned thread_id.
# ---------------------------------------------------------------------------


def test_saved_email_carries_resolved_thread_id() -> None:
    thread_resolver = MagicMock()
    thread_resolver.resolve = AsyncMock(return_value=THREAD_ID)

    use_case, mocks = _make_use_case(thread_resolver=thread_resolver)
    email = asyncio.run(use_case.execute(SES_MESSAGE_ID))

    assert email.thread_id == THREAD_ID
    mocks["thread_resolver"].resolve.assert_awaited_once()
    call_kwargs = mocks["thread_resolver"].resolve.await_args.kwargs
    assert call_kwargs["importer_id"] == IMPORTER_ID
    assert call_kwargs["message_id"] == "<mime-001@exporter.com>"
    assert call_kwargs["in_reply_to"] == "<parent@exporter.com>"


def test_thread_resolver_called_after_importer_resolved() -> None:
    """resolve() is called with the importer_resolver's OUTPUT, not the raw sender."""
    thread_resolver = MagicMock()
    thread_resolver.resolve = AsyncMock(return_value=THREAD_ID)

    resolved_importer_id = "resolved-importer-999"
    use_case, mocks = _make_use_case(thread_resolver=thread_resolver)
    mocks["importer_resolver"].resolve = AsyncMock(return_value=resolved_importer_id)

    email = asyncio.run(use_case.execute(SES_MESSAGE_ID))

    assert email.importer_id == resolved_importer_id
    call_kwargs = mocks["thread_resolver"].resolve.await_args.kwargs
    assert call_kwargs["importer_id"] == resolved_importer_id


# ---------------------------------------------------------------------------
# Failure path — a ThreadResolver exception must NOT fail ingestion (T-45-03-02).
# ---------------------------------------------------------------------------


def test_thread_resolver_exception_leaves_thread_id_none_and_does_not_raise() -> None:
    thread_resolver = MagicMock()
    thread_resolver.resolve = AsyncMock(side_effect=RuntimeError("thread resolution boom"))

    use_case, mocks = _make_use_case(thread_resolver=thread_resolver)

    # Must not raise.
    email = asyncio.run(use_case.execute(SES_MESSAGE_ID))

    assert email is not None
    assert email.thread_id is None
    mocks["email_repo"].save.assert_awaited_once()


# ---------------------------------------------------------------------------
# Redelivery — idempotent stable thread_id across a second ingest of the same email.
# ---------------------------------------------------------------------------


def test_redelivery_resolves_thread_with_same_message_id() -> None:
    """Re-ingesting the same (importer_id, message_id) calls resolve() with a stable message_id.

    A real ThreadResolver finds the email's own existing thread first on
    redelivery (SupabaseThreadRepository's forward/backward Tier 0 search
    over its own message_id neighbors) — this test proves the use case
    passes the SAME message_id both times, which is what makes that
    stability possible.
    """
    thread_resolver_first = MagicMock()
    thread_resolver_first.resolve = AsyncMock(return_value=THREAD_ID)
    use_case_first, _ = _make_use_case(thread_resolver=thread_resolver_first)
    first = asyncio.run(use_case_first.execute(SES_MESSAGE_ID))

    thread_resolver_second = MagicMock()
    thread_resolver_second.resolve = AsyncMock(return_value=THREAD_ID)
    use_case_second, mocks_second = _make_use_case(thread_resolver=thread_resolver_second, existing_email=first)
    second = asyncio.run(use_case_second.execute(SES_MESSAGE_ID))

    first_call_kwargs = thread_resolver_first.resolve.await_args.kwargs
    second_call_kwargs = mocks_second["thread_resolver"].resolve.await_args.kwargs
    assert first_call_kwargs["message_id"] == second_call_kwargs["message_id"] == "<mime-001@exporter.com>"
    assert second.thread_id == first.thread_id == THREAD_ID
    assert second.id == first.id
