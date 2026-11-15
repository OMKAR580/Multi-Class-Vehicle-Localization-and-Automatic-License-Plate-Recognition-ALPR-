"""Pydantic schemas for Traffic & Recognition Analytics API."""

from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class AnalyticsPeriod(BaseModel):
    """Metadata regarding the queried analytics period and boundaries."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    start_date: datetime = Field(..., description="Inclusive start datetime (UTC).")
    end_date: datetime = Field(..., description="Inclusive end datetime (UTC).")
    days: Optional[int] = Field(None, description="Requested day span if preset, or None if custom.")
    timezone: str = Field("UTC", description="Reporting timezone.")


class AnalyticsSummary(BaseModel):
    """Aggregated key metrics for the selected reporting period."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    total_jobs: int = Field(..., description="Total recognition jobs in period.")
    completed_jobs: int = Field(..., description="Completed jobs in period.")
    failed_jobs: int = Field(..., description="Failed jobs in period.")
    pending_jobs: int = Field(..., description="Pending/processing jobs in period.")
    total_vehicles: int = Field(..., description="Total vehicle records in period.")
    total_plates: int = Field(..., description="Total plate bounding boxes detected in period.")
    recognized_plates: int = Field(..., description="Plates with non-empty recognized OCR text.")
    unreadable_plates: int = Field(..., description="Plates localized without readable text.")
    success_rate: Optional[float] = Field(None, description="Job completion rate (completed / terminal * 100).")
    average_latency_ms: Optional[float] = Field(None, description="Average duration of completed jobs (ms).")


class AnalyticsTimelinePoint(BaseModel):
    """Daily or periodic time-series bucket."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    date: str = Field(..., description="Bucket date (YYYY-MM-DD).")
    day_name: str = Field(..., description="Abbreviated day name (e.g. Mon, Tue).")
    total_jobs: int = Field(..., description="Jobs created in this bucket.")
    successful_jobs: int = Field(..., description="Jobs completed successfully in this bucket.")
    failed_jobs: int = Field(..., description="Jobs failed in this bucket.")
    total_vehicles: int = Field(..., description="Vehicles detected in this bucket.")


class AnalyticsVehicleClass(BaseModel):
    """Vehicle category distribution item."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    vehicle_class: str = Field(..., description="Vehicle category (e.g. car, truck, bus).")
    count: int = Field(..., description="Number of vehicles in this class.")
    percentage: float = Field(..., description="Percentage of total vehicles.")


class AnalyticsJurisdiction(BaseModel):
    """Indian RTO state jurisdiction breakdown."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    code: str = Field(..., description="2-letter state code (e.g. DL, UP, HR).")
    name: str = Field(..., description="Full state name.")
    count: int = Field(..., description="Number of plates identified with this prefix.")
    share: float = Field(..., description="Share percentage among recognized plates.")


class AnalyticsPlateMetrics(BaseModel):
    """Detailed license plate localization and OCR recognition metrics."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    total_detected: int = Field(..., description="Total plates localized by plate detector.")
    recognized: int = Field(..., description="Plates with successfully extracted OCR text.")
    unreadable: int = Field(..., description="Plates localized where OCR could not extract text.")
    recognition_rate: Optional[float] = Field(None, description="Percentage of detected plates successfully read.")
    top_jurisdictions: List[AnalyticsJurisdiction] = Field(default_factory=list, description="Top detected RTO states.")


class AnalyticsMediaBreakdown(BaseModel):
    """Comparison metrics between Image and Video detection jobs."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    image_jobs: int = Field(..., description="Total image recognition jobs.")
    video_jobs: int = Field(..., description="Total video recognition jobs.")
    image_vehicles: int = Field(..., description="Vehicles detected in image jobs.")
    video_vehicles: int = Field(..., description="Vehicles detected in video jobs.")
    image_completed: int = Field(..., description="Completed image jobs.")
    image_failed: int = Field(..., description="Failed image jobs.")
    video_completed: int = Field(..., description="Completed video jobs.")
    video_failed: int = Field(..., description="Failed video jobs.")
    image_avg_latency_ms: Optional[float] = Field(None, description="Average latency for completed image jobs.")
    video_avg_latency_ms: Optional[float] = Field(None, description="Average latency for completed video jobs.")


class AnalyticsPerformance(BaseModel):
    """Latency distribution and operational execution metrics."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    avg_latency_ms: Optional[float] = Field(None, description="Mean latency of completed jobs.")
    min_latency_ms: Optional[float] = Field(None, description="Minimum observed latency (ms).")
    max_latency_ms: Optional[float] = Field(None, description="Maximum observed latency (ms).")
    fast_count: int = Field(0, description="Jobs completing under 1000ms.")
    normal_count: int = Field(0, description="Jobs completing between 1000ms and 2500ms.")
    heavy_count: int = Field(0, description="Jobs completing over 2500ms.")


class AnalyticsHourlyBucket(BaseModel):
    """Hourly processing distribution point."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    hour: str = Field(..., description="Hour label (00:00 to 23:00).")
    count: int = Field(..., description="Number of jobs initiated in this hour.")


class AnalyticsWeekdayBucket(BaseModel):
    """Weekday processing distribution point."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    day: str = Field(..., description="Day of week (Mon, Tue, etc.).")
    count: int = Field(..., description="Number of jobs initiated on this weekday.")


class AnalyticsTimeDistribution(BaseModel):
    """Processing volume distribution across hours and weekdays."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    hourly: List[AnalyticsHourlyBucket] = Field(default_factory=list, description="24-hour job volume distribution.")
    weekday: List[AnalyticsWeekdayBucket] = Field(default_factory=list, description="7-day weekday job volume distribution.")


class AnalyticsOverviewResponse(BaseModel):
    """Consolidated response for Traffic & Recognition Analytics."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    period: AnalyticsPeriod = Field(..., description="Query period metadata.")
    summary: AnalyticsSummary = Field(..., description="Key analytics metrics.")
    activity_timeline: List[AnalyticsTimelinePoint] = Field(default_factory=list, description="Historical timeline.")
    vehicle_distribution: List[AnalyticsVehicleClass] = Field(default_factory=list, description="Vehicle class distribution.")
    plate_analytics: AnalyticsPlateMetrics = Field(..., description="Plate localization and OCR breakdown.")
    media_breakdown: AnalyticsMediaBreakdown = Field(..., description="Image vs Video metrics.")
    performance: AnalyticsPerformance = Field(..., description="Operational processing performance.")
    time_distribution: AnalyticsTimeDistribution = Field(..., description="Hourly and weekday patterns.")
    generated_at: datetime = Field(..., description="Response generation timestamp (UTC).")

