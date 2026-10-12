"""Storage abstraction and private local filesystem implementation for VisionPlate AI."""

import shutil
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.core.exceptions import StorageException
from app.core.logging import logger


class BaseStorageService(ABC):
    """Abstract interface for private asset storage."""

    @abstractmethod
    async def store(self, temp_file_path: Path, storage_key: str) -> str:
        """Move or persist the temporary file to permanent storage under storage_key."""
        pass

    @abstractmethod
    async def delete(self, storage_key: str) -> bool:
        """Delete the asset identified by storage_key. Returns True if deleted, False if not found."""
        pass

    @abstractmethod
    async def exists(self, storage_key: str) -> bool:
        """Check whether an asset exists under storage_key."""
        pass

    @abstractmethod
    async def get_path(self, storage_key: str) -> Path:
        """Get filesystem path for an asset under storage_key."""
        pass

    @abstractmethod
    async def read_bytes(self, storage_key: str) -> bytes:
        """Read asset contents as bytes."""
        pass

    @staticmethod
    def generate_storage_key(extension: str) -> str:
        """
        Generate a cryptographically unpredictable, collision-resistant storage key.
        Client filenames are never used to determine the storage key.
        """
        now = datetime.now(timezone.utc)
        safe_ext = extension.lower()
        if safe_ext and not safe_ext.startswith("."):
            safe_ext = f".{safe_ext}"
        random_id = uuid.uuid4().hex
        return f"{now.year}/{now.month:02d}/{now.day:02d}/{random_id}{safe_ext}"


class LocalStorageService(BaseStorageService):
    """
    Private local-filesystem storage provider for development, staging, and automated testing.
    Assets are stored privately and never exposed via raw filesystem URLs.
    """

    def __init__(self, base_dir: Path | str | None = None):
        if base_dir is None:
            base_dir = Path(settings.STORAGE_LOCAL_ROOT)
        self.base_dir = Path(base_dir).resolve()
        self._ensure_storage_dir()

    def _ensure_storage_dir(self) -> None:
        """Ensure the base storage directory exists with private permissions."""
        try:
            self.base_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            logger.error("Failed to initialize storage directory: %s", exc)
            raise StorageException("Storage backend initialization failed.") from exc

    def _resolve_path(self, storage_key: str) -> Path:
        """
        Resolve storage_key to an absolute filesystem Path and enforce path-traversal protection.
        """
        clean_key = storage_key.lstrip("/\\")
        target_path = (self.base_dir / clean_key).resolve()
        if not target_path.is_relative_to(self.base_dir):
            logger.warning("Path traversal attempt blocked for storage key: %s", storage_key)
            raise StorageException("Invalid storage key: path traversal blocked.")
        return target_path

    async def store(self, temp_file_path: Path, storage_key: str) -> str:
        """
        Atomically move the temporary file to its final storage location.
        Enforces overwrite protection.
        """
        if not temp_file_path.exists():
            raise StorageException("Source file for storage finalization not found.")

        target_path = self._resolve_path(storage_key)

        if target_path.exists():
            raise StorageException("Storage key conflict: object already exists.")

        try:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(temp_file_path), str(target_path))
            return storage_key
        except OSError as exc:
            logger.error("Failed to persist file to local storage: %s", exc)
            raise StorageException("Failed to finalize file in storage backend.") from exc

    async def delete(self, storage_key: str) -> bool:
        """Delete an asset from local storage if it exists."""
        try:
            target_path = self._resolve_path(storage_key)
            if target_path.is_file():
                target_path.unlink()
                return True
            return False
        except Exception as exc:
            logger.error("Error deleting stored asset '%s': %s", storage_key, exc)
            return False

    async def exists(self, storage_key: str) -> bool:
        """Check if an asset exists on disk."""
        try:
            target_path = self._resolve_path(storage_key)
            return target_path.is_file()
        except Exception:
            return False

    async def get_path(self, storage_key: str) -> Path:
        """Get absolute filesystem Path for storage_key, enforcing path traversal checks."""
        target_path = self._resolve_path(storage_key)
        if not target_path.is_file():
            raise StorageException("Stored asset not found on disk.")
        return target_path

    async def read_bytes(self, storage_key: str) -> bytes:
        """Read asset bytes from disk."""
        target_path = await self.get_path(storage_key)
        try:
            return target_path.read_bytes()
        except OSError as exc:
            logger.error("Failed to read stored asset '%s': %s", storage_key, exc)
            raise StorageException("Failed to read asset contents from storage.") from exc


def get_storage_service() -> BaseStorageService:
    """FastAPI dependency provider for the configured storage service."""
    return LocalStorageService()
