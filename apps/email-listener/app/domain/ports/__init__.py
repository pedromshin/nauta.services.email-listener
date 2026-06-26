"""Domain ports — repository protocols and parser seams."""

from __future__ import annotations

from app.domain.ports.attachment_repository import AttachmentRepository
from app.domain.ports.component_repository import ComponentRepository
from app.domain.ports.email_repository import EmailRepository
from app.domain.ports.entity_type_repository import EntityTypeRepository
from app.domain.ports.extraction_repository import ExtractionRepository
from app.domain.ports.parser_protocol import ParserProtocol
from app.domain.ports.parser_registry_port import ParserRegistryPort

__all__ = [
    "AttachmentRepository",
    "ComponentRepository",
    "EmailRepository",
    "EntityTypeRepository",
    "ExtractionRepository",
    "ParserProtocol",
    "ParserRegistryPort",
]
