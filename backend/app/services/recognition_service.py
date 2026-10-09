"""Recognition service orchestrating ALPR image and video inference, history queries, and database persistence."""

import io
import math
import time
from datetime import datetime
from typing import Any, Optional, Union
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
    RecognitionHistoryItem,
    RecognitionHistoryResponse,
    RecognitionResponse,
    VideoFrameResult,
    VideoRecognitionRequest,
    VideoRecognitionResponse,
)
from app.services.storage_service import BaseStorageService


class RecognitionService:
    """Orchestrates image and video ALPR recognition inference, history queries, validation, and persistent storage."""

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

        # Construct raw result dict
        vehicle_results: list[VehicleResult] = []
        for v_box in ai_contract.vehicles:
            plate_res: Optional[LicensePlateResult] = None
            if v_box.plate:
                plate_res = LicensePlateResult(
                    text=v_box.plate.text,
                    confidence=v_box.plate.confidence,
                    bbox=v_box.plate.bbox,
                )
            vehicle_results.append(
                VehicleResult(
                    type=v_box.type,
                    confidence=v_box.confidence,
                    bbox=v_box.bbox,
                    plate=plate_res,
                )
            )

        raw_result_snapshot = {
            "image_id": request.file_id,
            "image_width": image_width,
            "image_height": image_height,
            "vehicles": [v.model_dump() for v in vehicle_results],
        }

        # 6. Database persistence (DetectionJob, Vehicle, Plate)
        job = DetectionJob(
            user_id=current_user.id,
            status="COMPLETED",
            media_type="image",
            media_url=file_meta.file_path,
            processing_time_ms=processing_time_ms,
            raw_result=raw_result_snapshot,
        )
        await self.detection_repo.create(job)

        for v_res in vehicle_results:
            vehicle_entity = Vehicle(
                detection_job_id=job.id,
                vehicle_type=v_res.type,
                confidence=v_res.confidence,
                bbox=v_res.bbox,
            )
            self.db.add(vehicle_entity)
            await self.db.flush()

            if v_res.plate:
                plate_entity = Plate(
                    vehicle_id=vehicle_entity.id,
                    plate_text=v_res.plate.text,
                    confidence=v_res.plate.confidence,
                    bbox=v_res.plate.bbox,
                )
                self.db.add(plate_entity)

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

    async def get_recognition_history(
        self,
        current_user: User,
        page: int = 1,
        page_size: int = 10,
        media_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> RecognitionHistoryResponse:
        """
        Retrieves paginated recognition job history for the authenticated user.

        Args:
            current_user: Currently authenticated user.
            page: 1-indexed page number.
            page_size: Number of items per page.
            media_type: Optional media type filter ('image', 'video').
            status: Optional execution status filter ('COMPLETED', 'FAILED', 'PENDING').

        Returns:
            RecognitionHistoryResponse: Paginated container with summary items.
        """
        if media_type and media_type not in ("image", "video"):
            raise InvalidFileException("Invalid media_type filter. Allowed values: 'image', 'video'.")

        if status and status not in ("COMPLETED", "FAILED", "PENDING", "PROCESSING"):
            raise InvalidFileException("Invalid status filter. Allowed values: 'COMPLETED', 'FAILED', 'PENDING', 'PROCESSING'.")

        jobs, total = await self.detection_repo.list_by_user_paginated(
            user_id=current_user.id,
            page=page,
            page_size=page_size,
            media_type=media_type,
            status=status,
        )

        items: list[RecognitionHistoryItem] = []
        for job in jobs:
            v_count = 0
            p_count = 0

            if job.raw_result and isinstance(job.raw_result, dict):
                raw = job.raw_result
                if job.media_type == "image":
                    vehicles_data = raw.get("vehicles", [])
                    v_count = len(vehicles_data)
                    p_count = sum(1 for v in vehicles_data if isinstance(v, dict) and v.get("plate"))
                elif job.media_type == "video":
                    frames_data = raw.get("frames", [])
                    for f in frames_data:
                        if isinstance(f, dict):
                            f_vehicles = f.get("vehicles", [])
                            v_count += len(f_vehicles)
                            p_count += sum(1 for v in f_vehicles if isinstance(v, dict) and v.get("plate"))
            else:
                v_count = len(job.vehicles)
                p_count = sum(1 for v in job.vehicles if v.plate is not None)

            items.append(
                RecognitionHistoryItem(
                    job_id=job.id,
                    media_type=job.media_type,
                    media_url=job.media_url,
                    status=job.status,
                    processing_time_ms=job.processing_time_ms,
                    error_message=job.error_message,
                    vehicle_count=v_count,
                    plate_count=p_count,
                    created_at=job.created_at,
                )
            )

        total_pages = math.ceil(total / page_size) if total > 0 else 0

        return RecognitionHistoryResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def get_recognition_job_detail(
        self,
        job_id: str,
        current_user: User,
    ) -> Union[RecognitionResponse, VideoRecognitionResponse]:
        """
        Retrieves detailed recognition results for a specific job (image or video) owned by current_user.

        Args:
            job_id: Detection job identifier.
            current_user: Currently authenticated User.

        Returns:
            RecognitionResponse or VideoRecognitionResponse based on job media_type.
        """
        job = await self.detection_repo.get_by_id(job_id)
        if not job:
            raise ResourceNotFoundException("Recognition job", job_id)

        # Enforce job ownership boundary
        if job.user_id != current_user.id:
            raise UnauthorizedException("Access denied: You do not own this recognition job.")

        if job.media_type == "video":
            return VideoRecognitionResponse.model_validate(job.raw_result)
        elif job.media_type == "image":
            if job.raw_result and isinstance(job.raw_result, dict):
                return RecognitionResponse(
                    job_id=job.id,
                    file_id=job.raw_result.get("image_id", job.media_url),
                    status=job.status,
                    processing_time_ms=job.processing_time_ms or 0.0,
                    image_width=job.raw_result.get("image_width", 0),
                    image_height=job.raw_result.get("image_height", 0),
                    vehicles=job.raw_result.get("vehicles", []),
                    created_at=job.created_at,
                )
            return RecognitionResponse(
                job_id=job.id,
                file_id=job.media_url,
                status=job.status,
                processing_time_ms=job.processing_time_ms or 0.0,
                image_width=0,
                image_height=0,
                vehicles=[],
                created_at=job.created_at,
            )
        else:
            raise ResourceNotFoundException("Recognition job", job_id)
