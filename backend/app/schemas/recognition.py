"""Schemas for Vehicle Detection and License Plate Recognition API."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.detection import LicensePlateResult, VehicleResult


class ImageRecognitionRequest(BaseModel):
    """Request schema referencing an existing uploaded asset file_id."""

    file_id: str = Field(..., description="Unique file upload identifier returned by POST /api/v1/files/upload.")


class RecognitionResponse(BaseModel):
    """Structured response schema for ALPR image recognition inference."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    job_id: str = Field(..., description="Unique detection job identifier (UUID).")
    file_id: str = Field(..., description="Referenced file upload identifier.")
    status: str = Field(..., description="Job execution status ('COMPLETED', 'FAILED').")
    processing_time_ms: float = Field(..., description="Inference runtime in milliseconds.")
    image_width: int = Field(..., description="Original image width in pixels.")
    image_height: int = Field(..., description="Original image height in pixels.")
    vehicles: List[VehicleResult] = Field(default_factory=list, description="List of detected vehicles and license plates.")
    created_at: datetime = Field(..., description="Detection job creation timestamp.")


class VideoRecognitionRequest(BaseModel):
    """Request schema referencing an existing uploaded video asset file_id."""

    file_id: str = Field(..., description="Unique file upload identifier returned by POST /api/v1/files/upload.")


class VideoFrameResult(BaseModel):
    """ALPR detection output for an individual sampled video frame."""

    frame_index: int = Field(..., description="0-based frame index in the source video.")
    timestamp_seconds: float = Field(..., description="Sampled frame timestamp in seconds.")
    width: int = Field(..., description="Frame resolution width in pixels.")
    height: int = Field(..., description="Frame resolution height in pixels.")
    vehicles: List[VehicleResult] = Field(default_factory=list, description="List of detected vehicles and license plates in frame.")


class VideoRecognitionResponse(BaseModel):
    """Structured response schema for ALPR video recognition inference."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    job_id: str = Field(..., description="Unique detection job identifier (UUID).")
    file_id: str = Field(..., description="Referenced file upload identifier.")
    status: str = Field(..., description="Job execution status ('COMPLETED', 'FAILED').")
    processing_time_ms: float = Field(..., description="Total processing runtime in milliseconds.")
    video_fps: float = Field(..., description="Source video frame rate (FPS).")
    total_frames: int = Field(..., description="Total frames count in source video.")
    sampled_frames_count: int = Field(..., description="Number of sampled frames processed.")
    duration_seconds: float = Field(..., description="Total video duration in seconds.")
    video_width: int = Field(..., description="Source video resolution width in pixels.")
    video_height: int = Field(..., description="Source video resolution height in pixels.")
    frames: List[VideoFrameResult] = Field(default_factory=list, description="Frame-by-frame ALPR detection results.")
    error_message: Optional[str] = Field(None, description="Detailed error description if execution failed.")
    created_at: datetime = Field(..., description="Detection job creation timestamp.")
