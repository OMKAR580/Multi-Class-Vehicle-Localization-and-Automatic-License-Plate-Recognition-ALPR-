import io
from typing import Any, Optional
from PIL import Image

from ai.pipeline.base import (
    BasePlateDetector,
    BasePlateOCR,
    BasePostProcessor,
    BaseVehicleDetector,
)
from ai.pipeline.schema import (
    PlateBoundingBox,
    StandardAIOutputContract,
    VehicleBoundingBox,
)
from ai.detection.plate_detector import PlateDetector
from ai.detection.vehicle_detector import VehicleDetector
from ai.ocr.indian_plate_ocr import IndianPlateOCR
from ai.postprocessing.text_cleaner import IndianPlateCleaner
from app.core.config import settings
from app.core.exceptions import InvalidFileException, RecognitionException


def clamp_bbox(bbox: list[int], width: int, height: int) -> list[int]:
    """
    Clamp coordinates [xmin, ymin, xmax, ymax] strictly within [0, 0, width, height].
    Enforces xmin <= xmax and ymin <= ymax.
    """
    xmin = max(0, min(bbox[0], width))
    ymin = max(0, min(bbox[1], height))
    xmax = max(xmin, min(bbox[2], width))
    ymax = max(ymin, min(bbox[3], height))
    return [xmin, ymin, xmax, ymax]


class ALPRPipeline:
    """
    Modular ALPR Orchestration Pipeline following the execution contract:
    Input Image -> Dimension Check -> Vehicle Detection -> License Plate ROI Detection ->
    Plate Crop -> OCR -> Text Cleaning & State Validation -> Bound Coordinates -> Standard Output.
    """

    def __init__(
        self,
        vehicle_detector: Optional[BaseVehicleDetector] = None,
        plate_detector: Optional[BasePlateDetector] = None,
        ocr_engine: Optional[BasePlateOCR] = None,
        cleaner: Optional[BasePostProcessor] = None,
        config_path: str = "ai/configs/default_config.yaml",
    ):
        self.config_path = config_path
        self.vehicle_detector = vehicle_detector or VehicleDetector(
            model_path=settings.VEHICLE_MODEL_PATH,
            min_confidence=settings.MIN_VEHICLE_CONFIDENCE,
        )
        self.plate_detector = plate_detector or PlateDetector(
            model_path=settings.PLATE_MODEL_PATH,
            min_confidence=settings.MIN_PLATE_CONFIDENCE,
        )
        self.ocr_engine = ocr_engine or IndianPlateOCR()
        self.cleaner = cleaner or IndianPlateCleaner()

    def process_image(self, image_id: str, image_bytes: bytes) -> StandardAIOutputContract:
        """
        Processes image input bytes through pipeline stages and returns standardized result.
        """
        if not image_bytes or len(image_bytes) == 0:
            raise InvalidFileException("Image data is empty (0 bytes).")

        try:
            pil_image = Image.open(io.BytesIO(image_bytes))
            pil_image.verify()
        except Exception as exc:
            raise InvalidFileException("Image file is corrupted, truncated, or cannot be decoded.") from exc

        # Reopen after verify()
        try:
            pil_image = Image.open(io.BytesIO(image_bytes))
            if pil_image.mode != "RGB":
                pil_image = pil_image.convert("RGB")
            width, height = pil_image.size
        except Exception as exc:
            raise InvalidFileException("Could not read image dimensions.") from exc

        if width <= 0 or height <= 0:
            raise InvalidFileException("Image has invalid zero dimensions.")

        max_dim = settings.MAX_INFERENCE_IMAGE_DIMENSION
        if width > max_dim or height > max_dim:
            raise RecognitionException(
                f"Image dimensions ({width}x{height}) exceed maximum allowable inference dimension ({max_dim}px).",
                status_code=400,
            )

        # 1. Detect Vehicles
        try:
            detected_vehicles = self.vehicle_detector.detect(pil_image)
        except Exception as exc:
            if type(exc).__name__ == "ModelNotConfiguredException":
                raise
            raise RecognitionException(f"Vehicle detection failed: {exc}") from exc

        vehicle_boxes: list[VehicleBoundingBox] = []

        for v in detected_vehicles:
            raw_v_bbox = v.get("bbox", [0, 0, width, height])
            v_bbox = clamp_bbox(raw_v_bbox, width, height)
            v_type = str(v.get("type", "car"))
            v_conf = float(v.get("confidence", 0.0))

            # Crop vehicle region for plate detection
            v_xmin, v_ymin, v_xmax, v_ymax = v_bbox
            v_crop = (
                pil_image.crop((v_xmin, v_ymin, v_xmax, v_ymax))
                if (v_xmax > v_xmin and v_ymax > v_ymin)
                else pil_image
            )

            # 2. Detect Plate ROI inside vehicle crop
            plate_box: Optional[PlateBoundingBox] = None
            try:
                rel_plate_bbox = self.plate_detector.detect_plate(v_crop)
            except Exception as exc:
                if type(exc).__name__ == "ModelNotConfiguredException":
                    raise
                rel_plate_bbox = None

            if rel_plate_bbox and len(rel_plate_bbox) == 4:
                # Map relative vehicle crop coordinates to absolute image coordinates
                abs_p_xmin = v_xmin + rel_plate_bbox[0]
                abs_p_ymin = v_ymin + rel_plate_bbox[1]
                abs_p_xmax = v_xmin + rel_plate_bbox[2]
                abs_p_ymax = v_ymin + rel_plate_bbox[3]
                p_bbox = clamp_bbox([abs_p_xmin, abs_p_ymin, abs_p_xmax, abs_p_ymax], width, height)

                # Crop plate for OCR
                p_xmin, p_ymin, p_xmax, p_ymax = p_bbox
                plate_crop = (
                    pil_image.crop((p_xmin, p_ymin, p_xmax, p_ymax))
                    if (p_xmax > p_xmin and p_ymax > p_ymin)
                    else v_crop
                )

                # 3. OCR Text Extraction & Cleaning
                try:
                    raw_text, ocr_conf = self.ocr_engine.extract_text(plate_crop)
                    cleaned_text = self.cleaner.clean_plate_text(raw_text)
                except Exception:
                    cleaned_text = ""
                    ocr_conf = 0.0

                plate_box = PlateBoundingBox(
                    text=cleaned_text,
                    confidence=round(ocr_conf, 2),
                    bbox=p_bbox,
                )

            vehicle_boxes.append(
                VehicleBoundingBox(
                    type=v_type,
                    confidence=round(v_conf, 2),
                    bbox=v_bbox,
                    plate=plate_box,
                )
            )

        return StandardAIOutputContract(image_id=image_id, vehicles=vehicle_boxes)
