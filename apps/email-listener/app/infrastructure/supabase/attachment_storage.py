"""SupabaseAttachmentStorage — implements AttachmentStorage port.

Stores attachment bytes in a private Supabase Storage bucket. The bucket is
created lazily on first store (idempotent — creation errors for an existing
bucket are swallowed) so all environments work without manual provisioning.
"""

from __future__ import annotations

import structlog
from supabase import Client

logger = structlog.get_logger(__name__)


class SupabaseAttachmentStorage:
    """Supabase Storage implementation of AttachmentStorage."""

    def __init__(self, client: Client, bucket: str) -> None:
        self._client = client
        self._bucket = bucket
        self._bucket_ensured = False

    def _ensure_bucket(self) -> None:
        if self._bucket_ensured:
            return
        try:
            self._client.storage.create_bucket(self._bucket)
        except Exception:
            logger.debug("attachment_bucket_exists", bucket=self._bucket)
        self._bucket_ensured = True

    async def store(self, storage_key: str, data: bytes, content_type: str) -> None:
        """Upload attachment bytes (upsert — safe on SNS redelivery)."""
        self._ensure_bucket()
        self._client.storage.from_(self._bucket).upload(
            path=storage_key,
            file=data,
            file_options={"content-type": content_type, "upsert": "true"},
        )

    async def fetch(self, storage_key: str) -> bytes:
        """Download attachment bytes by storage key."""
        return self._client.storage.from_(self._bucket).download(storage_key)
