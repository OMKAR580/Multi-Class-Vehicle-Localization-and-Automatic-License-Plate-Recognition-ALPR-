"""Pydantic schemas for the VisionPlate AI Reports Workspace."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

ReportTypeLiteral = Literal[
    "recognition_summary",
    "vehicle_distribution",
    "plate_recognition",
    "processing_performance",
    "media_breakdown",
    "custom_range",
]

ReportFormatLiteral = Literal["pdf", "csv", "json"]


class ReportFilterParams(BaseModel):
    """Filters applicable to report generation."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    days: Optional[int] = Field(None, description="Preset duration in days (e.g. 7, 30, 90).")
    start_date: Optional[datetime] = Field(None, description="Inclusive start datetime (UTC).")
    end_date: Optional[datetime] = Field(None, description="Inclusive end datetime (UTC).")
    media_type: Optional[str] = Field("all", description="Media category ('all', 'image', 'video').")
    status: Optional[str] = Field("all", description="Job execution status ('all', 'COMPLETED', 'FAILED').")
    vehicle_class: Optional[str] = Field("all", description="Specific vehicle category or 'all'.")


class ReportPreviewRequest(BaseModel):
    """Request payload for generating an on-demand report preview."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    report_type: ReportTypeLiteral = Field(
        "recognition_summary", description="Template identifier for the requested report."
    )
    filters: Optional[ReportFilterParams] = Field(
        default_factory=ReportFilterParams, description="Applied filter criteria."
    )


class ReportExportRequest(BaseModel):
    """Request payload for exporting a report to a downloadable file."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    report_type: ReportTypeLiteral = Field(
        "recognition_summary", description="Template identifier for the report."
    )
    format: ReportFormatLiteral = Field(
        "pdf", description="Requested export format: 'pdf', 'csv', or 'json'."
    )
    filters: Optional[ReportFilterParams] = Field(
        default_factory=ReportFilterParams, description="Applied filter criteria."
    )


class ReportTemplateInfo(BaseModel):
    """Metadata regarding an available report template."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str = Field(..., description="Unique template identifier.")
    title: str = Field(..., description="Human-readable report title.")
    description: str = Field(..., description="Detailed description of contents and purpose.")
    category: str = Field(..., description="Functional category (e.g. Executive, Operational, Compliance).")
    supported_formats: List[str] = Field(default=["pdf", "csv", "json"], description="Supported export formats.")


class ReportOverviewResponse(BaseModel):
    """High-level reporting overview and template catalog."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    templates: List[ReportTemplateInfo] = Field(default_factory=list, description="Catalog of available templates.")
    total_user_records: int = Field(..., description="Total detection records owned by user.")
    earliest_record_date: Optional[datetime] = Field(None, description="Timestamp of first persisted record.")
    latest_record_date: Optional[datetime] = Field(None, description="Timestamp of most recent persisted record.")
    supported_formats: List[str] = Field(default=["pdf", "csv", "json"], description="Global export formats.")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Metadata generation timestamp.")


class ReportColumn(BaseModel):
    """Definition for tabular report columns."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    key: str = Field(..., description="Data key corresponding to row attributes.")
    label: str = Field(..., description="Display header for the column.")
    type: str = Field("string", description="Render type: 'string', 'number', 'percentage', 'badge'.")


class ReportPreviewResponse(BaseModel):
    """Full preview structure rendered prior to exporting."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    report_id: str = Field(..., description="Deterministic generation identifier.")
    report_title: str = Field(..., description="Official title of the generated report.")
    report_type: str = Field(..., description="Report template identifier.")
    period_start: datetime = Field(..., description="Inclusive report start boundary (UTC).")
    period_end: datetime = Field(..., description="Inclusive report end boundary (UTC).")
    timezone: str = Field("UTC", description="Explicit timezone applied to all timestamp representations.")
    applied_filters: Dict[str, Any] = Field(default_factory=dict, description="Summary of active query filters.")
    summary_kpis: Dict[str, Any] = Field(default_factory=dict, description="Headline metric values for the report.")
    columns: List[ReportColumn] = Field(default_factory=list, description="Tabular column definitions.")
    rows: List[Dict[str, Any]] = Field(default_factory=list, description="Row-level dataset matching filters.")
    total_rows: int = Field(..., description="Total rows in the tabular dataset.")
    definitions: Dict[str, str] = Field(default_factory=dict, description="Definitions of terms and calculations.")
    caveats: List[str] = Field(default_factory=list, description="Explicit data limitations and boundaries.")
    generated_at: datetime = Field(..., description="Report generation timestamp (UTC).")


