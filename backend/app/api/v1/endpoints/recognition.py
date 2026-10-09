"""API endpoints for Vehicle Detection and License Plate Recognition (ALPR)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.recognition import ImageRecognitionRequest, RecognitionResponse
from app.services.recognition_service import RecognitionService
from app.services.storage_service import BaseStorageService, get_storage_service

router = APIRouter(prefix="/recognition", tags=["Recognition"])


@router.post(
    "/images",
    response_model=RecognitionResponse,
    status_code=status.HTTP_200_OK,
    summary="Perform Vehicle Detection & License Plate Recognition on Uploaded Image",
    description="""
Execute automated AI vehicle localization, license plate detection, and OCR text extraction on an authenticated uploaded image asset.

### Requirements & Behavior:
- **Authentication**: Requires a valid JWT Bearer token in the `Authorization` header (`Authorization: Bearer <token>`).
- **Asset Reference**: Accepts `file_id` referencing an existing uploaded asset created via `POST /api/v1/files/upload`.
- **Ownership Boundary**: Verifies that the referenced upload asset belongs to the currently authenticated user.
- **Accepted Formats**: Supported image formats only (`image/jpeg`, `image/png`).
- **Pipeline Execution**:
  - Validates image dimensions and resource bounds (`<= 4096px`).
  - Detects vehicle bounding boxes (car, truck, bus, motorbike).
  - Detects license plate regions of interest (ROI) within vehicle bounding boxes.
  - Performs OCR text extraction and Indian state code validation.
  - Strictly clamps bounding box coordinates `[xmin, ymin, xmax, ymax]` to image bounds.
- **Persistence**: Records a `DetectionJob` snapshot and ORM `Vehicle`/`Plate` entities.

### Error Statuses:
- **400 Bad Request**: Non-image file, corrupt image, or image dimensions exceeding safety limits.
- **401 Unauthorized**: Missing, expired, or invalid authentication credentials.
- **403 Forbidden / 401 Unauthorized**: Attempting to process another user's uploaded asset.
- **404 Not Found**: Referenced `file_id` asset does not exist.
- **415 Unsupported Media Type**: Referencing a non-image upload asset (e.g. MP4 video).
- **503 Service Unavailable**: Required AI model weights or runtime engine not configured on server.
    """,
    responses={
        200: {"description": "Recognition inference successfully executed and persisted."},
        400: {"description": "Corrupt image or invalid request parameters."},
        401: {"description": "Authentication credentials missing or invalid."},
        404: {"description": "Referenced upload file_id not found."},
        415: {"description": "Referenced asset is not a supported image format."},
        503: {"description": "Required AI model weights not configured on server."},
    },
)
async def recognize_image(
    request: ImageRecognitionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    storage: BaseStorageService = Depends(get_storage_service),
) -> RecognitionResponse:
    """Handle authenticated vehicle detection and ALPR inference request."""
    service = RecognitionService(db=db, storage=storage)
    return await service.process_image_recognition(request=request, current_user=current_user)
