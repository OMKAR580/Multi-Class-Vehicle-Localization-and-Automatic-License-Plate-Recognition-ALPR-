from typing import List, Optional
from pydantic import BaseModel, Field

class LicensePlateResult(BaseModel):
    text: str = Field(..., description="Recognized license plate alphanumeric characters")
    confidence: float = Field(..., ge=0.0, le=1.0, description="OCR confidence score")
    bbox: List[int] = Field(..., min_length=4, max_length=4, description="Plate bounding box [xmin, ymin, xmax, ymax]")

class VehicleResult(BaseModel):
    type: str = Field(..., description="Detected vehicle category e.g. car, truck, bus, motorbike")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score")
    bbox: List[int] = Field(..., min_length=4, max_length=4, description="Vehicle bounding box [xmin, ymin, xmax, ymax]")
    plate: Optional[LicensePlateResult] = Field(None, description="Extracted license plate if detected")

class AIDetectionResponse(BaseModel):
    image_id: str = Field(..., description="Unique identifier for the processed image or video frame")
    vehicles: List[VehicleResult] = Field(default_factory=list, description="List of localized vehicles and plates")

class DetectionJobCreate(BaseModel):
    media_type: str = "image"
    media_url: str

class DetectionJobStatus(BaseModel):
    id: str
    status: str
    media_type: str
    media_url: str
    processing_time_ms: Optional[float] = None
    result: Optional[AIDetectionResponse] = None