class ReportGenerateRequest(BaseModel):
    """Request payload to generate and persist a report."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    report_type: ReportTypeLiteral = Field(
        "recognition_summary", description="Template identifier for the report."
    )
    format: ReportFormatLiteral = Field(
        "pdf", description="Requested export format: 'pdf', 'csv', or 'json'."
    )
    title: Optional[str] = Field(None, max_length=255, description="Custom human-readable report title.")
    folder_id: Optional[str] = Field(None, description="Optional folder UUID for logical grouping.")
    filters: Optional[ReportFilterParams] = Field(
        default_factory=ReportFilterParams, description="Applied filter criteria."
    )


class SavedReportResponse(BaseModel):
    """Metadata representation of a persisted report."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str = Field(..., description="Unique report UUID.")
    user_id: Optional[str] = Field(None, description="Owner user UUID.")
    folder_id: Optional[str] = Field(None, description="Enclosing folder UUID if assigned.")
    title: str = Field(..., description="Human-readable report title.")
    report_type: str = Field(..., description="Report template identifier.")
    file_format: str = Field(..., description="Artifact file format ('pdf', 'csv', 'json').")
    file_size_bytes: int = Field(0, description="Size of persisted artifact in bytes.")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Snapshot of generation filter criteria.")
    report_data: Optional[Dict[str, Any]] = Field(None, description="Snapshot of headline KPIs and metadata.")
    created_at: datetime = Field(..., description="Creation timestamp (UTC).")
    updated_at: datetime = Field(..., description="Last update timestamp (UTC).")


class SavedReportListResponse(BaseModel):
    """Paginated collection of user's saved reports."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    items: List[SavedReportResponse] = Field(default_factory=list, description="Page of saved report records.")
    total: int = Field(..., description="Total matching saved reports.")
    page: int = Field(..., description="Current page number (1-based).")
    page_size: int = Field(..., description="Page size limit.")
    total_pages: int = Field(..., description="Total pages available.")


# =============================================================================
# REPORT FOLDER MANAGEMENT SCHEMAS
# =============================================================================

class FolderCreateRequest(BaseModel):
    """Payload to create a new report organization folder."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=255, description="Unique folder display name.")
    description: Optional[str] = Field(None, max_length=512, description="Optional folder description.")
    color: Optional[str] = Field("orange", max_length=50, description="Badge or icon theme color.")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Folder name cannot be blank or whitespace only.")
        return trimmed


class FolderUpdateRequest(BaseModel):
    """Payload to update an existing folder's name, description, or color."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    name: Optional[str] = Field(None, min_length=1, max_length=255, description="New folder display name.")
    description: Optional[str] = Field(None, max_length=512, description="New folder description.")
    color: Optional[str] = Field(None, max_length=50, description="New folder color.")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("Folder name cannot be blank or whitespace only.")
            return trimmed
        return v


class FolderResponse(BaseModel):
    """Metadata and report count for a persisted report folder."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str = Field(..., description="Unique folder UUID.")
    user_id: Optional[str] = Field(None, description="Owner user UUID.")
    name: str = Field(..., description="Folder display name.")
    description: Optional[str] = Field(None, description="Folder description.")
    color: str = Field("orange", description="Folder theme color.")
    report_count: int = Field(0, description="Total reports assigned to this folder.")
    created_at: datetime = Field(..., description="Folder creation timestamp (UTC).")
    updated_at: datetime = Field(..., description="Last update timestamp (UTC).")


class FolderListResponse(BaseModel):
    """Collection of report folders owned by the authenticated user."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    items: List[FolderResponse] = Field(default_factory=list, description="User's report folders.")
    total: int = Field(..., description="Total folder count.")


class ReportMoveRequest(BaseModel):
    """Payload to move a report to a folder or unorganize it."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    folder_id: Optional[str] = Field(None, description="Target folder UUID, or None to unorganize.")


class ReportMoveResponse(BaseModel):
    """Response confirming report folder assignment."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    status: str = Field("success", description="Status indicator.")
    report_id: str = Field(..., description="Report UUID.")
    folder_id: Optional[str] = Field(None, description="Current assigned folder UUID or None.")
    message: str = Field("Report moved successfully.", description="Status message.")



