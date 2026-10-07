from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.detection_repository import DetectionRepository
from app.models.detection import DetectionJob
from app.schemas.detection import AIDetectionResponse, VehicleResult, LicensePlateResult

class DetectionService:
    def __init__(self, session: AsyncSession):
        self.repo = DetectionRepository(session)

    async def create_job(self, media_url: str, media_type: str = "image", user_id: Optional[str] = None) -> DetectionJob:
        job = DetectionJob(
            media_url=media_url,
            media_type=media_type,
            user_id=user_id,
            status="PENDING"
        )
        return await self.repo.create(job)

    async def get_job(self, job_id: str) -> Optional[DetectionJob]:
        return await self.repo.get_by_id(job_id)
