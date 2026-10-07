from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.detection import DetectionJob

class DetectionRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, job_id: str) -> Optional[DetectionJob]:
        result = await self.session.execute(select(DetectionJob).where(DetectionJob.id == job_id))
        return result.scalars().first()

    async def list_by_user(self, user_id: str, limit: int = 50) -> List[DetectionJob]:
        result = await self.session.execute(
            select(DetectionJob).where(DetectionJob.user_id == user_id).limit(limit)
        )
        return list(result.scalars().all())

    async def create(self, job: DetectionJob) -> DetectionJob:
        self.session.add(job)
        await self.session.commit()
        await self.session.refresh(job)
        return job
