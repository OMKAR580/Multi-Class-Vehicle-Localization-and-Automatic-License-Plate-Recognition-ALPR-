"""Repository providing user-isolated database queries and tabular dataset extraction for reports."""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.detection import DetectionJob, Plate, Vehicle
from app.models.report import Report, ReportFolder


class ReportsRepository:
    """Repository handling SQL queries for report previews and export datasets."""

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

    async def get_user_overview_meta(self, user_id: str) -> Dict[str, Any]:
        """Retrieves user lifetime record count and timestamp bounds."""
        stmt = select(
            func.count(DetectionJob.id).label("total_jobs"),
            func.min(DetectionJob.created_at).label("earliest_dt"),
            func.max(DetectionJob.created_at).label("latest_dt"),
        ).where(DetectionJob.user_id == user_id)
        row = (await self.session.execute(stmt)).one()
        return {
            "total_user_records": int(row.total_jobs or 0),
            "earliest_record_date": row.earliest_dt,
            "latest_record_date": row.latest_dt,
        }

    async def get_recognition_summary_report_data(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        media_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 500,
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]], int]:
        """Fetches headline KPIs and detailed job rows for the Recognition Summary report."""
        job_filters = self._build_job_filters(user_id, start_date, end_date, media_type, status)

        # 1. Headline summary KPIs
        kpi_stmt = (
            select(
                func.count(DetectionJob.id).label("total_jobs"),
                func.coalesce(func.sum(case((DetectionJob.status == "COMPLETED", 1), else_=0)), 0).label("completed"),
                func.coalesce(func.sum(case((DetectionJob.status == "FAILED", 1), else_=0)), 0).label("failed"),
                func.coalesce(
                    func.sum(case((DetectionJob.status.in_(["PENDING", "PROCESSING"]), 1), else_=0)), 0
                ).label("pending"),
                func.avg(
                    case((DetectionJob.status == "COMPLETED", DetectionJob.processing_time_ms))
                ).label("avg_lat"),
            )
            .select_from(DetectionJob)
            .where(*job_filters)
        )
        kpi_row = (await self.session.execute(kpi_stmt)).one()

        total_jobs = int(kpi_row.total_jobs or 0)
        completed = int(kpi_row.completed or 0)
        failed = int(kpi_row.failed or 0)
        pending = int(kpi_row.pending or 0)
        avg_lat = round(float(kpi_row.avg_lat), 2) if kpi_row.avg_lat is not None else None
        terminal = completed + failed
        success_rate = round((completed / terminal) * 100.0, 2) if terminal > 0 else None

        # 2. Total vehicles
        veh_stmt = (
            select(func.count(Vehicle.id))
            .select_from(Vehicle)
            .join(DetectionJob, Vehicle.detection_job_id == DetectionJob.id)
            .where(*job_filters)
        )
        total_vehs = int((await self.session.execute(veh_stmt)).scalar_one() or 0)

        # 3. Total plates and recognized plates
        plate_stmt = (
            select(func.count(Plate.id))
            .select_from(Plate)
            .join(Vehicle, Plate.vehicle_id == Vehicle.id)
            .join(DetectionJob, Vehicle.detection_job_id == DetectionJob.id)
            .where(*job_filters)
        )
        total_plates = int((await self.session.execute(plate_stmt)).scalar_one() or 0)

        rec_stmt = (
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
        rec_plates = int((await self.session.execute(rec_stmt)).scalar_one() or 0)
        unreadable_plates = max(0, total_plates - rec_plates)
        ocr_resolution_rate = round((rec_plates / total_plates) * 100.0, 1) if total_plates > 0 else None

        summary_kpis = {
            "total_jobs": total_jobs,
            "completed_jobs": completed,
            "failed_jobs": failed,
            "pending_jobs": pending,
            "success_rate": success_rate,
            "total_vehicles": total_vehs,
            "total_plates": total_plates,
            "recognized_plates": rec_plates,
            "unreadable_plates": unreadable_plates,
            "ocr_resolution_rate": ocr_resolution_rate,
            "average_latency_ms": avg_lat,
        }

        # 4. Detailed rows (eager loaded to prevent N+1)
        row_stmt = (
            select(DetectionJob)
            .options(selectinload(DetectionJob.vehicles).selectinload(Vehicle.plate))
            .where(*job_filters)
            .order_by(DetectionJob.created_at.desc())
            .limit(limit)
        )
        jobs_result = await self.session.execute(row_stmt)
        jobs = jobs_result.scalars().all()

        rows: List[Dict[str, Any]] = []
        for j in jobs:
            v_count = len(j.vehicles or [])
            p_list = []
            for v in (j.vehicles or []):
                if v.plate and v.plate.plate_text and v.plate.plate_text.strip():
                    p_list.append(v.plate.plate_text.strip())

            safe_name = j.media_url.replace("\\", "/").split("/")[-1] if j.media_url else None
            rows.append({
                "job_id": j.id,
                "filename": safe_name or ("video.mp4" if j.media_type == "video" else "scan.jpg"),
                "created_at": j.created_at.isoformat() if j.created_at else "",
                "media_type": j.media_type,
                "status": j.status,
                "latency_ms": round(j.processing_time_ms, 1) if j.processing_time_ms is not None else None,
                "vehicles_detected": v_count,
                "plates_detected": len(p_list),
                "recognized_plates": ", ".join(p_list) if p_list else "None",
            })

        return summary_kpis, rows, total_jobs

    async def get_vehicle_distribution_report_data(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        media_type: Optional[str] = None,
        status: Optional[str] = None,
        vehicle_class: Optional[str] = None,
        limit: int = 500,
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]], int]:
        """Fetches class distribution metrics and detailed vehicle detection rows."""
        job_filters = self._build_job_filters(user_id, start_date, end_date, media_type, status)

        veh_filters = list(job_filters)
        if vehicle_class and vehicle_class.lower() != "all":
            veh_filters.append(func.lower(Vehicle.vehicle_type) == vehicle_class.lower())

        # Aggregate class breakdown
        breakdown_stmt = (
            select(
                Vehicle.vehicle_type,
                func.count(Vehicle.id).label("class_count"),
                func.avg(Vehicle.confidence).label("avg_conf"),
            )
            .select_from(Vehicle)
            .join(DetectionJob, Vehicle.detection_job_id == DetectionJob.id)
            .where(*veh_filters)
            .group_by(Vehicle.vehicle_type)
            .order_by(func.count(Vehicle.id).desc())
        )
        bd_rows = (await self.session.execute(breakdown_stmt)).all()

        total_vehicles = sum(int(r.class_count) for r in bd_rows)
        class_summary = {}
        for r in bd_rows:
            c = int(r.class_count)
            pct = round((c / total_vehicles) * 100.0, 1) if total_vehicles > 0 else 0.0
            avg_c = round(float(r.avg_conf) * 100.0, 1) if r.avg_conf is not None else 0.0
            class_summary[str(r.vehicle_type).lower()] = {
                "count": c,
                "percentage": pct,
                "avg_confidence": avg_c,
            }

        summary_kpis = {
            "total_vehicles_detected": total_vehicles,
            "distinct_classes_detected": len(bd_rows),
            "dominant_class": bd_rows[0].vehicle_type if bd_rows else "None",
            "class_summary": class_summary,
        }

        # Detailed vehicle records
        v_stmt = (
            select(Vehicle, DetectionJob.created_at, DetectionJob.media_type)
            .join(DetectionJob, Vehicle.detection_job_id == DetectionJob.id)
            .where(*veh_filters)
            .order_by(DetectionJob.created_at.desc())
            .limit(limit)
        )
        res = await self.session.execute(v_stmt)
        rows: List[Dict[str, Any]] = []
        for v, job_created, m_type in res.all():
            rows.append({
                "vehicle_id": v.id,
                "detection_job_id": v.detection_job_id,
                "vehicle_class": v.vehicle_type,
                "confidence_pct": round(v.confidence * 100.0, 1),
                "bbox": str(v.bbox),
                "media_type": m_type,
                "detected_at": job_created.isoformat() if job_created else "",
            })

        return summary_kpis, rows, total_vehicles

    async def get_plate_recognition_report_data(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        media_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 500,
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]], int]:
        """Fetches plate detection, OCR recognition rates, and plate record rows."""
        job_filters = self._build_job_filters(user_id, start_date, end_date, media_type, status)

        # Count total plates
        tot_stmt = (
            select(func.count(Plate.id))
            .select_from(Plate)
            .join(Vehicle, Plate.vehicle_id == Vehicle.id)
            .join(DetectionJob, Vehicle.detection_job_id == DetectionJob.id)
            .where(*job_filters)
        )
        total_plates = int((await self.session.execute(tot_stmt)).scalar_one() or 0)

        # Count plates with recognized text
        rec_stmt = (
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
        rec_plates = int((await self.session.execute(rec_stmt)).scalar_one() or 0)
        unreadable = max(0, total_plates - rec_plates)
        rec_rate = round((rec_plates / total_plates) * 100.0, 1) if total_plates > 0 else None

        summary_kpis = {
            "total_plates_detected": total_plates,
            "recognized_plates": rec_plates,
            "unreadable_plates": unreadable,
            "ocr_recognition_rate": rec_rate,
        }

        # Fetch detailed plate records
        detail_stmt = (
            select(Plate, Vehicle.vehicle_type, DetectionJob.id.label("job_id"), DetectionJob.created_at)
            .select_from(Plate)
            .join(Vehicle, Plate.vehicle_id == Vehicle.id)
            .join(DetectionJob, Vehicle.detection_job_id == DetectionJob.id)
            .where(*job_filters)
            .order_by(DetectionJob.created_at.desc())
            .limit(limit)
        )
        res = await self.session.execute(detail_stmt)
        rows: List[Dict[str, Any]] = []
        for p, v_type, j_id, j_dt in res.all():
            has_txt = bool(p.plate_text and p.plate_text.strip())
            rows.append({
                "plate_id": p.id,
                "job_id": j_id,
                "vehicle_type": v_type,
                "plate_text": p.plate_text.strip() if has_txt else "UNREADABLE",
                "ocr_status": "RECOGNIZED" if has_txt else "UNREADABLE",
                "plate_confidence_pct": round(p.confidence * 100.0, 1),
                "bbox": str(p.bbox),
                "timestamp": j_dt.isoformat() if j_dt else "",
            })

        return summary_kpis, rows, total_plates

    async def get_performance_report_data(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        media_type: Optional[str] = None,
        limit: int = 500,
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]], int]:
        """Fetches operational processing latency distribution and session execution rows."""
        job_filters = self._build_job_filters(user_id, start_date, end_date, media_type, "COMPLETED")
        job_filters.append(DetectionJob.processing_time_ms.isnot(None))

        kpi_stmt = (
            select(
                func.count(DetectionJob.id).label("completed_jobs"),
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
            .where(*job_filters)
        )
        kpi_row = (await self.session.execute(kpi_stmt)).one()

        completed_count = int(kpi_row.completed_jobs or 0)
        summary_kpis = {
            "evaluated_jobs": completed_count,
            "average_latency_ms": round(float(kpi_row.avg_lat), 2) if kpi_row.avg_lat is not None else None,
            "min_latency_ms": round(float(kpi_row.min_lat), 2) if kpi_row.min_lat is not None else None,
            "max_latency_ms": round(float(kpi_row.max_lat), 2) if kpi_row.max_lat is not None else None,
            "fast_jobs_under_1s": int(kpi_row.fast or 0),
            "normal_jobs_1_to_2_5s": int(kpi_row.normal or 0),
            "heavy_jobs_over_2_5s": int(kpi_row.heavy or 0),
        }

        # Detail session records
        row_stmt = (
            select(DetectionJob)
            .where(*job_filters)
            .order_by(DetectionJob.created_at.desc())
            .limit(limit)
        )
        jobs_result = await self.session.execute(row_stmt)
        jobs = jobs_result.scalars().all()

        rows: List[Dict[str, Any]] = []
        for j in jobs:
            lat = j.processing_time_ms or 0.0
            bracket = "< 1,000 ms" if lat < 1000.0 else ("1s – 2.5s" if lat <= 2500.0 else "> 2.5s")
            rows.append({
                "job_id": j.id,
                "media_type": j.media_type,
                "status": j.status,
                "processing_time_ms": round(lat, 1),
                "latency_bracket": bracket,
                "executed_at": j.created_at.isoformat() if j.created_at else "",
            })

        return summary_kpis, rows, completed_count

    async def get_media_breakdown_report_data(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]], int]:
        """Fetches comparative metrics and comparative dataset between Image and Video media."""
        job_filters = self._build_job_filters(user_id, start_date, end_date, None, status)

        stmt = (
            select(
                DetectionJob.media_type,
                func.count(DetectionJob.id).label("total_jobs"),
                func.coalesce(func.sum(case((DetectionJob.status == "COMPLETED", 1), else_=0)), 0).label("completed"),
                func.coalesce(func.sum(case((DetectionJob.status == "FAILED", 1), else_=0)), 0).label("failed"),
                func.avg(
                    case((DetectionJob.status == "COMPLETED", DetectionJob.processing_time_ms))
                ).label("avg_lat"),
            )
            .select_from(DetectionJob)
            .where(*job_filters)
            .group_by(DetectionJob.media_type)
        )
        rows_res = (await self.session.execute(stmt)).all()

        # Vehicles by media
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
        veh_res = (await self.session.execute(veh_stmt)).all()
        veh_map = {str(r.media_type).lower(): int(r.veh_count or 0) for r in veh_res}

        rows: List[Dict[str, Any]] = []
        tot_jobs = 0
        img_jobs = 0
        vid_jobs = 0

        for r in rows_res:
            m_type = str(r.media_type or "image").lower()
            t_j = int(r.total_jobs or 0)
            comp = int(r.completed or 0)
            fail = int(r.failed or 0)
            tot_jobs += t_j
            if m_type == "image":
                img_jobs += t_j
            else:
                vid_jobs += t_j

            rate = round((comp / (comp + fail)) * 100.0, 1) if (comp + fail) > 0 else None
            avg_l = round(float(r.avg_lat), 1) if r.avg_lat is not None else None

            rows.append({
                "media_category": m_type.upper(),
                "total_jobs": t_j,
                "completed_jobs": comp,
                "failed_jobs": fail,
                "success_rate_pct": rate,
                "vehicles_detected": veh_map.get(m_type, 0),
                "average_latency_ms": avg_l,
            })

        summary_kpis = {
            "total_jobs_evaluated": tot_jobs,
            "image_jobs_count": img_jobs,
            "video_jobs_count": vid_jobs,
            "image_share_pct": round((img_jobs / tot_jobs) * 100.0, 1) if tot_jobs > 0 else 0.0,
            "video_share_pct": round((vid_jobs / tot_jobs) * 100.0, 1) if tot_jobs > 0 else 0.0,
        }

        return summary_kpis, rows, len(rows)

    # =========================================================================
    # PERSISTENT SAVED REPORT & FOLDER REPOSITORY OPERATIONS
    # =========================================================================

    async def create_report(self, report: Report) -> Report:
        """Persists a new Report metadata record within the active session."""
        self.session.add(report)
        await self.session.flush()
        return report

    async def get_report_by_id(self, report_id: str, user_id: str) -> Optional[Report]:
        """Fetches a saved report record strictly enforcing user ownership."""
        stmt = (
            select(Report)
            .options(selectinload(Report.folder))
            .where(Report.id == report_id, Report.user_id == user_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_user_reports(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 20,
        report_type: Optional[str] = None,
        file_format: Optional[str] = None,
        folder_id: Optional[str] = None,
        is_uncategorized: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Report], int]:
        """Lists paginated saved reports for the authenticated user matching filter criteria."""
        filters = [Report.user_id == user_id]

        if report_type:
            filters.append(Report.report_type == report_type)
        if file_format:
            filters.append(Report.file_format == file_format.lower())
        if folder_id:
            filters.append(Report.folder_id == folder_id)
        elif is_uncategorized is True:
            filters.append(Report.folder_id.is_(None))

        if search and search.strip():
            term = f"%{search.strip()}%"
            filters.append(Report.title.ilike(term))

        # Total count query
        count_stmt = select(func.count(Report.id)).where(*filters)
        total_res = await self.session.execute(count_stmt)
        total = total_res.scalar() or 0

        # Paginated items query
        offset = max(0, (page - 1) * page_size)
        items_stmt = (
            select(Report)
            .options(selectinload(Report.folder))
            .where(*filters)
            .order_by(Report.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        items_res = await self.session.execute(items_stmt)
        items = list(items_res.scalars().all())

        return items, total

    async def delete_report(self, report_id: str, user_id: str) -> Optional[Report]:
        """Deletes a report record transactionally, returning the deleted record for cleanup."""
        stmt = select(Report).where(Report.id == report_id, Report.user_id == user_id)
        result = await self.session.execute(stmt)
        report = result.scalar_one_or_none()
        if not report:
            return None

        await self.session.delete(report)
        await self.session.flush()
        return report

    async def get_folder_by_id(self, folder_id: str, user_id: str) -> Optional[ReportFolder]:
        """Validates that a folder exists and is owned by the authenticated user."""
        stmt = select(ReportFolder).where(ReportFolder.id == folder_id, ReportFolder.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_folder_by_name(self, user_id: str, name: str) -> Optional[ReportFolder]:
        """Finds a folder by name for a user (case-insensitive) for duplicate prevention."""
        stmt = select(ReportFolder).where(
            ReportFolder.user_id == user_id,
            func.lower(ReportFolder.name) == func.lower(name.strip()),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_folder(self, folder: ReportFolder) -> ReportFolder:
        """Internal helper for persisting a folder entity."""
        self.session.add(folder)
        await self.session.flush()
        return folder

    async def list_user_folders_with_counts(self, user_id: str) -> List[Tuple[ReportFolder, int]]:
        """
        Retrieves all folders owned by user along with actual report count per folder.
        Uses a grouped count subquery so that empty folders (count=0) are preserved
        and zero N+1 queries occur.
        """
        count_subq = (
            select(Report.folder_id, func.count(Report.id).label("cnt"))
            .where(Report.user_id == user_id, Report.folder_id.isnot(None))
            .group_by(Report.folder_id)
            .subquery()
        )
        stmt = (
            select(
                ReportFolder,
                func.coalesce(count_subq.c.cnt, 0).label("report_count"),
            )
            .outerjoin(count_subq, ReportFolder.id == count_subq.c.folder_id)
            .where(ReportFolder.user_id == user_id)
            .order_by(ReportFolder.created_at.asc())
        )
        result = await self.session.execute(stmt)
        rows = result.all()
        return [(row[0], int(row[1])) for row in rows]

    async def get_folder_report_count(self, folder_id: str, user_id: str) -> int:
        """Returns the total number of reports assigned to a folder."""
        stmt = select(func.count(Report.id)).where(Report.folder_id == folder_id, Report.user_id == user_id)
        result = await self.session.execute(stmt)
        return int(result.scalar() or 0)

    async def update_folder(
        self,
        folder: ReportFolder,
        name: Optional[str] = None,
        description: Optional[str] = None,
        color: Optional[str] = None,
    ) -> ReportFolder:
        """Updates folder attributes transactionally."""
        if name is not None:
            folder.name = name.strip()
        if description is not None:
            folder.description = description
        if color is not None:
            folder.color = color
        folder.updated_at = datetime.utcnow()
        await self.session.flush()
        return folder

    async def delete_folder(self, folder_id: str, user_id: str) -> Optional[ReportFolder]:
        """
        Deletes a folder entity transactionally.
        Explicitly unassigns folder_id from associated reports to preserve them in
        'Unorganized', satisfying ON DELETE SET NULL independently of DB foreign
        key pragma settings.
        """
        folder = await self.get_folder_by_id(folder_id, user_id)
        if not folder:
            return None

        # Unassign reports from this folder first
        unassign_stmt = (
            update(Report)
            .where(Report.folder_id == folder_id, Report.user_id == user_id)
            .values(folder_id=None)
        )
        await self.session.execute(unassign_stmt)

        # Delete folder record
        await self.session.delete(folder)
        await self.session.flush()
        return folder

    async def move_report(
        self, report_id: str, user_id: str, folder_id: Optional[str]
    ) -> Optional[Report]:
        """Moves a report to a new folder (or unorganizes it) transactionally."""
        report = await self.get_report_by_id(report_id, user_id)
        if not report:
            return None

        report.folder_id = folder_id
        report.updated_at = datetime.utcnow()
        await self.session.flush()
        return report



