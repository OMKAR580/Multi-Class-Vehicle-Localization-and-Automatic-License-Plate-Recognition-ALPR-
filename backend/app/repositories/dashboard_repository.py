"""Dashboard repository providing database-level aggregation and recent activity queries."""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.detection import DetectionJob, Plate, Vehicle


class DashboardRepository:
    """Repository handling SQL aggregation queries and activity retrieval for user dashboards."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_aggregated_stats(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Executes database-side aggregations for user statistics without Cartesians or Python memory loops.

        Args:
            user_id: Authenticated user ID boundary.
            start_date: Optional inclusive start timestamp.
            end_date: Optional inclusive end timestamp.

        Returns:
            Dict containing counts for jobs, vehicle detections, plate detections, and success rate.
        """
        job_filters = [DetectionJob.user_id == user_id]
        if start_date is not None:
            job_filters.append(DetectionJob.created_at >= start_date)
        if end_date is not None:
            job_filters.append(DetectionJob.created_at <= end_date)

        # 1. Job status and media type counts via conditional aggregation in a single query
        job_stats_stmt = (
            select(
                func.count(DetectionJob.id).label("total_jobs"),
                func.coalesce(func.sum(case((DetectionJob.status == "COMPLETED", 1), else_=0)), 0).label("completed_jobs"),
                func.coalesce(func.sum(case((DetectionJob.status == "FAILED", 1), else_=0)), 0).label("failed_jobs"),
                func.coalesce(func.sum(case((DetectionJob.status == "PENDING", 1), else_=0)), 0).label("pending_jobs"),
                func.coalesce(func.sum(case((DetectionJob.status == "PROCESSING", 1), else_=0)), 0).label("processing_jobs"),
                func.coalesce(func.sum(case((DetectionJob.media_type == "image", 1), else_=0)), 0).label("image_jobs"),
                func.coalesce(func.sum(case((DetectionJob.media_type == "video", 1), else_=0)), 0).label("video_jobs"),
            )
            .select_from(DetectionJob)
            .where(*job_filters)
        )
        job_res = (await self.session.execute(job_stats_stmt)).one()

        total_jobs = int(job_res.total_jobs or 0)
        completed_jobs = int(job_res.completed_jobs or 0)
        failed_jobs = int(job_res.failed_jobs or 0)
        pending_jobs = int(job_res.pending_jobs or 0)
        processing_jobs = int(job_res.processing_jobs or 0)
        image_jobs = int(job_res.image_jobs or 0)
        video_jobs = int(job_res.video_jobs or 0)

        # 2. Total vehicles detected for user (decoupled from plates to prevent join inflation)
        veh_stmt = (
            select(func.count(Vehicle.id))
            .select_from(Vehicle)
            .join(DetectionJob, Vehicle.detection_job_id == DetectionJob.id)
            .where(*job_filters)
        )
        total_vehicles = int((await self.session.execute(veh_stmt)).scalar_one() or 0)

        # 3. Total plates detected for user
        plate_stmt = (
            select(func.count(Plate.id))
            .select_from(Plate)
            .join(Vehicle, Plate.vehicle_id == Vehicle.id)
            .join(DetectionJob, Vehicle.detection_job_id == DetectionJob.id)
            .where(*job_filters)
        )
        total_plates = int((await self.session.execute(plate_stmt)).scalar_one() or 0)

        # 4. Recognized plates with valid, non-empty text
        rec_plate_stmt = (
            select(func.count(Plate.id))
            .select_from(Plate)
            .join(Vehicle, Plate.vehicle_id == Vehicle.id)
            .join(DetectionJob, Vehicle.detection_job_id == DetectionJob.id)
            .where(
                *job_filters,
                Plate.plate_text.isnot(None),
                func.trim(Plate.plate_text) != "",
            )
        )
        recognized_plates = int((await self.session.execute(rec_plate_stmt)).scalar_one() or 0)

        # 5. Success rate calculation (terminal jobs = completed + failed)
        terminal_jobs = completed_jobs + failed_jobs
        success_rate = (
            round((completed_jobs / terminal_jobs) * 100.0, 2)
            if terminal_jobs > 0
            else 0.0
        )

        return {
            "total_jobs": total_jobs,
            "completed_jobs": completed_jobs,
            "failed_jobs": failed_jobs,
            "pending_jobs": pending_jobs,
            "processing_jobs": processing_jobs,
            "total_vehicles_detected": total_vehicles,
            "total_plates_detected": total_plates,
            "recognized_plates": recognized_plates,
            "image_jobs": image_jobs,
            "video_jobs": video_jobs,
            "success_rate": success_rate,
        }

    async def get_recent_activity(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 10,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Tuple[List[DetectionJob], int]:
        """
        Retrieves paginated recent recognition activity with eager loading and deterministic sorting.

        Args:
            user_id: Authenticated user ID boundary.
            page: 1-indexed page number.
            page_size: Items per page.
            start_date: Optional filter start timestamp.
            end_date: Optional filter end timestamp.

        Returns:
            Tuple[List[DetectionJob], int]: List of jobs on current page and total count.
        """
        job_filters = [DetectionJob.user_id == user_id]
        if start_date is not None:
            job_filters.append(DetectionJob.created_at >= start_date)
        if end_date is not None:
            job_filters.append(DetectionJob.created_at <= end_date)

        # Count total matching records
        count_stmt = select(func.count()).select_from(DetectionJob).where(*job_filters)
        total_count = int((await self.session.execute(count_stmt)).scalar_one() or 0)

        if total_count == 0:
            return [], 0

        # Paginated fetch with eager-loaded vehicles and plates
        offset = (page - 1) * page_size
        stmt = (
            select(DetectionJob)
            .options(selectinload(DetectionJob.vehicles).selectinload(Vehicle.plate))
            .where(*job_filters)
            .order_by(DetectionJob.created_at.desc(), DetectionJob.id.desc())
            .offset(offset)
            .limit(page_size)
        )
        result = await self.session.execute(stmt)
        jobs = list(result.scalars().all())

        return jobs, total_count
