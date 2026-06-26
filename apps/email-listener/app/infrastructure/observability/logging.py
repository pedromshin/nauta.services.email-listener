"""structlog configuration — console output in dev, JSON in staging/production."""

from __future__ import annotations

import logging
import sys

import structlog


def setup_logging(environment: str, log_level: str = "INFO", log_json: bool = False) -> None:
    """Configure structlog and stdlib logging for the given environment."""
    level = getattr(logging, log_level.upper(), logging.INFO)

    # Force UTF-8 on stdout so logging never crashes on non-latin1 content (e.g.
    # garbled OCR text in an exc_info traceback). On a default Windows console
    # stdout is cp1252; a best-effort handler that logs such content would raise
    # UnicodeEncodeError and defeat the swallow. No-op on Linux (already UTF-8).
    reconfigure = getattr(sys.stdout, "reconfigure", None)
    if callable(reconfigure):
        reconfigure(encoding="utf-8", errors="replace")

    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=level)

    # pdfminer emits per-token DEBUG noise that floods stdout; keep it quiet regardless of app level
    logging.getLogger("pdfminer").setLevel(logging.WARNING)

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    renderer: structlog.types.Processor
    if log_json or environment in ("staging", "production"):
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=[*shared_processors, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
