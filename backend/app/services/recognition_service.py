"""Recognition service orchestrating ALPR image and video inference and database persistence."""

import io
import time
from datetime import datetime
from typing import Optional
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from ai.pipeline.alpr_pipeline import ALPRPipeline
from ai.video.frame_extractor import VideoFrameExtractor
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
from app.schemas.recognition import (
    ImageRecognitionRequest,
    RecognitionResponse,
    VideoFrameResult,
    VideoRecognitionRequest,
    VideoRecognitionResponse,
)
from app.services.storage_service import BaseStorageService


class RecognitionService:
    """Orchestrates image and video ALPR recognition inference, validation, and persistent storage."""

    def __init__(
        self,
        db: AsyncSession,
        storage: BaseStorageService,
        pipeline: Optional[ALPRPipeline] = None,
        frame_extractor: Optional[VideoFrameExtractor] = None,
    ):
        self.db = db
        self.storage = storage
        self.pipeline = pipeline or ALPRPipeline()
        self.frame_extractor = frame_extractor or VideoFrameExtractor()
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
            "ALPR image recognition complete: job_id=%s, user_id=%s, file_id=%s, vehicles=%d, time=%.2fms",
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

    async def process_video_recognition(
        self,
        request: VideoRecognitionRequest,
        current_user: User,
    ) -> VideoRecognitionResponse:
        """
        Processes an authenticated video recognition request referencing a valid upload video asset.

        Args:
            request: VideoRecognitionRequest containing file_id.
            current_user: Currently authenticated User.

        Returns:
            VideoRecognitionResponse containing job_id, execution stats, and frame-level ALPR detections.
        """
        # 1. Retrieve asset record
        file_meta = await self.file_repo.get_by_id(request.file_id)
        if not file_meta:
            raise ResourceNotFoundException("File asset", request.file_id)

        # 2. Enforce asset ownership boundary
        if file_meta.uploaded_by_user_id != current_user.id:
            raise UnauthorizedException("Access denied: You do not own the referenced upload asset.")

        # 3. Enforce supported video media type policy
        if file_meta.mime_type not in ("video/mp4",):
            raise UnsupportedMediaTypeException(
                f"File format '{file_meta.mime_type}' is not supported for video recognition. Only MP4 videos are allowed."
            )

        # 4. Retrieve video bytes from private storage
        video_bytes = await self.storage.read_bytes(file_meta.file_path)

        # 5. Extract sampled frames using video frame extractor
        t0 = time.perf_counter()
        fps, total_frames, video_w, video_h, duration, sampled_frames = self.frame_extractor.extract_frames(
            video_bytes=video_bytes,
            file_id=request.file_id,
        )

        # 6. Execute ALPR pipeline frame by frame
        frame_results: list[VideoFrameResult] = []
        all_vehicle_entities: list[Vehicle] = []
        all_plate_entities: list[Plate] = []

        for frame_idx, timestamp_sec, frame_jpeg_bytes, f_width, f_height in sampled_frames:
            ai_contract = self.pipeline.process_image(
                image_id=f"{request.file_id}_frame_{frame_idx}",
                image_bytes=frame_jpeg_bytes,
            )

            v_results: list[VehicleResult] = []
            for v_box in ai_contract.vehicles:
                plate_res: Optional[LicensePlateResult] = None
                if v_box.plate:
                    plate_res = LicensePlateResult(
                        text=v_box.plate.text,
                        confidence=v_box.plate.confidence,
                        bbox=v_box.plate.bbox,
                    )
                v_results.append(
                    VehicleResult(
                        type=v_box.type,
                        confidence=v_box.confidence,
                        bbox=v_box.bbox,
                        plate=plate_res,
                    )
                )

            frame_results.append(
                VideoFrameResult(
                    frame_index=frame_idx,
                    timestamp_seconds=timestamp_sec,
                    width=f_width,
                    height=f_height,
                    vehicles=v_results,
                )
            )

        processing_time_ms = round((time.perf_counter() - t0) * 1000, 2)

        # 7. Construct initial response contract
        response = VideoRecognitionResponse(
            job_id="",
            file_id=request.file_id,
            status="COMPLETED",
            processing_time_ms=processing_time_ms,
            video_fps=fps,
            total_frames=total_frames,
            sampled_frames_count=len(frame_results),
            duration_seconds=duration,
            video_width=video_w,
            video_height=video_h,
            frames=frame_results,
            created_at=datetime.utcnow(),
        )

        # 8. Database persistence (DetectionJob)
        raw_result_dict = response.model_dump(mode="json")
        job = DetectionJob(
            user_id=current_user.id,
            status="COMPLETED",
            media_type="video",
            media_url=file_meta.file_path,
            processing_time_ms=processing_time_ms,
            raw_result=raw_result_dict,
        )
        await self.detection_repo.create(job)

        # Update response & stored snapshot with actual generated job.id
        response.job_id = job.id
        response.created_at = job.created_at
        raw_result_dict["job_id"] = job.id
        job.raw_result = raw_result_dict

        # Persist Vehicle and Plate ORM entities
        for f_res in frame_results:
            for v_res in f_res.vehicles:
                v_entity = Vehicle(
                    detection_job_id=job.id,
                    vehicle_type=v_res.type,
                    confidence=v_res.confidence,
                    bbox=v_res.bbox,
                )
                self.db.add(v_entity)
                await self.db.flush()

                if v_res.plate:
                    p_entity = Plate(
                        vehicle_id=v_entity.id,
                        plate_text=v_res.plate.text,
                        confidence=v_res.plate.confidence,
                        bbox=v_res.plate.bbox,
                    )
                    self.db.add(p_entity)

        await self.db.commit()

        logger.info(
            "ALPR video recognition complete: job_id=%s, user_id=%s, file_id=%s, sampled_frames=%d, time=%.2fms",
            job.id,
            current_user.id,
            request.file_id,
            len(frame_results),
            processing_time_ms,
        )

        return response

    async def get_video_recognition_job(
        self,
        job_id: str,
        current_user: User,
    ) -> VideoRecognitionResponse:
        """
        Retrieves job status and ALPR results for a video recognition job.

        Args:
            job_id: Detection job identifier.
            current_user: Currently authenticated User.

        Returns:
            VideoRecognitionResponse with full job results.
        """
        job = await self.detection_repo.get_by_id(job_id)
        if not job:
            raise ResourceNotFoundException("Video detection job", job_id)

        # Enforce job ownership boundary
        if job.user_id != current_user.id:
            raise UnauthorizedException("Access denied: You do not own this detection job.")

        if job.media_type != "video":
            raise ResourceNotFoundException("Video detection job", job_id)

        return VideoRecognitionResponse.model_validate(job.raw_result)
