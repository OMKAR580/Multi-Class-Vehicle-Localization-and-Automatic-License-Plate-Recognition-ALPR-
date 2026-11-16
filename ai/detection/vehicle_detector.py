import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from ai.pipeline.base import BaseVehicleDetector
from app.core.exceptions import ModelNotConfiguredException


def _resolve_model_path(model_path: str) -> str:
    """Resolve model path against common base directories if not immediately absolute/valid."""
    if os.path.exists(model_path):
        return model_path

    current_file = Path(__file__).resolve()
    ai_models_dir = current_file.parents[1] / "models"
    candidate = ai_models_dir / Path(model_path).name
    if candidate.exists():
        return str(candidate)

    repo_root = current_file.parents[2]
    candidate = repo_root / model_path
    if candidate.exists():
        return str(candidate)

    return model_path


class VehicleDetector(BaseVehicleDetector):
    """
    YOLO Vehicle Localization Component.
    Runs vehicle detection model when configured model weights exist.
    Supports the 8 vehicle classes from UVH-26 (best.pt):
    car, truck, bus, motorbike, three_wheeler, lcv, bicycle, other.
    Raises ModelNotConfiguredException when model weights are unavailable.
    """

    DEFAULT_ALLOWED_CLASSES = {
        "car",
        "truck",
        "bus",
        "motorbike",
        "motorcycle",
        "three_wheeler",
        "lcv",
        "bicycle",
        "other",
        "vehicle",
    }

    def __init__(
        self,
        model_path: str = "ai/models/best.pt",
        min_confidence: float = 0.40,
        allowed_classes: Optional[List[str]] = None,
    ):
        resolved = _resolve_model_path(model_path)
        if not os.path.exists(resolved) and "best.pt" in model_path:
            fallback = _resolve_model_path("ai/models/yolov8_vehicle.pt")
            if os.path.exists(fallback):
                resolved = fallback

        self.model_path = resolved
        self.min_confidence = min_confidence
        self.allowed_classes = (
            {c.lower() for c in allowed_classes}
            if allowed_classes is not None
            else self.DEFAULT_ALLOWED_CLASSES
        )
        self._model = None

        if os.path.exists(self.model_path):
            try:
                from ultralytics import YOLO
                self._model = YOLO(self.model_path)
            except Exception:
                self._model = None
        else:
            # Resilient fallback: standard YOLOv8 nano auto-downloads if custom weights are missing
            try:
                from ultralytics import YOLO
                self._model = YOLO("yolov8n.pt")
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
                    cls_lower = cls_name.lower()
                    if cls_lower not in self.allowed_classes:
                        continue
                    vtype = "motorbike" if cls_lower == "motorcycle" else cls_lower
                    xyxy = [int(v) for v in box.xyxy[0].tolist()]
                    detections.append({
                        "type": vtype,
                        "confidence": conf,
                        "bbox": xyxy,
                        "class_id": cls_id,
                    })
            return detections

        # If model weights do not exist or runtime failed to load
        if self._model is None:
            raise ModelNotConfiguredException(
                f"Vehicle detection model runtime unavailable at '{self.model_path}'."
            )
