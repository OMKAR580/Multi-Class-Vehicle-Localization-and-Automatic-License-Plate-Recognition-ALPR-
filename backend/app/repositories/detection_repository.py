"""Detection repository providing data access methods for DetectionJob entities."""

from typing import List, Optional, Tuple
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.detection import DetectionJob, Vehicle


class DetectionRepository:
    """Data repository for DetectionJob persistence, querying, and paginated history retrieval."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, job_id: str) -> Optional[DetectionJob]:
        """Fetch a DetectionJob by its unique ID."""
        result = await self.session.execute(
            select(DetectionJob).where(DetectionJob.id == job_id)
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
        media_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Tuple[List[DetectionJob], int]:
        """
        Query paginated detection history for a user with optional media_type/status filters and stable ordering.

        Args:
            user_id: Authenticated user ID.
            page: 1-indexed page number.
            page_size: Number of items per page.
            media_type: Optional media type filter ('image', 'video').
            status: Optional execution status filter ('COMPLETED', 'FAILED', 'PENDING').

        Returns:
            Tuple[List[DetectionJob], int]: List of jobs on current page and total count of matching jobs.
        """
        filters = [DetectionJob.user_id == user_id]
        if media_type:
            filters.append(DetectionJob.media_type == media_type)
        if status:
            filters.append(DetectionJob.status == status)

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

    async def create(self, job: DetectionJob) -> DetectionJob:
        """Persist a new DetectionJob entity."""
        self.session.add(job)
        await self.session.commit()
        await self.session.refresh(job)
        return job
