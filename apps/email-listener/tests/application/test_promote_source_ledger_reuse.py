"""Promotion-gate reuse proof for chat_source_ledger (Phase 56-05, RCNV-01 seam).

Two sections, one per task of the plan:

1. Adapter tests (`SupabaseSourceLedgerRepository.set_knowledge_node_id`, call-shape
   via MagicMock, no live DB -- mirrors test_run_chat_turn_source_ledger.py's
   adapter-test convention): a single parameterized update against
   chat_source_ledger.knowledge_node_id, and a missing row never raises.

2. The reuse proof (`PromoteSourceLedgerEntryUseCase`, mirrors
   test_source_capture_promote_reuse.py's CLUS-05 zero-diff pattern exactly):
   a captured chat_source_ledger row is reshaped into the exact source_payload
   shape the UNCHANGED `SourceCaptureHandler.execute()` already accepts, called
   verbatim, and on success the node id is back-referenced onto the ledger row.
   This file adds ZERO new production promotion code -- see the git diff --stat
   assertion below (confirm_action_dispatch.py / promote_edge.py unchanged).
   (Landed in a follow-up edit of this same file, once the use case exists.)
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

from app.infrastructure.supabase.source_ledger_repository import SupabaseSourceLedgerRepository

_LEDGER_ENTRY_ID = "ledger-1"

# ---------------------------------------------------------------------------
# Task 1: set_knowledge_node_id back-reference (adapter, call-shape via MagicMock)
# ---------------------------------------------------------------------------


def _make_update_chain_mock(execute_return: Any) -> MagicMock:
    chain = MagicMock()
    chain.update.return_value = chain
    chain.eq.return_value = chain
    chain.execute.return_value = execute_return
    return chain


@pytest.mark.unit
@pytest.mark.asyncio
async def test_adapter_set_knowledge_node_id_backref_issues_single_parameterized_update() -> None:
    execute_result = MagicMock()
    execute_result.data = [{"id": _LEDGER_ENTRY_ID, "knowledge_node_id": "node-1"}]
    chain = _make_update_chain_mock(execute_result)
    client = MagicMock()
    client.table.return_value = chain
    repo = SupabaseSourceLedgerRepository(client=client)

    await repo.set_knowledge_node_id(_LEDGER_ENTRY_ID, "node-1")

    client.table.assert_called_with("chat_source_ledger")
    chain.update.assert_called_once_with({"knowledge_node_id": "node-1"})
    chain.eq.assert_called_once_with("id", _LEDGER_ENTRY_ID)
    assert chain.execute.called


@pytest.mark.unit
@pytest.mark.asyncio
async def test_adapter_set_knowledge_node_id_backref_missing_row_does_not_raise() -> None:
    """update-by-id of an absent row simply affects zero rows -- never raises."""
    execute_result = MagicMock()
    execute_result.data = []  # zero rows matched
    chain = _make_update_chain_mock(execute_result)
    client = MagicMock()
    client.table.return_value = chain
    repo = SupabaseSourceLedgerRepository(client=client)

    await repo.set_knowledge_node_id("missing-id", "node-1")  # must not raise
