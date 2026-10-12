import os
from typing import Any, Dict, List
from ai.pipeline.base import BaseVehicleDetector
from app.core.exceptions import ModelNotConfiguredException


class VehicleDetector(BaseVehicleDetector):
    """
    YOLO Vehicle Localization Component.
    Runs vehicle detection model when configured model weights exist.
    Raises ModelNotConfiguredException when model weights are unavailable.
    """

    def __init__(
        self,
        model_path: str = "ai/models/yolov8_vehicle.pt",
        min_confidence: float = 0.40,
    ):
        self.model_path = model_path
        self.min_confidence = min_confidence
        self._model = None

        if os.path.exists(self.model_path):
            try:
                from ultralytics import YOLO
                self._model = YOLO(self.model_path)
            except Exception:
                self._model = None

    def detect(self, image: Any) -> List[Dict[str, Any]]:
        """
        Detect vehicles in an image (numpy array / PIL Image).
        Returns list of dicts: [{"type": "car", "confidence": 0.95, "bbox": [xmin, ymin, xmax, ymax]}]
        """
        if self._model is not None:
            results = self._model(image, verbose=False)
            detections = []
            for r in results:
                for box in r.boxes:
                    conf = float(box.conf[0])
                    if conf < self.min_confidence:
                        continue
                    cls_id = int(box.cls[0])
                    cls_name = self._model.names.get(cls_id, "car")
                    if cls_name.lower() not in ["car", "truck", "bus", "motorbike", "motorcycle", "vehicle"]:
                        continue
                    vtype = "motorbike" if cls_name.lower() == "motorcycle" else cls_name.lower()
                    xyxy = [int(v) for v in box.xyxy[0].tolist()]
                    detections.append({
                        "type": vtype,
                        "confidence": conf,
                        "bbox": xyxy
                    })
            return detections

        # If model weights do not exist or failed to load
        if not os.path.exists(self.model_path):
            raise ModelNotConfiguredException(
                f"Vehicle detection model weights not found at '{self.model_path}'."
            )

        return []
