"""Reports API endpoints for catalog inspection, preview rendering, multi-format exports, and saved report persistence."""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.reports import (
    FolderCreateRequest,
    FolderListResponse,
    FolderResponse,
    FolderUpdateRequest,
    ReportExportRequest,
    ReportGenerateRequest,
    ReportMoveRequest,
    ReportMoveResponse,
    ReportOverviewResponse,
    ReportPreviewRequest,
    ReportPreviewResponse,
    SavedReportListResponse,
    SavedReportResponse,
)
from app.services.reports_service import ReportsService
from app.services.storage_service import BaseStorageService, get_storage_service

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get(
    "/overview",
    response_model=ReportOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Reporting Catalog & User Metadata",
    description="""
Fetch available report templates, lifetime record counts, earliest/latest timestamps, and supported export formats for the authenticated user.
    """,
    responses={
        200: {"description": "Reporting overview retrieved successfully."},
        401: {"description": "Authentication credentials missing or invalid."},
    },
)
async def get_reports_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageService = Depends(get_storage_service),
) -> ReportOverviewResponse:
    """Retrieve catalog of templates and user record boundaries."""
    service = ReportsService(db=db, storage=storage)
    return await service.get_reports_overview(current_user=current_user)


@router.post(
    "/preview",
    response_model=ReportPreviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Interactive On-Demand Report Preview",
    description="""
Execute on-demand report aggregation across the requested template and filter scope, returning
structured metadata, headline KPIs, and tabular row-level records for immediate client preview.
    """,
    responses={
        200: {"description": "Report preview generated successfully."},
        400: {"description": "Invalid filter boundaries or date ranges."},
        401: {"description": "Authentication credentials missing or invalid."},
    },
)
async def generate_report_preview(
    request: ReportPreviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageService = Depends(get_storage_service),
) -> ReportPreviewResponse:
    """Generate structured on-demand preview for the requested report template."""
    service = ReportsService(db=db, storage=storage)
    return await service.generate_report_preview(current_user=current_user, request=request)


