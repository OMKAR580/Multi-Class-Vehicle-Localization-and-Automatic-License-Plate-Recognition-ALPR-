"""Repository for FileMetadata persistence and retrieval."""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.file import FileMetadata


class FileRepository:
    """Async repository for file metadata database operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, file_meta: FileMetadata) -> FileMetadata:
        """Add and commit a new file metadata record."""
        self.session.add(file_meta)
        await self.session.commit()
        await self.session.refresh(file_meta)
        return file_meta

    async def get_by_id(self, file_id: str) -> Optional[FileMetadata]:
        """Retrieve file metadata by its unique ID."""
        result = await self.session.execute(
            select(FileMetadata).where(FileMetadata.id == file_id)
        )
        return result.scalars().first()

    async def get_by_user_id(
        self, user_id: str, limit: int = 50, offset: int = 0
    ) -> list[FileMetadata]:
        """Retrieve file metadata records belonging to a specific user."""
        result = await self.session.execute(
            select(FileMetadata)
            .where(FileMetadata.uploaded_by_user_id == user_id)
            .order_by(FileMetadata.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())
