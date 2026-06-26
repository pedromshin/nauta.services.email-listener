"""SegmenterProtocol port -- domain abstraction over LLM segmentation.

Keeps the application layer free of Anthropic / Bedrock specifics.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class PageToken:
    """A coordinate-bearing token (word or line) handed to the segmenter.

    index: 0-based position in the page's token list — what the model selects.
    text: the token's text.
    bbox: (left, top, width, height) normalized 0-1, top-left origin
        (matches the 04-13 content_raw token layout, shared with OcrWord).
    """

    index: int
    text: str
    bbox: tuple[float, float, float, float]


@dataclass(frozen=True)
class ProposedRegion:
    """A candidate entity region proposed by the LLM segmentation pass.

    Produced by AnthropicSegmenter; consumed by ProposeRegionsUseCase to
    create child Component rows that a human can later accept, redraw,
    split, merge, or reject (D-09).

    The model selects which page tokens belong to the region (token_indices);
    ProposeRegionsUseCase computes the region polygon as the union of those
    tokens' real bboxes — the geometry is grounded in document coordinates,
    NOT invented by the model (04-14).
    """

    content_text: str
    token_indices: tuple[int, ...]
    entity_type_hint: str | None
    parent_index: int | None
    page_index: int


class SegmenterProtocol(Protocol):
    """Port for LLM-based entity-region segmentation."""

    async def segment(self, *, tokens: tuple[PageToken, ...], page_index: int) -> list[ProposedRegion]:
        """Return candidate entity regions for the given page tokens.

        Each region carries the indices of the tokens the model assigned to it
        (token_indices), so the caller can ground the region polygon in real
        coordinates. Must never raise -- returns [] on junk content or model errors.
        """
        ...
