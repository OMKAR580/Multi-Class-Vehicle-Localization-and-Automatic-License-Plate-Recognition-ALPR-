"""Dashboard analytics and activity endpoints."""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.dashboard import DashboardActivityResponse, DashboardStatsResponse
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/stats",
    response_model=DashboardStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Aggregated Dashboard Statistics",
    description="""
Fetch aggregated recognition metrics and counts for the authenticated user.

### Requirements & Behavior:
- **Authentication**: Requires a valid JWT Bearer token in the `Authorization` header (`Authorization: Bearer <token>`).
- **User Scoping**: Metrics exclusively count records owned by the authenticated user.
- **Aggregates**:
  - `total_jobs`: Total recognition jobs owned by the user.
  - `completed_jobs`, `failed_jobs`, `pending_jobs`, `processing_jobs`: Counts grouped by execution status.
  - `total_vehicles_detected`: Total persisted vehicles across user's jobs (Cartesian-free count).
  - `total_plates_detected`: Total persisted plates across user's jobs.
  - `recognized_plates`: Total plates with non-empty recognized text.
  - `image_jobs`, `video_jobs`: Counts grouped by media type.
  - `success_rate`: Percentage of completed jobs over terminal jobs (`completed / (completed + failed) * 100`).
- **Date Filtering**: Optional `start_date` and `end_date` parameters. Reverses or invalid formats return 422.
    """,
    responses={
        200: {"description": "Dashboard statistics retrieved successfully."},
        401: {"description": "Authentication credentials missing or invalid."},
        422: {"description": "Validation error (invalid date format or reversed date range)."},
    },
)
async def get_dashboard_stats(
    start_date: Optional[datetime] = Query(default=None, description="Filter records starting from this timestamp (inclusive)."),
    end_date: Optional[datetime] = Query(default=None, description="Filter records up to this timestamp (inclusive)."),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardStatsResponse:
    """Retrieve authenticated user's aggregated dashboard statistics."""
    service = DashboardService(db=db)
    return await service.get_dashboard_stats(
        current_user=current_user,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/activity",
    response_model=DashboardActivityResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Recent Recognition Activity",
    description="""
Fetch paginated list of recent recognition jobs for the authenticated user, ordered newest first.

### Requirements & Behavior:
- **Authentication**: Requires a valid JWT Bearer token in the `Authorization` header.
- **Pagination**: Supports 1-indexed `page` and `page_size` parameters (max 100 per page).
- **Ordering**: Deterministic descending sort (`created_at.desc(), id.desc()`).
- **Date Filtering**: Optional `start_date` and `end_date` parameters.
- **Privacy**: Does not leak internal storage paths or other users' activity.
    """,
    responses={
        200: {"description": "Recent activity retrieved successfully."},
        401: {"description": "Authentication credentials missing or invalid."},
        422: {"description": "Validation error (invalid pagination parameters or reversed date range)."},
    },
)
async def get_dashboard_activity(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)."),
    page_size: int = Query(default=10, ge=1, le=100, description="Items per page."),
    start_date: Optional[datetime] = Query(default=None, description="Filter records starting from this timestamp (inclusive)."),
    end_date: Optional[datetime] = Query(default=None, description="Filter records up to this timestamp (inclusive)."),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardActivityResponse:
    """Retrieve authenticated user's recent recognition activity."""
    service = DashboardService(db=db)
    return await service.get_dashboard_activity(
        current_user=current_user,
        page=page,
        page_size=page_size,
        start_date=start_date,
        end_date=end_date,
    )
