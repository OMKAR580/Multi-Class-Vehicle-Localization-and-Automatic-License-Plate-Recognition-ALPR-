from sqlalchemy import Column, Float, ForeignKey, Integer, String, JSON
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class DetectionJob(BaseModel):
    __tablename__ = "detections"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), default="PENDING", index=True)  # PENDING, PROCESSING, COMPLETED, FAILED
    media_type = Column(String(50), default="image")  # 'image', 'video'
    media_url = Column(String(512), nullable=False)
    processing_time_ms = Column(Float, nullable=True)
    error_message = Column(String(1024), nullable=True)
    
    # Store full JSON output contract snapshot
    raw_result = Column(JSON, nullable=True)

    user = relationship("User", back_populates="detections")
    vehicles = relationship("Vehicle", back_populates="detection_job", cascade="all, delete-orphan")

class Vehicle(BaseModel):
    __tablename__ = "vehicles"

    detection_job_id = Column(String(36), ForeignKey("detections.id", ondelete="CASCADE"), nullable=False)
    vehicle_type = Column(String(50), nullable=False)  # car, truck, bus, motorbike
    confidence = Column(Float, nullable=False)
    bbox = Column(JSON, nullable=False)  # [xmin, ymin, xmax, ymax]

    detection_job = relationship("DetectionJob", back_populates="vehicles")
    plate = relationship("Plate", back_populates="vehicle", uselist=False, cascade="all, delete-orphan")

class Plate(BaseModel):
    __tablename__ = "plates"

    vehicle_id = Column(String(36), ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False)
    plate_text = Column(String(50), index=True, nullable=False)
    confidence = Column(Float, nullable=False)
    bbox = Column(JSON, nullable=False)  # [xmin, ymin, xmax, ymax]
    crop_url = Column(String(512), nullable=True)

    vehicle = relationship("Vehicle", back_populates="plate")
