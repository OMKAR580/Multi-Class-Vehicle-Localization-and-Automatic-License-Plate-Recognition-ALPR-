import os
from typing import Any, List, Optional
from ai.pipeline.base import BasePlateDetector
from app.core.exceptions import ModelNotConfiguredException


class PlateDetector(BasePlateDetector):
    """
    License Plate Region of Interest (ROI) Localization Component.
    Runs license plate detection on vehicle crops.
    """

    def __init__(
        self,
        model_path: str = "ai/models/yolov8_plate.pt",
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

    def detect_plate(self, vehicle_crop: Any) -> Optional[List[int]]:
        """
        Detect license plate bounding box [xmin, ymin, xmax, ymax] relative to vehicle_crop.
        Returns None if no plate is detected.
        """
        if self._model is not None:
            results = self._model(vehicle_crop, verbose=False)
            best_plate = None
            best_conf = 0.0
            for r in results:
                for box in r.boxes:
                    conf = float(box.conf[0])
                    if conf >= self.min_confidence and conf > best_conf:
                        best_conf = conf
                        best_plate = [int(v) for v in box.xyxy[0].tolist()]
            return best_plate

        if not os.path.exists(self.model_path):
            raise ModelNotConfiguredException(
                f"License plate detection model weights not found at '{self.model_path}'."
            )

        return None
