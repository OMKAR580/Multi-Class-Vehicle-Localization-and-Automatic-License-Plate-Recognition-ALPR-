"""Pydantic schemas for Dashboard Statistics and Analytics API."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DashboardStatsResponse(BaseModel):
    """Aggregated statistics summary for the authenticated user's dashboard."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    total_jobs: int = Field(..., description="Total recognition jobs owned by user.")
    completed_jobs: int = Field(..., description="Jobs with COMPLETED status.")
    failed_jobs: int = Field(..., description="Jobs with FAILED status.")
    pending_jobs: int = Field(..., description="Jobs with PENDING status.")
    processing_jobs: int = Field(..., description="Jobs with PROCESSING status.")
    total_vehicles_detected: int = Field(..., description="Total persisted vehicle records across all user jobs.")
    total_plates_detected: int = Field(..., description="Total persisted license plate records across all user jobs.")
    recognized_plates: int = Field(..., description="Total license plates with non-empty recognized text.")
    image_jobs: int = Field(..., description="Total image recognition jobs.")
    video_jobs: int = Field(..., description="Total video recognition jobs.")
    success_rate: float = Field(..., description="Success rate percentage (completed / terminal * 100).")


class DashboardActivityItem(BaseModel):
    """Summary item representing recent recognition activity on dashboard."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    job_id: str = Field(..., description="Unique detection job identifier (UUID).")
    media_type: str = Field(..., description="Media category ('image' or 'video').")
    status: str = Field(..., description="Job execution status ('COMPLETED', 'FAILED', 'PENDING', 'PROCESSING').")
    created_at: datetime = Field(..., description="Job creation timestamp.")
    completed_at: Optional[datetime] = Field(None, description="Job completion or termination timestamp.")
    vehicle_count: int = Field(0, description="Total vehicles detected in this job.")
    recognized_plate_count: int = Field(0, description="Total recognized license plates with valid text.")
    error_message: Optional[str] = Field(None, description="Safe error message if job execution failed.")


class DashboardActivityResponse(BaseModel):
    """Paginated response container for recent dashboard recognition activity."""

    items: List[DashboardActivityItem] = Field(default_factory=list, description="Paginated activity items.")
    total: int = Field(..., description="Total matching activity items count.")
    page: int = Field(..., description="Current page number (1-indexed).")
    page_size: int = Field(..., description="Number of items per page.")
    total_pages: int = Field(..., description="Total available pages.")
