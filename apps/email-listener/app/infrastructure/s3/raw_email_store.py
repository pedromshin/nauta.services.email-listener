"""S3RawEmailStore — implements RawEmailStore port.

SES writes raw MIME to s3://{bucket}/{prefix}{sesMessageId}. Auth is the
default boto3 credential chain (ECS task IAM role in staging/prod, local
AWS profile in development) — no static keys.
"""

from __future__ import annotations

from typing import Any


class S3RawEmailStore:
    """Fetches raw inbound email bytes from the SES S3 inbound bucket."""

    def __init__(self, bucket: str, prefix: str, client: Any) -> None:
        self._bucket = bucket
        self._prefix = prefix
        self._client = client

    def key_for(self, message_id: str) -> str:
        """Return the S3 object key for the given SES message id."""
        return f"{self._prefix}{message_id}"

    async def fetch(self, message_id: str) -> bytes:
        """Download and return the raw MIME bytes for the given SES message id."""
        response = self._client.get_object(Bucket=self._bucket, Key=self.key_for(message_id))
        body: bytes = response["Body"].read()
        return body
