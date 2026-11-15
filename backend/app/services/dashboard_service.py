"""Dashboard service coordinating analytics aggregation, activity formatting, and date validation."""

import math
import time
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.dashboard_repository import DashboardRepository
from app.schemas.dashboard import (
    ActivityTimelineItem,
    DashboardActivityItem,
    DashboardActivityResponse,
    DashboardOverviewResponse,
    DashboardStatsResponse,
    DashboardSummary,
    VehicleClassDistributionItem,
)

# Lightweight in-memory cache to avoid repeated high-latency round-trips to remote Supabase pooler
_DASHBOARD_OVERVIEW_CACHE: dict[str, tuple[float, DashboardOverviewResponse]] = {}
_CACHE_TTL_SECONDS = 15.0


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

    def _format_activity_items(self, jobs: list) -> list[DashboardActivityItem]:
        """Formats ORM detection jobs into DashboardActivityItem list."""
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
        return items

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

        items = self._format_activity_items(jobs)
        total_pages = math.ceil(total / page_size) if total > 0 else 0

        return DashboardActivityResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def get_dashboard_overview(
        self,
        current_user: User,
        days: int = 7,
        recent_limit: int = 5,
    ) -> DashboardOverviewResponse:
        """
        Retrieves comprehensive consolidated dashboard overview metrics.

        Args:
            current_user: Authenticated User entity.
            days: Timeline horizon in days.
            recent_limit: Number of recent jobs to include.

        Returns:
            DashboardOverviewResponse with KPIs, timeline, vehicle classes, and recent activity.
        """
        cache_key = f"{current_user.id}:{days}:{recent_limit}"
        now_ts = time.monotonic()
        if cache_key in _DASHBOARD_OVERVIEW_CACHE:
            cached_at, cached_payload = _DASHBOARD_OVERVIEW_CACHE[cache_key]
            if now_ts - cached_at < _CACHE_TTL_SECONDS:
                return cached_payload

        raw_stats = await self.repo.get_aggregated_stats(user_id=current_user.id)
        timeline_data = await self.repo.get_activity_timeline(
            user_id=current_user.id, days=days
        )
        distribution_data = await self.repo.get_vehicle_class_distribution(
            user_id=current_user.id
        )
        recent_jobs_orm, _ = await self.repo.get_recent_activity(
            user_id=current_user.id,
            page=1,
            page_size=recent_limit,
        )
        recent_items = self._format_activity_items(recent_jobs_orm)

        result = DashboardOverviewResponse(
            summary=DashboardSummary(**raw_stats),
            activity_timeline=[ActivityTimelineItem(**t) for t in timeline_data],
            vehicle_distribution=[
                VehicleClassDistributionItem(**d) for d in distribution_data
            ],
            recent_jobs=recent_items,
            generated_at=datetime.now(timezone.utc),
        )

        if len(_DASHBOARD_OVERVIEW_CACHE) > 200:
            _DASHBOARD_OVERVIEW_CACHE.clear()
        _DASHBOARD_OVERVIEW_CACHE[cache_key] = (now_ts, result)

        return result
