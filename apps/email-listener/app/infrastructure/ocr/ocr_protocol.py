"""OCRProtocol — seam for swappable OCR engines (Textract, Tesseract, etc.)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class OcrWord:
    """A single word returned by an OCR engine.

    bbox is (left, top, width, height) all normalized to 0-1 relative to
    the page/image dimensions, matching AWS Textract BoundingBox layout.
    """

    text: str
    bbox: tuple[float, float, float, float]


class OCRProtocol(Protocol):
    """Async protocol for single-page OCR.

    Concrete implementations (TextractOcrAdapter, TesseractAdapter, …) must
    satisfy this interface so PdfParser never depends on a specific engine.
    """

    async def ocr_page(self, *, image_bytes: bytes) -> list[OcrWord]:
        """OCR a single page rendered as an image and return word tokens."""
        ...
