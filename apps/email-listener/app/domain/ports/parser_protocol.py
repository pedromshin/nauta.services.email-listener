"""ParserProtocol — format-agnostic seam for attachment parsing (D-10)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from app.domain.entities.component import Component


class ParserProtocol(Protocol):
    """Async protocol for parsing attachment bytes into domain Components.

    Each concrete implementation (PDF, XLSX, etc.) registers behind this
    interface. The application layer depends only on this Protocol — never
    on the infrastructure implementations directly.
    """

    async def parse(
        self,
        *,
        file_bytes: bytes,
        content_type: str,
        attachment_id: str,
    ) -> list[Component]:
        """Parse attachment bytes and return a list of extracted Components."""
        ...
