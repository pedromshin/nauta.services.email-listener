"""EmbeddingProtocol port — domain abstraction over text embedding generation.

Implementations must return a tuple[float, ...] of the model's output
dimensionality (1536 for Amazon Titan Text Embeddings V2).
"""

from __future__ import annotations

from typing import Protocol


class EmbeddingProtocol(Protocol):
    """Port for text-to-vector embedding generation."""

    async def embed(self, *, text: str) -> tuple[float, ...]:
        """Embed text and return a float vector of fixed dimensionality.

        Returns a tuple (not a list) — downstream code should not mutate it.
        On total failure, implementations return a zero-vector of the correct
        length so callers don't have to handle None.
        """
        ...
