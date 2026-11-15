"""Detection repository providing data access methods for DetectionJob entities."""

from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.detection import DetectionJob, Plate, Vehicle


class DetectionRepository:
    """Data repository for DetectionJob persistence, querying, and paginated history retrieval."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, job_id: str) -> Optional[DetectionJob]:
        """Fetch a DetectionJob by its unique ID."""
        result = await self.session.execute(
            select(DetectionJob)
            .options(selectinload(DetectionJob.vehicles).selectinload(Vehicle.plate))
            .where(DetectionJob.id == job_id)
        )
        return result.scalars().first()

    async def get_by_id_and_user(self, job_id: str, user_id: str) -> Optional[DetectionJob]:
        """Fetch a DetectionJob by ID requiring matching user_id ownership boundary."""
        result = await self.session.execute(
            select(DetectionJob)
            .options(selectinload(DetectionJob.vehicles).selectinload(Vehicle.plate))
            .where(DetectionJob.id == job_id, DetectionJob.user_id == user_id)
        )
        return result.scalars().first()

    async def list_by_user(self, user_id: str, limit: int = 50) -> List[DetectionJob]:
        """List detection jobs for a user ordered by creation timestamp."""
        result = await self.session.execute(
            select(DetectionJob)
            .where(DetectionJob.user_id == user_id)
            .order_by(DetectionJob.created_at.desc(), DetectionJob.id.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_by_user_paginated(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 10,
        search: Optional[str] = None,
        media_type: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        vehicle_class: Optional[str] = None,
    ) -> Tuple[List[DetectionJob], int]:
        """
        Query paginated detection history for a user with optional search, filters, and stable ordering.

        Args:
            user_id: Authenticated user ID boundary.
            page: 1-indexed page number.
            page_size: Number of items per page.
            search: Optional search term matching job ID, filename/media URL, vehicle type, or plate text.
            media_type: Optional media type filter ('image', 'video').
            status: Optional execution status filter ('COMPLETED', 'FAILED', 'PENDING', 'PROCESSING').
            start_date: Optional start datetime boundary.
            end_date: Optional end datetime boundary.
            vehicle_class: Optional vehicle category filter ('car', 'truck', 'bus', 'motorbike', etc.).

        Returns:
            Tuple[List[DetectionJob], int]: List of jobs on current page and total count of matching jobs.
        """
        filters = [DetectionJob.user_id == user_id]

        if media_type and media_type.lower() != "all":
            filters.append(DetectionJob.media_type == media_type.lower().strip())
        if status and status.upper() != "ALL":
            filters.append(DetectionJob.status == status.upper().strip())
        if start_date:
            filters.append(DetectionJob.created_at >= start_date)
        if end_date:
            filters.append(DetectionJob.created_at <= end_date)
        if vehicle_class and vehicle_class.lower() != "all":
            clean_cls = vehicle_class.lower().strip()
            filters.append(
                DetectionJob.vehicles.any(
                    Vehicle.vehicle_type.ilike(f"%{clean_cls}%")
                )
            )
        if search and search.strip():
            clean_s = search.strip()
            search_clause = or_(
                DetectionJob.id.ilike(f"%{clean_s}%"),
                DetectionJob.media_url.ilike(f"%{clean_s}%"),
                DetectionJob.vehicles.any(
                    Vehicle.vehicle_type.ilike(f"%{clean_s}%")
                ),
                DetectionJob.vehicles.any(
                    Vehicle.plate.has(Plate.plate_text.ilike(f"%{clean_s}%"))
                ),
            )
            filters.append(search_clause)

        # Count total matching records efficiently
        count_stmt = select(func.count()).select_from(DetectionJob).where(*filters)
        count_result = await self.session.execute(count_stmt)
        total_count = count_result.scalar_one()

        if total_count == 0:
            return [], 0

        # Query paginated records with eager loading on vehicles and plates relationships
        offset = (page - 1) * page_size
        stmt = (
            select(DetectionJob)
            .options(selectinload(DetectionJob.vehicles).selectinload(Vehicle.plate))
            .where(*filters)
            .order_by(DetectionJob.created_at.desc(), DetectionJob.id.desc())
            .offset(offset)
            .limit(page_size)
        )
        result = await self.session.execute(stmt)
        jobs = list(result.scalars().all())

        return jobs, total_count

    async def create(self, job: DetectionJob, commit: bool = True) -> DetectionJob:
        """Persist a new DetectionJob entity."""
        self.session.add(job)
        if commit:
            await self.session.commit()
            await self.session.refresh(job)
        else:
            await self.session.flush()
        return job
