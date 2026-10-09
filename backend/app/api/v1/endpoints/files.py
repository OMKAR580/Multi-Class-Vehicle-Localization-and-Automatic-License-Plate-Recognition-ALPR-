"""File upload API endpoints for VisionPlate AI."""

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.file import FileUploadResponse
from app.services.file_service import FileService
from app.services.storage_service import BaseStorageService, get_storage_service

router = APIRouter(prefix="/files", tags=["Files"])


@router.post(
    "/upload",
    response_model=FileUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Secure Upload for Vehicle Images and Videos",
    description="""
Upload a vehicle image or video asset for future AI processing and ALPR detection.

### Requirements & Policies:
- **Authentication**: Requires a valid JWT Bearer token in the `Authorization` header (`Authorization: Bearer <token>`).
- **Owner ID**: The asset owner is strictly and exclusively assigned to the authenticated user.
- **Accepted Formats**:
  - Images: JPEG (`.jpg`, `.jpeg`), PNG (`.png`)
  - Videos: MP4 (`.mp4`)
- **Validation**:
  - Filename extensions, declared `Content-Type`, and actual file magic bytes must align.
  - Images are structurally decoded and verified via Pillow (rejects corrupt/truncated files and decompression bombs).
  - Videos undergo ISOBMFF box container validation.
- **Storage Security**:
  - Server generates unpredictable, collision-resistant storage keys.
  - Assets are stored privately; raw local paths and storage internals are never exposed.
  - Overwrites and path-traversal attempts are strictly prevented.
- **Size Limits**: Enforced incrementally during chunk streaming (default: 15 MB).

### Error Responses:
- **400 Bad Request**: Empty, malformed, truncated, or extension/MIME mismatched file.
- **401 Unauthorized**: Missing, expired, or invalid authentication token.
- **413 Payload Too Large**: Upload exceeds the maximum allowable file size.
- **415 Unsupported Media Type**: Disallowed file extension or unapproved `Content-Type`.
- **500 Internal Server Error**: Storage backend or database transaction failure.
    """,
    responses={
        201: {"description": "Asset successfully validated, stored, and recorded."},
        400: {"description": "Malformed, empty, or mismatched file."},
        401: {"description": "Missing or invalid authentication token."},
        413: {"description": "File exceeds maximum allowable size limit."},
        415: {"description": "Unsupported media format or MIME type."},
        500: {"description": "Internal storage or database persistence error."},
    },
)
async def upload_file(
    file: UploadFile = File(..., description="Multipart file stream for image or video."),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageService = Depends(get_storage_service),
) -> FileUploadResponse:
    """Handle secure authenticated multipart file upload."""
    service = FileService(db=db, storage=storage)
    return await service.upload_file(file=file, current_user=current_user)
