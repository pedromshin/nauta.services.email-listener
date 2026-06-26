"""AWS Textract OCR adapter implementing OCRProtocol.

Wraps the synchronous boto3 textract.detect_document_text call in a
ThreadPoolExecutor so the async caller never blocks the event loop.

AWS Textract already returns bounding boxes normalized to 0-1, so no
coordinate transformation is needed.
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import structlog

from app.infrastructure.ocr.ocr_protocol import OcrWord

logger = structlog.get_logger(__name__)


class TextractOcrAdapter:
    """OCR adapter that delegates to AWS Textract DetectDocumentText.

    Usage:
        import boto3
        client = boto3.client("textract", region_name=os.environ["AWS_TEXTRACT_REGION"])
        adapter = TextractOcrAdapter(client=client)
        words = await adapter.ocr_page(image_bytes=...)
    """

    def __init__(
        self,
        *,
        client: Any,
        max_workers: int = 1,
    ) -> None:
        self._client = client
        self._executor = ThreadPoolExecutor(max_workers=max_workers)

    def _sync_detect(self, image_bytes: bytes) -> list[OcrWord]:
        """Call Textract synchronously; parse WORD blocks into OcrWord list."""
        response: dict[str, Any] = self._client.detect_document_text(Document={"Bytes": image_bytes})
        words: list[OcrWord] = []
        for block in response.get("Blocks", []):
            if block.get("BlockType") != "WORD":
                continue
            text: str = block.get("Text", "")
            bbox_raw: dict[str, float] = block.get("Geometry", {}).get("BoundingBox", {})
            bbox = (
                float(bbox_raw.get("Left", 0.0)),
                float(bbox_raw.get("Top", 0.0)),
                float(bbox_raw.get("Width", 0.0)),
                float(bbox_raw.get("Height", 0.0)),
            )
            words.append(OcrWord(text=text, bbox=bbox))
        return words

    async def ocr_page(self, *, image_bytes: bytes) -> list[OcrWord]:
        """Run Textract OCR on *image_bytes* and return a list of OcrWord tokens."""
        loop = asyncio.get_event_loop()
        try:
            words = await loop.run_in_executor(self._executor, self._sync_detect, image_bytes)
        except Exception:
            logger.warning("textract_ocr_failed", image_size=len(image_bytes))
            return []
        return words
