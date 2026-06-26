"""Parser registry — maps file extensions to ParserProtocol implementations.

Module-level registry. Call register() once at DI-container setup time.
get_parser() is the ParserRegistryPort callable.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.domain.ports.parser_protocol import ParserProtocol


class UnsupportedFileTypeError(ValueError):
    """Raised when a file extension has no registered parser or a duplicate
    registration is attempted."""


_REGISTRY: dict[str, ParserProtocol] = {}


def register(file_ext: str, parser: ParserProtocol) -> None:
    """Register *parser* for *file_ext* (case-insensitive).

    Raises UnsupportedFileTypeError if the extension is already registered.
    """
    key = file_ext.lower()
    if key in _REGISTRY:
        raise UnsupportedFileTypeError(
            f"A parser is already registered for '{key}'. Deregister it first or use a different extension."
        )
    _REGISTRY[key] = parser


def get_parser(file_ext: str) -> ParserProtocol | None:
    """Return the parser registered for *file_ext*, or None if absent."""
    return _REGISTRY.get(file_ext.lower())
