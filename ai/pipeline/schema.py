from typing import List, Optional
from pydantic import BaseModel, Field

class PlateBoundingBox(BaseModel):
    text: str = Field(..., description="Recognized Indian license plate text (e.g., RJ14AB1234)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score for OCR extraction")
    bbox: List[int] = Field(..., min_length=4, max_length=4, description="Plate bounding box [xmin, ymin, xmax, ymax]")

class VehicleBoundingBox(BaseModel):
    type: str = Field(..., description="Detected vehicle type: car, truck, bus, motorbike")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Vehicle detection confidence score")
    bbox: List[int] = Field(..., min_length=4, max_length=4, description="Vehicle bounding box [xmin, ymin, xmax, ymax]")
    plate: Optional[PlateBoundingBox] = Field(None, description="Extracted license plate details")

class StandardAIOutputContract(BaseModel):
    image_id: str = Field(..., description="Unique image identifier or file name")
    vehicles: List[VehicleBoundingBox] = Field(default_factory=list, description="List of detected vehicles")