@router.post(
    "/export",
    status_code=status.HTTP_200_OK,
    summary="Export Report to PDF, CSV, or JSON",
    description="""
Generate a downloadable audit report file in PDF, RFC 4180 CSV, or JSON format using real database records.
Streams generated document directly to the client without forcing server-side persistence.
    """,
    responses={
        200: {"description": "Report exported successfully."},
        400: {"description": "Invalid format or date parameters."},
        401: {"description": "Authentication credentials missing or invalid."},
    },
)
async def export_report(
    request: ReportExportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageService = Depends(get_storage_service),
):
    """Generate and stream downloadable PDF, CSV, or JSON report."""
    service = ReportsService(db=db, storage=storage)
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")

    if request.format == "pdf":
        pdf_stream = await service.export_report_pdf(current_user=current_user, request=request)
        filename = f"visionplate_{request.report_type}_{date_str}.pdf"
        return Response(
            content=pdf_stream.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    elif request.format == "csv":
        csv_content = await service.export_report_csv(current_user=current_user, request=request)
        filename = f"visionplate_{request.report_type}_{date_str}.csv"
        return Response(
            content=csv_content.encode("utf-8"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    elif request.format == "json":
        json_content = await service.export_report_json(current_user=current_user, request=request)
        filename = f"visionplate_{request.report_type}_{date_str}.json"
        return Response(
            content=json_content.encode("utf-8"),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    else:
        return Response(
            content=b'{"error": "Unsupported export format"}',
            status_code=status.HTTP_400_BAD_REQUEST,
            media_type="application/json",
        )


# =============================================================================
# PERSISTENT SAVED REPORT MANAGEMENT ENDPOINTS
# =============================================================================

@router.post(
    "/generate",
    response_model=SavedReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate and Persist Report",
    description="""
Executes full report generation, writes the rendered document artifact to private storage,
and saves the metadata record in PostgreSQL. Employs compensating cleanup on persistence failure.
    """,
    responses={
        201: {"description": "Report generated and persisted successfully."},
        400: {"description": "Invalid report template, format, or folder ownership."},
        401: {"description": "Authentication credentials missing or invalid."},
        500: {"description": "Storage or database persistence failure."},
    },
)
async def generate_and_persist_report(
    request: ReportGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageService = Depends(get_storage_service),
) -> SavedReportResponse:
    """Generate, persist artifact to storage, and save metadata to PostgreSQL."""
    service = ReportsService(db=db, storage=storage)
    return await service.generate_and_persist_report(current_user=current_user, request=request)


@router.get(
    "/saved",
    response_model=SavedReportListResponse,
    status_code=status.HTTP_200_OK,
    summary="List User's Saved Reports",
    description="""
Retrieves a paginated list of previously persisted reports for the authenticated user,
with optional filtering by template type, file format, folder assignment, or title search.
    """,
    responses={
        200: {"description": "Saved reports list retrieved successfully."},
        401: {"description": "Authentication credentials missing or invalid."},
    },
)
async def list_saved_reports(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    report_type: Optional[str] = Query(None, description="Filter by report template identifier"),
    format: Optional[str] = Query(None, description="Filter by file format ('pdf', 'csv', 'json')"),
    folder_id: Optional[str] = Query(None, description="Filter by enclosing folder UUID"),
    is_uncategorized: Optional[bool] = Query(None, description="Filter reports not assigned to any folder"),
    search: Optional[str] = Query(None, description="Case-insensitive title search term"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageService = Depends(get_storage_service),
) -> SavedReportListResponse:
    """List paginated saved reports with user isolation."""
    service = ReportsService(db=db, storage=storage)
    return await service.list_saved_reports(
        current_user=current_user,
        page=page,
        page_size=page_size,
        report_type=report_type,
        file_format=format,
        folder_id=folder_id,
        is_uncategorized=is_uncategorized,
        search=search,
    )


# =============================================================================
# REPORT FOLDER CRUD & ORGANIZATION ENDPOINTS
# =============================================================================

@router.post(
    "/folders",
    response_model=FolderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Report Organization Folder",
    description="""
Creates a new logical folder for organizing saved audit reports.
Enforces per-user case-insensitive name uniqueness.
    """,
    responses={
        201: {"description": "Folder created successfully."},
        400: {"description": "Invalid folder name or attributes."},
        401: {"description": "Authentication credentials missing or invalid."},
        409: {"description": "A folder with this name already exists for this user."},
        422: {"description": "Validation error (blank name or missing fields)."},
    },
)
async def create_report_folder(
    request: FolderCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageService = Depends(get_storage_service),
) -> FolderResponse:
    """Creates a new folder owned by the authenticated user."""
    service = ReportsService(db=db, storage=storage)
    return await service.create_folder(current_user=current_user, request=request)


@router.get(
    "/folders",
    response_model=FolderListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Report Organization Folders",
    description="""
Retrieves all folders owned by the authenticated user, including report counts per folder.
Empty folders are preserved and listed with report_count=0.
    """,
    responses={
        200: {"description": "Folder list retrieved successfully."},
        401: {"description": "Authentication credentials missing or invalid."},
    },
)
async def list_report_folders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageService = Depends(get_storage_service),
) -> FolderListResponse:
    """Lists all report folders owned by the authenticated user with report counts."""
    service = ReportsService(db=db, storage=storage)
    return await service.list_folders(current_user=current_user)


@router.get(
    "/folders/{folder_id}",
    response_model=FolderResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Report Folder Details",
    description="""
Retrieves metadata and current report count for a single folder.
Strictly enforces ownership isolation; returns 404 for another user's folder.
    """,
    responses={
        200: {"description": "Folder details retrieved successfully."},
        401: {"description": "Authentication credentials missing or invalid."},
        404: {"description": "Folder not found or unauthorized."},
    },
)
async def get_report_folder(
    folder_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageService = Depends(get_storage_service),
) -> FolderResponse:
    """Retrieves single folder details with user ownership enforcement."""
    service = ReportsService(db=db, storage=storage)
    return await service.get_folder_detail(folder_id=folder_id, current_user=current_user)


@router.patch(
    "/folders/{folder_id}",
    response_model=FolderResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Report Folder Metadata",
    description="""
Updates folder name, description, or color.
Enforces per-user name uniqueness and ownership isolation.
    """,
    responses={
        200: {"description": "Folder updated successfully."},
        401: {"description": "Authentication credentials missing or invalid."},
        404: {"description": "Folder not found or unauthorized."},
        409: {"description": "Another folder with this name already exists."},
        422: {"description": "Validation error."},
    },
)
async def update_report_folder(
    folder_id: str,
    request: FolderUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageService = Depends(get_storage_service),
) -> FolderResponse:
    """Updates folder attributes with user ownership verification."""
    service = ReportsService(db=db, storage=storage)
    return await service.update_folder(
        folder_id=folder_id, current_user=current_user, request=request
    )


@router.delete(
    "/folders/{folder_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Report Folder",
    description="""
Deletes a folder while preserving all associated reports (moving them to Unorganized).
Does NOT delete physical report files or database report rows.
    """,
    responses={
        200: {"description": "Folder deleted successfully. Reports preserved."},
        401: {"description": "Authentication credentials missing or invalid."},
        404: {"description": "Folder not found or unauthorized."},
    },
)
async def delete_report_folder(
    folder_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageService = Depends(get_storage_service),
):
    """Deletes folder transactionally and unorganizes associated reports."""
    service = ReportsService(db=db, storage=storage)
    return await service.delete_folder(folder_id=folder_id, current_user=current_user)


@router.patch(
    "/{report_id}/folder",
    response_model=ReportMoveResponse,
    status_code=status.HTTP_200_OK,
    summary="Move Report to Folder or Unorganize",
    description="""
Reassigns a saved report to a target folder or unorganizes it (folder_id=null).
Strictly enforces ownership of both the report and the destination folder.
    """,
    responses={
        200: {"description": "Report moved successfully."},
        401: {"description": "Authentication credentials missing or invalid."},
        404: {"description": "Report or target folder not found or unauthorized."},
    },
)
async def move_report_to_folder(
    report_id: str,
    request: ReportMoveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageService = Depends(get_storage_service),
) -> ReportMoveResponse:
    """Moves a report to another folder or unorganizes it."""
    service = ReportsService(db=db, storage=storage)
    return await service.move_report(
        report_id=report_id, current_user=current_user, request=request
    )


@router.get(
    "/{report_id}/download",
    status_code=status.HTTP_200_OK,
    summary="Download Saved Report Artifact",
    description="""
Securely streams the persisted report artifact from private storage, enforcing strict user ownership.
Returns 404 if the report does not exist or belongs to another user (preventing IDOR enumeration).
    """,
    responses={
        200: {"description": "Report artifact stream returned successfully."},
        401: {"description": "Authentication credentials missing or invalid."},
        404: {"description": "Report not found or unauthorized."},
    },
)
async def download_saved_report(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageService = Depends(get_storage_service),
):
    """Authenticated report download endpoint with IDOR protection."""
    service = ReportsService(db=db, storage=storage)
    file_bytes, media_type, safe_filename = await service.download_saved_report(
        report_id=report_id,
        current_user=current_user,
    )
    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
    )


@router.delete(
    "/{report_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Saved Report",
    description="""
Deletes a saved report record from the database transactionally, then unlinks the physical file from storage.
Enforces strict user ownership; returns 404 for unauthorized attempts.
    """,
    responses={
        200: {"description": "Report deleted successfully."},
        401: {"description": "Authentication credentials missing or invalid."},
        404: {"description": "Report not found or unauthorized."},
    },
)
async def delete_saved_report(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageService = Depends(get_storage_service),
):
    """Authenticated report deletion endpoint."""
    service = ReportsService(db=db, storage=storage)
    await service.delete_saved_report(report_id=report_id, current_user=current_user)
    return {
        "status": "success",
        "message": "Report deleted successfully.",
        "report_id": report_id,
    }
