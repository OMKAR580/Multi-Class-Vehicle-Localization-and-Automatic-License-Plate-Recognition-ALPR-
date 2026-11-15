"""Pydantic schemas for Dashboard Statistics and Analytics API."""

from datetime import datetime, timezone
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


class VehicleClassDistributionItem(BaseModel):
    """Item representing vehicle count and percentage breakdown by localized class."""

    vehicle_class: str = Field(..., description="Normalized vehicle class name (e.g. car, truck, bus, motorbike).")
    count: int = Field(..., description="Total detections localized for this class.")
    percentage: float = Field(..., description="Percentage of total localized vehicles (0.0 to 100.0).")


class ActivityTimelineItem(BaseModel):
    """Daily detection activity timeline data point."""

    date: str = Field(..., description="Date string in YYYY-MM-DD format.")
    day_name: str = Field(..., description="Short day name (e.g. Mon, Tue, Wed).")
    total_jobs: int = Field(0, description="Total recognition jobs created on this date.")
    successful_jobs: int = Field(0, description="Completed jobs on this date.")
    failed_jobs: int = Field(0, description="Failed jobs on this date.")
    total_vehicles: int = Field(0, description="Total vehicles localized on this date.")


class DashboardSummary(BaseModel):
    """Comprehensive KPIs summary for the authenticated user."""

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
    average_processing_time_ms: Optional[float] = Field(None, description="Average processing time in ms for completed jobs.")
    success_rate: float = Field(..., description="Success rate percentage (completed / terminal * 100).")


class DashboardOverviewResponse(BaseModel):
    """Consolidated operational overview response for Dashboard Home."""

    summary: DashboardSummary = Field(..., description="Core KPI statistics.")
    activity_timeline: List[ActivityTimelineItem] = Field(default_factory=list, description="Recent daily activity timeline.")
    vehicle_distribution: List[VehicleClassDistributionItem] = Field(default_factory=list, description="Class distribution breakdown.")
    recent_jobs: List[DashboardActivityItem] = Field(default_factory=list, description="Most recent recognition jobs.")
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp when overview was generated.")
