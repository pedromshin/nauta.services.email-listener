"""
Health check endpoints.

/health       -- liveness probe (always 200)
/health/ready -- readiness probe (no critical dependencies yet)
"""

from __future__ import annotations

from fastapi import APIRouter

from app.presentation.api.response import ApiResponse

router = APIRouter(tags=["health"])


@router.get("/health")
async def liveness() -> ApiResponse[dict[str, str]]:
    """Liveness probe -- always returns 200."""
    return ApiResponse.ok({"status": "alive"})


@router.get("/health/ready")
async def readiness() -> ApiResponse[dict[str, str]]:
    """Readiness probe -- will check dependencies once persistence is added."""
    return ApiResponse.ok({"status": "ready"})
