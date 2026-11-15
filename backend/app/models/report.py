from sqlalchemy import BigInteger, Column, ForeignKey, Index, JSON, String, func
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class ReportFolder(BaseModel):
    """Logical organization folder for grouping persisted audit and compliance reports."""

    __tablename__ = "report_folders"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(512), nullable=True)
    color = Column(String(50), nullable=True, default="orange")

    __table_args__ = (
        Index("uq_report_folders_user_lower_name", "user_id", func.lower(name), unique=True),
    )

    # Relationships
    user = relationship("User", back_populates="report_folders")
    reports = relationship("Report", back_populates="folder")


class Report(BaseModel):
    """Persisted audit report entity capturing execution metadata, summary snapshot, and storage reference."""

    __tablename__ = "reports"
    __table_args__ = (
        Index("ix_reports_user_id_created_at", "user_id", "created_at"),
    )

    title = Column(String(255), nullable=False)
    report_type = Column(String(50), nullable=False)  # 'recognition_summary', 'vehicle_distribution', etc.
    file_format = Column(String(10), nullable=False, default="pdf")  # 'pdf', 'csv', 'json'
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    folder_id = Column(String(36), ForeignKey("report_folders.id", ondelete="SET NULL"), nullable=True, index=True)
    storage_key = Column(String(512), nullable=True)
    file_size_bytes = Column(BigInteger, nullable=False, default=0)
    parameters = Column(JSON, nullable=True)
    file_url = Column(String(512), nullable=True)
    report_data = Column(JSON, nullable=True)

    # Relationships
    user = relationship("User", back_populates="reports")
    folder = relationship("ReportFolder", back_populates="reports")
