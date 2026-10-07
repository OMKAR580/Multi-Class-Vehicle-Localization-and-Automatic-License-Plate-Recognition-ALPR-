from abc import ABC, abstractmethod
from typing import Any, List, Dict
from ai.pipeline.schema import VehicleBoundingBox, PlateBoundingBox

class BaseVehicleDetector(ABC):
    @abstractmethod
    def detect(self, image: Any) -> List[Dict[str, Any]]:
        """Detect vehicle bounding boxes and categories."""
        pass

class BasePlateDetector(ABC):
    @abstractmethod
    def detect_plate(self, vehicle_crop: Any) -> Optional[List[int]]:
        """Detect license plate bounding box within vehicle crop."""
        pass

class BasePlateOCR(ABC):
    @abstractmethod
    def extract_text(self, plate_crop: Any) -> Tuple[str, float]:
        """Extract alphanumeric text and confidence score from plate crop."""
        pass

class BasePostProcessor(ABC):
    @abstractmethod
    def clean_plate_text(self, raw_text: str) -> str:
        """Validate and format character output for Indian license plate standards."""
        pass
