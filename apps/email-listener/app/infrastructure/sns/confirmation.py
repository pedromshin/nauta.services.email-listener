"""SNS subscription confirmation helper."""

from __future__ import annotations

import httpx
import structlog

logger = structlog.get_logger(__name__)


async def confirm_subscription(subscribe_url: str) -> None:
    """GET the SubscribeURL to confirm an SNS HTTP subscription."""
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(subscribe_url)
        response.raise_for_status()
    logger.info("sns_subscription_confirmed", url=subscribe_url)
