"""Recognition service orchestrating ALPR image inference and database persistence."""

import io
import time
from typing import Optional
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from ai.pipeline.alpr_pipeline import ALPRPipeline
from app.core.exceptions import (
    InvalidFileException,
    ResourceNotFoundException,
    UnauthorizedException,
    UnsupportedMediaTypeException,
)
from app.core.logging import logger
from app.models.detection import DetectionJob, Plate, Vehicle
from app.models.user import User
from app.repositories.detection_repository import DetectionRepository
from app.repositories.file_repository import FileRepository
from app.schemas.detection import LicensePlateResult, VehicleResult
from app.schemas.recognition import ImageRecognitionRequest, RecognitionResponse
from app.services.storage_service import BaseStorageService


class RecognitionService:
    """Orchestrates image ALPR recognition inference, validation, and persistent storage."""

    def __init__(
        self,
        db: AsyncSession,
        storage: BaseStorageService,
        pipeline: Optional[ALPRPipeline] = None,
    ):
        self.db = db
        self.storage = storage
        self.pipeline = pipeline or ALPRPipeline()
        self.file_repo = FileRepository(db)
        self.detection_repo = DetectionRepository(db)

    async def process_image_recognition(
        self,
        request: ImageRecognitionRequest,
        current_user: User,
    ) -> RecognitionResponse:
        """
        Processes an authenticated image recognition request referencing a valid upload asset.

        Args:
            request: ImageRecognitionRequest containing file_id.
            current_user: Currently authenticated User.

        Returns:
            RecognitionResponse containing job_id, execution stats, and vehicle/plate detections.
        """
        # 1. Retrieve asset record
        file_meta = await self.file_repo.get_by_id(request.file_id)
        if not file_meta:
            raise ResourceNotFoundException("File asset", request.file_id)

        # 2. Enforce asset ownership boundary
        if file_meta.uploaded_by_user_id != current_user.id:
            raise UnauthorizedException("Access denied: You do not own the referenced upload asset.")

        # 3. Enforce supported image format policy
        if file_meta.mime_type not in ("image/jpeg", "image/png"):
            raise UnsupportedMediaTypeException(
                f"File format '{file_meta.mime_type}' is not supported for image recognition. Only JPEG and PNG are allowed."
            )

        # 4. Retrieve asset bytes from private storage
        image_bytes = await self.storage.read_bytes(file_meta.file_path)

        # Decode dimensions for response metadata
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                image_width, image_height = img.size
        except Exception as exc:
            raise InvalidFileException("Image file is corrupted, truncated, or cannot be decoded.") from exc

        # 5. Execute modular ALPR AI Pipeline
        t0 = time.perf_counter()
        ai_contract = self.pipeline.process_image(
            image_id=request.file_id,
            image_bytes=image_bytes,
        )
        processing_time_ms = round((time.perf_counter() - t0) * 1000, 2)

        # 6. Database persistence (DetectionJob, Vehicle, Plate)
        job = DetectionJob(
            user_id=current_user.id,
            status="COMPLETED",
            media_type="image",
            media_url=file_meta.file_path,
            processing_time_ms=processing_time_ms,
            raw_result=ai_contract.model_dump(),
        )
        await self.detection_repo.create(job)

        vehicle_results: list[VehicleResult] = []

        for v_box in ai_contract.vehicles:
            vehicle_entity = Vehicle(
                detection_job_id=job.id,
                vehicle_type=v_box.type,
                confidence=v_box.confidence,
                bbox=v_box.bbox,
            )
            self.db.add(vehicle_entity)
            await self.db.flush()

            plate_result: Optional[LicensePlateResult] = None

            if v_box.plate:
                plate_entity = Plate(
                    vehicle_id=vehicle_entity.id,
                    plate_text=v_box.plate.text,
                    confidence=v_box.plate.confidence,
                    bbox=v_box.plate.bbox,
                )
                self.db.add(plate_entity)
                plate_result = LicensePlateResult(
                    text=v_box.plate.text,
                    confidence=v_box.plate.confidence,
                    bbox=v_box.plate.bbox,
                )

            vehicle_results.append(
                VehicleResult(
                    type=v_box.type,
                    confidence=v_box.confidence,
                    bbox=v_box.bbox,
                    plate=plate_result,
                )
            )

        await self.db.commit()

        logger.info(
            "ALPR recognition complete: job_id=%s, user_id=%s, file_id=%s, vehicles=%d, time=%.2fms",
            job.id,
            current_user.id,
            request.file_id,
            len(vehicle_results),
            processing_time_ms,
        )

        return RecognitionResponse(
            job_id=job.id,
            file_id=request.file_id,
            status="COMPLETED",
            processing_time_ms=processing_time_ms,
            image_width=image_width,
            image_height=image_height,
            vehicles=vehicle_results,
            created_at=job.created_at,
        )
