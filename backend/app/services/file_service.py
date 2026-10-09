"""File upload orchestration service for VisionPlate AI."""

import os
import tempfile
import uuid
from pathlib import Path
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    InvalidFileException,
    PayloadTooLargeException,
    StorageException,
)
from app.core.logging import logger
from app.models.file import FileMetadata
from app.models.user import User
from app.repositories.file_repository import FileRepository
from app.schemas.file import FileUploadResponse
from app.services.file_validation_service import validate_file
from app.services.storage_service import BaseStorageService

CHUNK_SIZE = 64 * 1024  # 64 KB streaming chunks


class FileService:
    """Orchestrates secure streaming upload, validation, private storage, and metadata persistence."""

    def __init__(self, db: AsyncSession, storage: BaseStorageService):
        self.db = db
        self.storage = storage
        self.repo = FileRepository(db)

    async def upload_file(
        self,
        file: UploadFile,
        current_user: User,
    ) -> FileUploadResponse:
        """
        Securely stream, validate, store, and record an uploaded media asset.

        Args:
            file: Incoming FastAPI UploadFile multipart stream.
            current_user: Authenticated User entity.

        Returns:
            FileUploadResponse containing safe asset ID and metadata.
        """
        temp_file = tempfile.NamedTemporaryFile(delete=False)
        temp_path = Path(temp_file.name)
        total_bytes = 0
        storage_key: str | None = None

        try:
            # 1. Stream data incrementally with bounded memory & size limit enforcement
            try:
                while chunk := await file.read(CHUNK_SIZE):
                    total_bytes += len(chunk)
                    if total_bytes > settings.MAX_UPLOAD_SIZE_BYTES:
                        raise PayloadTooLargeException(
                            f"File size exceeds maximum allowable limit of {settings.MAX_UPLOAD_SIZE_BYTES} bytes."
                        )
                    temp_file.write(chunk)
            finally:
                temp_file.close()

            # 2. Reject zero-byte uploads
            if total_bytes == 0:
                raise InvalidFileException("Uploaded file is empty (0 bytes).")

            # 3. Comprehensive multi-layered validation (magic bytes, dimensions, structure)
            sanitized_name, canonical_mime = await validate_file(
                temp_path=temp_path,
                original_filename=file.filename,
                declared_content_type=file.content_type,
                file_size_bytes=total_bytes,
            )

            # 4. Generate collision-resistant unique storage key (independent of client filename)
            ext = os.path.splitext(sanitized_name)[1].lower()
            storage_key = self.storage.generate_storage_key(ext)

            # 5. Finalize storage (atomic move from temp location to permanent storage)
            await self.storage.store(temp_path, storage_key)

            # 6. Database record persistence with authenticated user ownership
            file_meta = FileMetadata(
                id=str(uuid.uuid4()),
                filename=sanitized_name,
                file_path=storage_key,
                mime_type=canonical_mime,
                file_size_bytes=total_bytes,
                uploaded_by_user_id=current_user.id,
            )

            try:
                created_meta = await self.repo.create(file_meta)
                logger.info(
                    "Asset uploaded successfully: id=%s, user_id=%s, size=%d bytes, mime=%s",
                    created_meta.id,
                    current_user.id,
                    total_bytes,
                    canonical_mime,
                )
                return FileUploadResponse.model_validate(created_meta)
            except Exception as db_exc:
                logger.error("Database persistence failed for asset '%s': %s", storage_key, db_exc)
                # Cleanup stored object if database commit failed (prevent orphaned assets)
                if storage_key:
                    await self.storage.delete(storage_key)
                raise StorageException("Failed to persist file metadata record.") from db_exc

        finally:
            # Always ensure temporary upload artifact is cleaned up
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError as err:
                    logger.warning("Could not delete temporary file '%s': %s", temp_path, err)
