"""Analytics repository providing database-level aggregation for operational intelligence."""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.detection import DetectionJob, Plate, Vehicle


class AnalyticsRepository:
    """Repository executing user-scoped aggregation queries for operational analytics."""

    def __init__(self, session: AsyncSession):
        self.session = session

    def _build_job_filters(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        media_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list:
        filters = [DetectionJob.user_id == user_id]
        if start_date is not None:
            filters.append(DetectionJob.created_at >= start_date)
        if end_date is not None:
            filters.append(DetectionJob.created_at <= end_date)
        if media_type is not None and media_type.lower() != "all":
            filters.append(DetectionJob.media_type == media_type.lower())
        if status is not None and status.upper() != "ALL":
            filters.append(DetectionJob.status == status.upper())
        return filters

    async def get_analytics_summary(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        media_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Calculates headline KPI metrics within selected filters."""
        job_filters = self._build_job_filters(user_id, start_date, end_date, media_type, status)

        # 1. Job counts and latency
        job_stmt = (
            select(
                func.count(DetectionJob.id).label("total_jobs"),
                func.coalesce(func.sum(case((DetectionJob.status == "COMPLETED", 1), else_=0)), 0).label("completed_jobs"),
                func.coalesce(func.sum(case((DetectionJob.status == "FAILED", 1), else_=0)), 0).label("failed_jobs"),
                func.coalesce(
                    func.sum(case((DetectionJob.status.in_(["PENDING", "PROCESSING"]), 1), else_=0)), 0
                ).label("pending_jobs"),
                func.avg(
                    case((DetectionJob.status == "COMPLETED", DetectionJob.processing_time_ms))
                ).label("avg_latency"),
            )
            .select_from(DetectionJob)
            .where(*job_filters)
        )
        job_res = (await self.session.execute(job_stmt)).one()

        total_jobs = int(job_res.total_jobs or 0)
        completed_jobs = int(job_res.completed_jobs or 0)
        failed_jobs = int(job_res.failed_jobs or 0)
        pending_jobs = int(job_res.pending_jobs or 0)
        avg_latency = round(float(job_res.avg_latency), 2) if job_res.avg_latency is not None else None

        # 2. Total vehicles (independent query to prevent join multiplication)
        veh_stmt = (
            select(func.count(Vehicle.id))
            .select_from(Vehicle)
            .join(DetectionJob, Vehicle.detection_job_id == DetectionJob.id)
            .where(*job_filters)
        )
        total_vehicles = int((await self.session.execute(veh_stmt)).scalar_one() or 0)

        # 3. Total plates detected
        plate_stmt = (
            select(func.count(Plate.id))
            .select_from(Plate)
            .join(Vehicle, Plate.vehicle_id == Vehicle.id)
            .join(DetectionJob, Vehicle.detection_job_id == DetectionJob.id)
            .where(*job_filters)
        )
        total_plates = int((await self.session.execute(plate_stmt)).scalar_one() or 0)

        # 4. Recognized plates (non-empty text)
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
        unreadable_plates = max(0, total_plates - recognized_plates)

        terminal_jobs = completed_jobs + failed_jobs
        success_rate = (
            round((completed_jobs / terminal_jobs) * 100.0, 2)
            if terminal_jobs > 0
            else None
        )

        return {
            "total_jobs": total_jobs,
            "completed_jobs": completed_jobs,
            "failed_jobs": failed_jobs,
            "pending_jobs": pending_jobs,
            "total_vehicles": total_vehicles,
            "total_plates": total_plates,
            "recognized_plates": recognized_plates,
            "unreadable_plates": unreadable_plates,
            "success_rate": success_rate,
            "average_latency_ms": avg_latency,
        }

    async def get_activity_timeline(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime,
        media_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Constructs continuous daily timeline buckets between start_date and end_date."""
        job_filters = self._build_job_filters(user_id, start_date, end_date, media_type, status)

        # Pre-seed every calendar day in interval with zero counts
        buckets: Dict[str, Dict[str, Any]] = {}
        curr = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_bound = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)

        while curr <= end_bound:
            d_str = curr.strftime("%Y-%m-%d")
            buckets[d_str] = {
                "date": d_str,
                "day_name": curr.strftime("%a"),
                "total_jobs": 0,
                "successful_jobs": 0,
                "failed_jobs": 0,
                "total_vehicles": 0,
            }
            curr += timedelta(days=1)

        stmt = (
            select(
                DetectionJob.id,
                DetectionJob.status,
                DetectionJob.created_at,
                func.count(Vehicle.id).label("vehicle_count"),
            )
            .select_from(DetectionJob)
            .outerjoin(Vehicle, Vehicle.detection_job_id == DetectionJob.id)
            .where(*job_filters)
            .group_by(DetectionJob.id, DetectionJob.status, DetectionJob.created_at)
        )
        rows = (await self.session.execute(stmt)).all()

        for r in rows:
            if r.created_at:
                d_key = r.created_at.strftime("%Y-%m-%d")
                if d_key in buckets:
                    b = buckets[d_key]
                    b["total_jobs"] += 1
                    if r.status == "COMPLETED":
                        b["successful_jobs"] += 1
                    elif r.status == "FAILED":
                        b["failed_jobs"] += 1
                    b["total_vehicles"] += int(r.vehicle_count or 0)

        return list(buckets.values())

    async def get_vehicle_distribution(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        media_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Aggregates vehicle counts and percentages grouped by persisted class."""
        job_filters = self._build_job_filters(user_id, start_date, end_date, media_type, status)

        stmt = (
            select(
                Vehicle.vehicle_type,
                func.count(Vehicle.id).label("class_count"),
            )
            .select_from(Vehicle)
            .join(DetectionJob, Vehicle.detection_job_id == DetectionJob.id)
            .where(*job_filters)
            .group_by(Vehicle.vehicle_type)
            .order_by(func.count(Vehicle.id).desc())
        )
        rows = (await self.session.execute(stmt)).all()

        total = sum(int(r.class_count) for r in rows)
        result = []
        for r in rows:
            c = int(r.class_count)
            pct = round((c / total) * 100.0, 1) if total > 0 else 0.0
            result.append({
                "vehicle_class": str(r.vehicle_type or "other").lower(),
                "count": c,
                "percentage": pct,
            })
        return result

    async def get_recognized_plate_strings(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        media_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[str]:
        """Retrieves raw recognized plate strings to extract jurisdictions."""
        job_filters = self._build_job_filters(user_id, start_date, end_date, media_type, status)

        stmt = (
            select(Plate.plate_text)
            .select_from(Plate)
            .join(Vehicle, Plate.vehicle_id == Vehicle.id)
            .join(DetectionJob, Vehicle.detection_job_id == DetectionJob.id)
            .where(
                *job_filters,
                Plate.plate_text.isnot(None),
                func.trim(Plate.plate_text) != "",
            )
        )
        rows = (await self.session.execute(stmt)).scalars().all()
        return [str(p).strip() for p in rows if p and str(p).strip()]

    async def get_media_breakdown(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Aggregates metrics comparing image vs video jobs."""
        job_filters = self._build_job_filters(user_id, start_date, end_date, None, status)

        stmt = (
            select(
                DetectionJob.media_type,
                func.count(DetectionJob.id).label("total_jobs"),
                func.coalesce(func.sum(case((DetectionJob.status == "COMPLETED", 1), else_=0)), 0).label("completed"),
                func.coalesce(func.sum(case((DetectionJob.status == "FAILED", 1), else_=0)), 0).label("failed"),
                func.avg(
                    case((DetectionJob.status == "COMPLETED", DetectionJob.processing_time_ms))
                ).label("avg_latency"),
            )
            .select_from(DetectionJob)
            .where(*job_filters)
            .group_by(DetectionJob.media_type)
        )
        rows = (await self.session.execute(stmt)).all()

        media_data = {
            "image": {"jobs": 0, "completed": 0, "failed": 0, "avg_latency": None},
            "video": {"jobs": 0, "completed": 0, "failed": 0, "avg_latency": None},
        }

        for r in rows:
            m_type = str(r.media_type or "image").lower()
            if m_type in media_data:
                media_data[m_type]["jobs"] = int(r.total_jobs or 0)
                media_data[m_type]["completed"] = int(r.completed or 0)
                media_data[m_type]["failed"] = int(r.failed or 0)
                if r.avg_latency is not None:
                    media_data[m_type]["avg_latency"] = round(float(r.avg_latency), 2)

        # Count vehicle detections by media type
        veh_stmt = (
            select(
                DetectionJob.media_type,
                func.count(Vehicle.id).label("veh_count"),
            )
            .select_from(Vehicle)
            .join(DetectionJob, Vehicle.detection_job_id == DetectionJob.id)
            .where(*job_filters)
            .group_by(DetectionJob.media_type)
        )
        veh_rows = (await self.session.execute(veh_stmt)).all()
        image_vehs = 0
        video_vehs = 0
        for vr in veh_rows:
            mt = str(vr.media_type or "image").lower()
            if mt == "image":
                image_vehs = int(vr.veh_count or 0)
            elif mt == "video":
                video_vehs = int(vr.veh_count or 0)

        return {
            "image_jobs": media_data["image"]["jobs"],
            "video_jobs": media_data["video"]["jobs"],
            "image_vehicles": image_vehs,
            "video_vehicles": video_vehs,
            "image_completed": media_data["image"]["completed"],
            "image_failed": media_data["image"]["failed"],
            "video_completed": media_data["video"]["completed"],
            "video_failed": media_data["video"]["failed"],
            "image_avg_latency_ms": media_data["image"]["avg_latency"],
            "video_avg_latency_ms": media_data["video"]["avg_latency"],
        }

    async def get_performance_metrics(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        media_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Calculates operational latency distribution for completed jobs."""
        filters = self._build_job_filters(user_id, start_date, end_date, media_type, "COMPLETED")
        filters.append(DetectionJob.processing_time_ms.isnot(None))

        stmt = (
            select(
                func.avg(DetectionJob.processing_time_ms).label("avg_lat"),
                func.min(DetectionJob.processing_time_ms).label("min_lat"),
                func.max(DetectionJob.processing_time_ms).label("max_lat"),
                func.coalesce(func.sum(case((DetectionJob.processing_time_ms < 1000.0, 1), else_=0)), 0).label("fast"),
                func.coalesce(
                    func.sum(case(((DetectionJob.processing_time_ms >= 1000.0) & (DetectionJob.processing_time_ms <= 2500.0), 1), else_=0)), 0
                ).label("normal"),
                func.coalesce(func.sum(case((DetectionJob.processing_time_ms > 2500.0, 1), else_=0)), 0).label("heavy"),
            )
            .select_from(DetectionJob)
            .where(*filters)
        )
        row = (await self.session.execute(stmt)).one()

        return {
            "avg_latency_ms": round(float(row.avg_lat), 2) if row.avg_lat is not None else None,
            "min_latency_ms": round(float(row.min_lat), 2) if row.min_lat is not None else None,
            "max_latency_ms": round(float(row.max_lat), 2) if row.max_lat is not None else None,
            "fast_count": int(row.fast or 0),
            "normal_count": int(row.normal or 0),
            "heavy_count": int(row.heavy or 0),
        }

    async def get_time_distribution(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        media_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Calculates job processing distribution by hour of day (0-23) and weekday (Mon-Sun)."""
        job_filters = self._build_job_filters(user_id, start_date, end_date, media_type, status)

        stmt = select(DetectionJob.created_at).where(*job_filters)
        rows = (await self.session.execute(stmt)).scalars().all()

        hourly_map = {f"{h:02d}:00": 0 for h in range(24)}
        weekday_map = {day: 0 for day in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}

        for dt in rows:
            if dt:
                h_str = dt.strftime("%H:00")
                if h_str in hourly_map:
                    hourly_map[h_str] += 1
                w_str = dt.strftime("%a")
                if w_str in weekday_map:
                    weekday_map[w_str] += 1

        hourly_list = [{"hour": k, "count": v} for k, v in hourly_map.items()]
        weekday_list = [{"day": k, "count": v} for k, v in weekday_map.items()]

        return {"hourly": hourly_list, "weekday": weekday_list}

