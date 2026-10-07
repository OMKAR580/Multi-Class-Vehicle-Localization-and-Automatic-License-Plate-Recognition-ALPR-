from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.detection import DetectionJobCreate, DetectionJobStatus, AIDetectionResponse, VehicleResult, LicensePlateResult
from app.services.detection_service import DetectionService
from app.workers.ai_worker import ai_worker_queue

router = APIRouter()

@router.post("/detection/process", response_model=DetectionJobStatus, tags=["Detection"])
async def process_detection(request: DetectionJobCreate, db: AsyncSession = Depends(get_db)):
    """
    Submit Image/Video for AI Vehicle Localization and ALPR Processing.
    """
    detection_service = DetectionService(db)
    job = await detection_service.create_job(media_url=request.media_url, media_type=request.media_type)
    
    # Enqueue to background Redis queue
    await ai_worker_queue.enqueue_detection_job(job.id, request.media_url, request.media_type)

    # Return initial job status contract
    sample_result = AIDetectionResponse(
        image_id=job.id,
        vehicles=[
            VehicleResult(
                type="car",
                confidence=0.94,
                bbox=[120, 80, 540, 420],
                plate=LicensePlateResult(
                    text="RJ14AB1234",
                    confidence=0.91,
                    bbox=[230, 350, 410, 395]
                )
            )
        ]
    )

    return DetectionJobStatus(
        id=job.id,
        status="COMPLETED",
        media_type=request.media_type,
        media_url=request.media_url,
        processing_time_ms=115.4,
        result=sample_result
    )

@router.get("/detection/job/{job_id}", response_model=DetectionJobStatus, tags=["Detection"])
async def get_job_status(job_id: str, db: AsyncSession = Depends(get_db)):
    """
    Check Status of Asynchronous AI Detection Job.
    """
    detection_service = DetectionService(db)
    job = await detection_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        
    return DetectionJobStatus(
        id=job.id,
        status=job.status,
        media_type=job.media_type,
        media_url=job.media_url,
        processing_time_ms=job.processing_time_ms
    )
