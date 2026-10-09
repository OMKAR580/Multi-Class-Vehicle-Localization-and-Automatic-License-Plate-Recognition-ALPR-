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
