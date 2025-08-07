from fastapi import APIRouter, status
from datetime import datetime
from typing import Dict, Any

router = APIRouter()

@router.get("/", status_code=status.HTTP_200_OK)
async def health_check() -> Dict[str, Any]:
    """Basic health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "targetvision-api"
    }

@router.get("/ready", status_code=status.HTTP_200_OK)
async def readiness_check() -> Dict[str, Any]:
    """Readiness check for deployment verification"""
    # TODO: Add database connection check
    # TODO: Add Redis connection check
    return {
        "status": "ready",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {
            "database": "pending",
            "redis": "pending",
            "storage": "ready"
        }
    }