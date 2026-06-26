"""Anthropic client factory — AWS Bedrock transport.

Authentication is handled by the ambient ECS task IAM role
(bedrock:InvokeModel permission). No API key is read or required.
"""

from __future__ import annotations

from functools import lru_cache

from anthropic import AsyncAnthropicBedrock

from app.settings import get_settings


@lru_cache
def get_anthropic_client() -> AsyncAnthropicBedrock:
    """Return a cached AsyncAnthropicBedrock client.

    The client authenticates via the ECS task IAM role's
    bedrock:InvokeModel permission -- no api_key is set.
    """
    settings = get_settings()
    return AsyncAnthropicBedrock(aws_region=settings.bedrock_region)
