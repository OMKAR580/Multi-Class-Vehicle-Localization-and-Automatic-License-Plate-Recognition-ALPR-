"""Visualization and image annotation module for ALPR detection results."""

import base64
import io
from abc import ABC, abstractmethod
from typing import Any, List, Optional
import numpy as np
from PIL import Image

try:
    from ai.pipeline.base import BaseVisualizer
except ImportError:
    class BaseVisualizer(ABC):
        @abstractmethod
        def annotate(self, image: Any, contract: Any) -> Any:
            pass

from ai.pipeline.schema import StandardAIOutputContract


class PipelineVisualizer(BaseVisualizer):
    """
    Renders bounding boxes and label tags for detected vehicles and license plates.
    Outputs annotated images in numpy format or base64-encoded strings.
    """

    def __init__(
        self,
        vehicle_color: tuple = (0, 200, 0),       # Green for vehicles
        plate_color: tuple = (0, 165, 255),       # Orange/Yellow for plates
        unassociated_plate_color: tuple = (0, 0, 255), # Red for unassociated
        font_scale: float = 0.5,
        thickness: int = 2,
    ):
        self.vehicle_color = vehicle_color
        self.plate_color = plate_color
        self.unassociated_plate_color = unassociated_plate_color
        self.font_scale = font_scale
        self.thickness = thickness

    def _to_cv2(self, image: Any) -> np.ndarray:
        """Convert input image (PIL or numpy) to an OpenCV BGR numpy array."""
        try:
            import cv2
        except ImportError:
            raise RuntimeError("OpenCV (cv2) is required for PipelineVisualizer.")

        if isinstance(image, Image.Image):
            arr = np.array(image)
            if arr.ndim == 3 and arr.shape[2] == 3:
                return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
            elif arr.ndim == 3 and arr.shape[2] == 4:
                return cv2.cvtColor(arr, cv2.COLOR_RGBA2BGR)
            elif arr.ndim == 2:
                return cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)
            return arr
        elif isinstance(image, np.ndarray):
            return image.copy()
        else:
            raise ValueError(f"Unsupported image type: {type(image)}")

    def annotate(self, image: Any, contract: StandardAIOutputContract) -> np.ndarray:
        """
        Draw bounding boxes and detection labels on a copy of the input image.

        Args:
            image: Source PIL Image or numpy array.
            contract: StandardAIOutputContract containing vehicles and plates.

        Returns:
            Annotated image as BGR numpy array.
        """
        try:
            import cv2
        except ImportError:
            return image

        annotated = self._to_cv2(image)

        # 1. Annotate vehicles and their associated plates
        for v in contract.vehicles:
            vx1, vy1, vx2, vy2 = v.bbox
            cv2.rectangle(annotated, (vx1, vy1), (vx2, vy2), self.vehicle_color, self.thickness)

            v_label = f"{v.type} {v.confidence:.2f}"
            (w, h), _ = cv2.getTextSize(v_label, cv2.FONT_HERSHEY_SIMPLEX, self.font_scale, 1)
            cv2.rectangle(annotated, (vx1, max(0, vy1 - h - 6)), (vx1 + w + 4, max(h + 6, vy1)), self.vehicle_color, -1)
            cv2.putText(
                annotated,
                v_label,
                (vx1 + 2, max(h, vy1 - 4)),
                cv2.FONT_HERSHEY_SIMPLEX,
                self.font_scale,
                (255, 255, 255),
                1,
                cv2.LINE_AA,
            )

            # Draw associated plate
            if v.plate:
                px1, py1, px2, py2 = v.plate.bbox
                cv2.rectangle(annotated, (px1, py1), (px2, py2), self.plate_color, self.thickness)

                p_text = v.plate.text if v.plate.text else "Plate"
                p_label = f"[{p_text}] {v.plate.confidence:.2f}"
                (pw, ph), _ = cv2.getTextSize(p_label, cv2.FONT_HERSHEY_SIMPLEX, self.font_scale, 1)
                cv2.rectangle(annotated, (px1, max(0, py1 - ph - 6)), (px1 + pw + 4, max(ph + 6, py1)), self.plate_color, -1)
                cv2.putText(
                    annotated,
                    p_label,
                    (px1 + 2, max(ph, py1 - 4)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    self.font_scale,
                    (0, 0, 0),
                    1,
                    cv2.LINE_AA,
                )

        # 2. Annotate unassociated plates (if any)
        for p in getattr(contract, "unassociated_plates", []):
            px1, py1, px2, py2 = p.bbox
            cv2.rectangle(annotated, (px1, py1), (px2, py2), self.unassociated_plate_color, self.thickness)
            p_text = p.text if p.text else "Plate"
            p_label = f"[{p_text}] {p.confidence:.2f}"
            (pw, ph), _ = cv2.getTextSize(p_label, cv2.FONT_HERSHEY_SIMPLEX, self.font_scale, 1)
            cv2.rectangle(annotated, (px1, max(0, py1 - ph - 6)), (px1 + pw + 4, max(ph + 6, py1)), self.unassociated_plate_color, -1)
            cv2.putText(
                annotated,
                p_label,
                (px1 + 2, max(ph, py1 - 4)),
                cv2.FONT_HERSHEY_SIMPLEX,
                self.font_scale,
                (255, 255, 255),
                1,
                cv2.LINE_AA,
            )

        return annotated

    def to_base64(self, annotated_img: np.ndarray, format: str = "JPEG") -> str:
        """Encode an annotated OpenCV image into a base64 string."""
        try:
            import cv2
            ext = ".jpg" if format.upper() == "JPEG" else f".{format.lower()}"
            success, buffer = cv2.imencode(ext, annotated_img)
            if not success:
                return ""
            return base64.b64encode(buffer).decode("utf-8")
        except Exception:
            return ""
