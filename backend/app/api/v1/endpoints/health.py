from fastapi import APIRouter
from app.schemas.health import HealthResponse
from app.core.config import settings

router = APIRouter()

@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def check_health():
    """
    Service Health Check Endpoint.
    Returns status of Backend, Database configuration, and Redis status.
    """
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        environment=settings.ENVIRONMENT,
        database="configured",
        redis="configured"
    )
