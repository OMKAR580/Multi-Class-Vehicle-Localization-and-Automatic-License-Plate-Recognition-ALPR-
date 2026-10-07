from sqlalchemy import Column, String, JSON
from app.models.base import BaseModel

class AuditLog(BaseModel):
    __tablename__ = "audit_logs"

    user_id = Column(String(36), index=True, nullable=True)
    action = Column(String(100), nullable=False)  # 'LOGIN', 'DETECT_SUBMIT', 'EXPORT_REPORT'
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    details = Column(JSON, nullable=True)
