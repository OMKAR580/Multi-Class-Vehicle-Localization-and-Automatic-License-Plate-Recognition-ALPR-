"""Traffic & Recognition Analytics API endpoints."""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.analytics import AnalyticsOverviewResponse
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get(
    "/overview",
    response_model=AnalyticsOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Consolidated Traffic & Recognition Analytics Overview",
    description="""
Fetch database-persisted analytics intelligence, KPI summaries, historical trends, vehicle class breakdown,
license plate recognition rates, image vs video telemetry, latency distributions, and time patterns for the authenticated user.

### Requirements & Behavior:
- **Authentication**: Requires a valid JWT Bearer token in the `Authorization` header.
- **User Scoping**: Metrics exclusively aggregate records owned by the authenticated user.
- **Filters**: Supports filtering by date range (or days preset), media category ('image'/'video'), and status.
    """,
    responses={
        200: {"description": "Analytics overview retrieved successfully."},
        401: {"description": "Authentication credentials missing or invalid."},
    },
)
async def get_analytics_overview(
    days: Optional[int] = Query(default=30, ge=1, le=365, description="Day span preset (default 30)."),
    start_date: Optional[datetime] = Query(default=None, description="Optional inclusive start datetime (ISO-8601)."),
    end_date: Optional[datetime] = Query(default=None, description="Optional inclusive end datetime (ISO-8601)."),
    media_type: Optional[str] = Query(default=None, description="Filter by media category ('image' or 'video')."),
    job_status: Optional[str] = Query(default=None, alias="status", description="Filter by status ('COMPLETED', 'FAILED')."),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnalyticsOverviewResponse:
    """Retrieve authenticated user's operational recognition analytics."""
    service = AnalyticsService(db=db)
    return await service.get_analytics_overview(
        current_user=current_user,
        days=days,
        start_date=start_date,
        end_date=end_date,
        media_type=media_type,
        status=job_status,
    )

