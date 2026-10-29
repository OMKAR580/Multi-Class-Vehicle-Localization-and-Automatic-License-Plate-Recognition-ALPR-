import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from ai.pipeline.base import BasePlateDetector
from app.core.exceptions import ModelNotConfiguredException

try:
    from app.core.config import settings
    DEFAULT_MODEL_PATH = getattr(settings, "PLATE_MODEL_PATH", "ai/models/yolov8_plate.pt")
except Exception:
    DEFAULT_MODEL_PATH = "ai/models/yolov8_plate.pt"


class PlateDetector(BasePlateDetector):
    """
    License Plate Region of Interest (ROI) Localization Component.
    Detects license plate bounding boxes on vehicle crops using a trained YOLO model.
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        min_confidence: float = 0.40,
    ):
        raw_path = str(model_path or DEFAULT_MODEL_PATH)
        if not os.path.exists(raw_path) and not os.path.isabs(raw_path):
            candidate = os.path.join(str(Path(__file__).resolve().parent.parent.parent), raw_path)
            if os.path.exists(candidate):
                raw_path = candidate
        self.model_path = raw_path
        self.min_confidence = min_confidence
        self._model = None
        self._load_error: Optional[str] = None

        if os.path.exists(self.model_path):
            try:
                from ultralytics import YOLO
                self._model = YOLO(self.model_path)
            except Exception as exc:
                self._model = None
                self._load_error = str(exc)

    def _extract_crop_dimensions(self, crop: Any) -> Optional[tuple[int, int]]:
        """Extract (width, height) from a PIL Image or numpy array safely."""
        if crop is None:
            return None
        if hasattr(crop, "size") and isinstance(crop.size, tuple) and len(crop.size) >= 2:
            width, height = int(crop.size[0]), int(crop.size[1])
            return (width, height)
        if hasattr(crop, "shape") and len(crop.shape) >= 2:
            height, width = int(crop.shape[0]), int(crop.shape[1])
            return (width, height)
        return None

    def detect_all_plates(self, vehicle_crop: Any) -> List[Dict[str, Any]]:
        """
        Detect all license plate candidate bounding boxes within a vehicle crop.
        Returns a list of dicts:
            [{"bbox": [xmin, ymin, xmax, ymax], "confidence": float, "class_id": int}]
        sorted by confidence descending.
        """
        dims = self._extract_crop_dimensions(vehicle_crop)
        if dims is None:
            return []
        width, height = dims
        if width <= 0 or height <= 0:
            return []

        if not os.path.exists(self.model_path):
            raise ModelNotConfiguredException(
                f"License plate detection model weights not found at '{self.model_path}'."
            )

        if self._model is None:
            raise ModelNotConfiguredException(
                f"License plate detection model runtime unavailable for '{self.model_path}': "
                f"{self._load_error or 'Failed to load model weights'}"
            )

        try:
            results = self._model(
                vehicle_crop,
                conf=self.min_confidence,
                iou=0.45,
                verbose=False,
            )
        except Exception as exc:
            raise ModelNotConfiguredException(
                f"Plate detection inference execution failed: {exc}"
            ) from exc

        candidates: List[Dict[str, Any]] = []
        for r in results:
            if not hasattr(r, "boxes") or r.boxes is None:
                continue
            for box in r.boxes:
                try:
                    conf = float(box.conf[0])
                except (IndexError, TypeError, ValueError):
                    continue

                if conf < self.min_confidence:
                    continue

                try:
                    raw_coords = box.xyxy[0]
                    coords = raw_coords.tolist() if hasattr(raw_coords, "tolist") else list(raw_coords)
                    xmin = max(0, min(int(round(float(coords[0]))), width))
                    ymin = max(0, min(int(round(float(coords[1]))), height))
                    xmax = max(0, min(int(round(float(coords[2]))), width))
                    ymax = max(0, min(int(round(float(coords[3]))), height))
                except Exception:
                    continue

                # Enforce strictly positive width and height
                if xmax <= xmin or ymax <= ymin:
                    continue

                cls_id = int(box.cls[0]) if hasattr(box, "cls") and len(box.cls) > 0 else 0

                candidates.append({
                    "bbox": [xmin, ymin, xmax, ymax],
                    "confidence": conf,
                    "class_id": cls_id,
                })

        candidates.sort(key=lambda c: c["confidence"], reverse=True)
        return candidates

    def detect_plate(self, vehicle_crop: Any) -> Optional[List[int]]:
        """
        Detect top license plate bounding box [xmin, ymin, xmax, ymax] relative to vehicle_crop.
        Returns None if no plate is detected or input is invalid.
        """
        all_plates = self.detect_all_plates(vehicle_crop)
        if not all_plates:
            return None
        return all_plates[0]["bbox"]
