"""ParserRegistryPort — callable type alias for parser dispatch (D-10).

The application layer (DecomposeEmailUseCase) depends on this type alias
to look up parsers by file extension. It is a plain callable — not a class —
so the application layer imports zero infrastructure modules.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.domain.ports.parser_protocol import ParserProtocol

# Type alias: maps file_ext (str) to a ParserProtocol implementation or None.
# Infrastructure wires a concrete get_parser function that satisfies this type.
ParserRegistryPort = Callable[["str"], "ParserProtocol | None"]
