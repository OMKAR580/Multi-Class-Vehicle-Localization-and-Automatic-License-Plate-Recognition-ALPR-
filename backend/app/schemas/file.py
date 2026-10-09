"""Schemas for file uploads and asset metadata."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class FileUploadResponse(BaseModel):
    """Schema returned upon successful file upload."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str = Field(..., description="Unique asset identifier (UUID).")
    filename: str = Field(..., description="Sanitized original filename.")
    storage_key: str = Field(
        ...,
        validation_alias="file_path",
        description="Server-generated unique storage key.",
    )
    mime_type: str = Field(..., description="Validated MIME content type.")
    file_size_bytes: int = Field(..., description="Validated file size in bytes.")
    uploaded_by_user_id: str | None = Field(
        None, description="Identifier of the authenticated user who uploaded the asset."
    )
    created_at: datetime = Field(..., description="Timestamp when the asset was created.")
