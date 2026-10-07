from sqlalchemy import Column, String, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Report(BaseModel):
    __tablename__ = "reports"

    title = Column(String(255), nullable=False)
    report_type = Column(String(50), nullable=False)  # 'daily_summary', 'violation_log'
    generated_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    download_url = Column(String(512), nullable=True)
    filter_params = Column(JSON, nullable=True)

    user = relationship("User", back_populates="reports")
