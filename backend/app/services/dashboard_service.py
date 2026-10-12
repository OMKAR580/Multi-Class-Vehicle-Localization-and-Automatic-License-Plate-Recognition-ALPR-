"""Dashboard service coordinating analytics aggregation, activity formatting, and date validation."""

import math
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.dashboard_repository import DashboardRepository
from app.schemas.dashboard import (
    DashboardActivityItem,
    DashboardActivityResponse,
    DashboardStatsResponse,
)


def validate_date_range(start_date: Optional[datetime], end_date: Optional[datetime]) -> None:
    """
    Validates that start_date does not exceed end_date. Raises HTTP 422 on reversed range.

    Args:
        start_date: Filter start timestamp.
        end_date: Filter end timestamp.
    """
    if start_date is not None and end_date is not None:
        # Normalize timezone offsets for comparison
        sd = start_date if start_date.tzinfo else start_date.replace(tzinfo=timezone.utc)
        ed = end_date if end_date.tzinfo else end_date.replace(tzinfo=timezone.utc)
        if sd > ed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="start_date cannot be after end_date.",
            )


class DashboardService:
    """Service providing dashboard statistics and activity summaries for authenticated users."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = DashboardRepository(db)

    async def get_dashboard_stats(
        self,
        current_user: User,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> DashboardStatsResponse:
        """
        Retrieves user-scoped aggregate statistics.

        Args:
            current_user: Authenticated User entity.
            start_date: Optional filter start timestamp.
            end_date: Optional filter end timestamp.

        Returns:
            DashboardStatsResponse with calculated metrics.
        """
        validate_date_range(start_date, end_date)
        raw_stats = await self.repo.get_aggregated_stats(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
        )
        return DashboardStatsResponse(**raw_stats)

    async def get_dashboard_activity(
        self,
        current_user: User,
        page: int = 1,
        page_size: int = 10,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> DashboardActivityResponse:
        """
        Retrieves user-scoped paginated recent recognition activity.

        Args:
            current_user: Authenticated User entity.
            page: 1-indexed page number.
            page_size: Number of items per page.
            start_date: Optional filter start timestamp.
            end_date: Optional filter end timestamp.

        Returns:
            DashboardActivityResponse containing paginated activity items.
        """
        validate_date_range(start_date, end_date)
        jobs, total = await self.repo.get_recent_activity(
            user_id=current_user.id,
            page=page,
            page_size=page_size,
            start_date=start_date,
            end_date=end_date,
        )

        items: list[DashboardActivityItem] = []
        for job in jobs:
            v_count = 0
            p_count = 0

            # Count vehicles and recognized plates from eager-loaded ORM entities
            if job.vehicles:
                v_count = len(job.vehicles)
                p_count = sum(
                    1
                    for v in job.vehicles
                    if v.plate is not None
                    and v.plate.plate_text
                    and v.plate.plate_text.strip() != ""
                )
            elif job.raw_result and isinstance(job.raw_result, dict):
                raw = job.raw_result
                if job.media_type == "image":
                    v_list = raw.get("vehicles", [])
                    v_count = len(v_list)
                    p_count = sum(
                        1
                        for v in v_list
                        if isinstance(v, dict)
                        and v.get("plate")
                        and isinstance(v["plate"], dict)
                        and v["plate"].get("text", "").strip() != ""
                    )
                elif job.media_type == "video":
                    frames = raw.get("frames", [])
                    for f in frames:
                        if isinstance(f, dict):
                            v_list = f.get("vehicles", [])
                            v_count += len(v_list)
                            p_count += sum(
                                1
                                for v in v_list
                                if isinstance(v, dict)
                                and v.get("plate")
                                and isinstance(v["plate"], dict)
                                and v["plate"].get("text", "").strip() != ""
                            )

            completed_at = (
                job.updated_at if job.status in ("COMPLETED", "FAILED") else None
            )

            items.append(
                DashboardActivityItem(
                    job_id=job.id,
                    media_type=job.media_type,
                    status=job.status,
                    created_at=job.created_at,
                    completed_at=completed_at,
                    vehicle_count=v_count,
                    recognized_plate_count=p_count,
                    error_message=job.error_message,
                )
            )

        total_pages = math.ceil(total / page_size) if total > 0 else 0

        return DashboardActivityResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
