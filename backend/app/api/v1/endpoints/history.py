from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.detection import DetectionJobStatus

router = APIRouter()

@router.get("/history", response_model=List[DetectionJobStatus], tags=["History"])
async def list_detection_history(limit: int = 20, db: AsyncSession = Depends(get_db)):
    """
    List Historical Detections Endpoint.
    """
    return []
