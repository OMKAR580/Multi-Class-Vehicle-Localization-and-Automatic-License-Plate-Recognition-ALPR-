from sqlalchemy import BigInteger, Column, String, ForeignKey
from app.models.base import BaseModel

class FileMetadata(BaseModel):
    __tablename__ = "files"

    filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    uploaded_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
