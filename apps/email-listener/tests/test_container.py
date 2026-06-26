"""Container resolution tests — verify DI wiring without a live Supabase connection."""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock, patch

from app.application.use_cases.ingest_inbound_email import IngestInboundEmailUseCase
from app.application.use_cases.propose_regions import ProposeRegionsUseCase
from app.container import create_container
from app.domain.ports.attachment_repository import AttachmentRepository
from app.domain.ports.attachment_storage import AttachmentStorage
from app.domain.ports.component_repository import ComponentRepository
from app.domain.ports.email_repository import EmailRepository
from app.domain.ports.entity_type_repository import EntityTypeRepository
from app.domain.ports.extraction_repository import ExtractionRepository
from app.domain.ports.raw_email_store import RawEmailStore
from app.domain.ports.segmenter_protocol import SegmenterProtocol
from app.infrastructure.llm.segmentation_adapter import AnthropicSegmenter
from app.infrastructure.pdf.pdf_parser import PdfParser
from app.infrastructure.s3.raw_email_store import S3RawEmailStore
from app.infrastructure.supabase.attachment_repository import SupabaseAttachmentRepository
from app.infrastructure.supabase.attachment_storage import SupabaseAttachmentStorage
from app.infrastructure.supabase.component_repository import SupabaseComponentRepository
from app.infrastructure.supabase.email_repository import SupabaseEmailRepository
from app.infrastructure.supabase.entity_type_repository import SupabaseEntityTypeRepository
from app.infrastructure.supabase.extraction_repository import SupabaseExtractionRepository

_PATCH_TARGET = "app.container.get_supabase_client"
_PATCH_ANTHROPIC = "app.container.get_anthropic_client"


def _patched_container() -> asyncio.coroutines:
    """Context manager that patches external clients for container tests."""
    import contextlib

    @contextlib.contextmanager
    def _ctx():
        with (
            patch(_PATCH_TARGET, return_value=MagicMock()),
            patch(_PATCH_ANTHROPIC, return_value=MagicMock()),
            patch("app.container.boto3") as boto3_mock,
        ):
            boto3_mock.client.return_value = MagicMock()
            yield

    return _ctx()


class TestContainerResolution:
    """Verify that each port resolves to the correct concrete adapter."""

    def test_email_repository_resolves_to_supabase_impl(self) -> None:
        with patch(_PATCH_TARGET, return_value=MagicMock()):
            container = create_container()
            repo = asyncio.run(container.get(EmailRepository))
            assert isinstance(repo, SupabaseEmailRepository)

    def test_attachment_repository_resolves_to_supabase_impl(self) -> None:
        with patch(_PATCH_TARGET, return_value=MagicMock()):
            container = create_container()
            repo = asyncio.run(container.get(AttachmentRepository))
            assert isinstance(repo, SupabaseAttachmentRepository)

    def test_component_repository_resolves_to_supabase_impl(self) -> None:
        with patch(_PATCH_TARGET, return_value=MagicMock()):
            container = create_container()
            repo = asyncio.run(container.get(ComponentRepository))
            assert isinstance(repo, SupabaseComponentRepository)

    def test_entity_type_repository_resolves_to_supabase_impl(self) -> None:
        with patch(_PATCH_TARGET, return_value=MagicMock()):
            container = create_container()
            repo = asyncio.run(container.get(EntityTypeRepository))
            assert isinstance(repo, SupabaseEntityTypeRepository)

    def test_extraction_repository_resolves_to_supabase_impl(self) -> None:
        with patch(_PATCH_TARGET, return_value=MagicMock()):
            container = create_container()
            repo = asyncio.run(container.get(ExtractionRepository))
            assert isinstance(repo, SupabaseExtractionRepository)

    def test_raw_email_store_resolves_to_s3_impl(self) -> None:
        with patch(_PATCH_TARGET, return_value=MagicMock()), patch("app.container.boto3") as boto3_mock:
            container = create_container()
            store = asyncio.run(container.get(RawEmailStore))
            assert isinstance(store, S3RawEmailStore)
            boto3_mock.client.assert_called()

    def test_attachment_storage_resolves_to_supabase_impl(self) -> None:
        with patch(_PATCH_TARGET, return_value=MagicMock()):
            container = create_container()
            storage = asyncio.run(container.get(AttachmentStorage))
            assert isinstance(storage, SupabaseAttachmentStorage)

    def test_ingest_use_case_resolves(self) -> None:
        with _patched_container():
            container = create_container()
            use_case = asyncio.run(container.get(IngestInboundEmailUseCase))
            assert isinstance(use_case, IngestInboundEmailUseCase)

    def test_segmenter_resolves_to_anthropic_impl(self) -> None:
        with _patched_container():
            container = create_container()
            segmenter = asyncio.run(container.get(SegmenterProtocol))
            assert isinstance(segmenter, AnthropicSegmenter)

    def test_propose_regions_use_case_resolves(self) -> None:
        with _patched_container():
            container = create_container()
            use_case = asyncio.run(container.get(ProposeRegionsUseCase))
            assert isinstance(use_case, ProposeRegionsUseCase)

    def test_parser_registry_returns_pdf_parser_for_pdf_ext(self) -> None:
        """The registry callable must return a PdfParser for 'pdf' extension."""
        from app.domain.ports.parser_registry_port import ParserRegistryPort

        with _patched_container():
            container = create_container()
            registry = asyncio.run(container.get(ParserRegistryPort))
            parser = registry("pdf")
            assert isinstance(parser, PdfParser)

    def test_parser_registry_returns_none_for_unknown_ext(self) -> None:
        from app.domain.ports.parser_registry_port import ParserRegistryPort

        with _patched_container():
            container = create_container()
            registry = asyncio.run(container.get(ParserRegistryPort))
            result = registry("docx")
            assert result is None
