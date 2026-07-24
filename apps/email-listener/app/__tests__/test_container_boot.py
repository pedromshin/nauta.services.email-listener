"""Container boot smoke test — the safety net for the container.py decomposition (Track 2).

`create_container()` wires ~60 dishka providers in one module. Before this test the only
boot coverage (test_anticipatory_judge_adapter.py) resolved 3 providers, so a broken or
dropped binding in the other ~57 would ship silently. This test resolves EVERY major
top-level provider — each a use case with deep fan-in — so the transitive closure of the
resolution exercises nearly the entire graph. It is the gate that makes it safe to split
container.py into grouped provider modules: any binding lost in the move fails here loudly.

Clients are patched with mocks (no Supabase/AWS/network), mirroring the existing boot test:
the adapter constructors only store their client, so a MagicMock resolves the whole graph.
"""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock, patch

import pytest

from app.application.use_cases.autofill import AutofillUseCase
from app.application.use_cases.autofill_fields import AutofillFieldsUseCase
from app.application.use_cases.backfill_entity_identities import BackfillEntityIdentitiesUseCase
from app.application.use_cases.backfill_inbound_email import BackfillInboundEmailUseCase
from app.application.use_cases.confirm_region import ConfirmRegionUseCase
from app.application.use_cases.evaluate_anticipatory_candidates import EvaluateAnticipatoryCandidates
from app.application.use_cases.generate_code_island import GenerateCodeIslandUseCase
from app.application.use_cases.generate_ui_spec import GenerateUiSpecUseCase
from app.application.use_cases.ingest_inbound_email import IngestInboundEmailUseCase
from app.application.use_cases.pipeline_health import GetPipelineHealthUseCase
from app.application.use_cases.promote_edge import PromoteEdgeUseCase
from app.application.use_cases.promote_entity_on_confirm import PromoteEntityOnConfirmUseCase
from app.application.use_cases.promote_source_ledger_entry import PromoteSourceLedgerEntryUseCase
from app.application.use_cases.receive_inbound_email import ReceiveInboundEmailUseCase
from app.application.use_cases.reprocess_email import ReprocessEmailUseCase
from app.application.use_cases.resolve_entity_candidates import ResolveEntityCandidatesUseCase
from app.application.use_cases.resolve_retheme import ResolveRethemeUseCase
from app.application.use_cases.run_chat_turn import RunChatTurn
from app.application.use_cases.submit_widget_interaction import SubmitWidgetInteraction
from app.container import create_container

# Major top-level providers. Resolving each pulls in its transitive deps, so this list's
# closure spans essentially every binding in _build_provider(). Keep it broad on purpose.
_TOP_LEVEL_PROVIDERS = (
    ReceiveInboundEmailUseCase,
    IngestInboundEmailUseCase,
    ReprocessEmailUseCase,
    BackfillInboundEmailUseCase,
    GetPipelineHealthUseCase,
    AutofillUseCase,
    AutofillFieldsUseCase,
    ConfirmRegionUseCase,
    PromoteEntityOnConfirmUseCase,
    PromoteEdgeUseCase,
    PromoteSourceLedgerEntryUseCase,
    ResolveEntityCandidatesUseCase,
    BackfillEntityIdentitiesUseCase,
    GenerateUiSpecUseCase,
    GenerateCodeIslandUseCase,
    ResolveRethemeUseCase,
    RunChatTurn,
    SubmitWidgetInteraction,
    EvaluateAnticipatoryCandidates,
)


@pytest.mark.unit
def test_container_resolves_every_major_provider() -> None:
    """create_container() boots and resolves all major top-level use cases under mocked clients."""
    with (
        patch("app.container.get_supabase_client", return_value=MagicMock()),
        patch("app.container.get_anthropic_client", return_value=MagicMock()),
        patch("app.container.boto3") as boto3_mock,
    ):
        boto3_mock.client.return_value = MagicMock()
        container = create_container()

        async def _resolve_all() -> None:
            for provider_type in _TOP_LEVEL_PROVIDERS:
                instance = await container.get(provider_type)
                assert instance is not None, f"{provider_type.__name__} resolved to None"
                assert isinstance(instance, provider_type), (
                    f"{provider_type.__name__} resolved to {type(instance).__name__}"
                )
            await container.close()

        asyncio.run(_resolve_all())
