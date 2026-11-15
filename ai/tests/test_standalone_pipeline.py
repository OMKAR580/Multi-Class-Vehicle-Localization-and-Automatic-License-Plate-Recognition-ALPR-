"""Focused test suite for VisionPlate AI Standalone AI/ML Inference Pipeline."""

import io
import os
from pathlib import Path
import pytest
from PIL import Image
import numpy as np

from ai.detection.vehicle_detector import VehicleDetector
from ai.detection.plate_detector import PlateDetector
from ai.preprocessing.image_processor import ImagePreprocessor
from ai.ocr.indian_plate_ocr import IndianPlateOCR
from ai.postprocessing.text_cleaner import IndianPlateCleaner
from ai.pipeline.alpr_pipeline import ALPRPipeline, clamp_bbox
from ai.pipeline.schema import StandardAIOutputContract, VehicleBoundingBox, PlateBoundingBox
from ai.pipeline.base import BaseVehicleDetector, BasePlateDetector, BasePlateOCR, BaseVisualizer
from ai.visualization.annotator import PipelineVisualizer
from ai.exceptions import InvalidImageException, ModelNotConfiguredException


REAL_VAL_IMAGE = "vehicle_detector/uvh26_v2/raw_selected/val/693481.png"
REAL_PLATE_IMAGE = "vehicle_detector/uvh26_v2/raw_selected/val/109489.png"
VEHICLE_CHECKPOINT = "ai/models/best.pt"
PLATE_CHECKPOINT = "ai/models/yolov8_plate.pt"

try:
    import ultralytics  # noqa: F401
    HAS_ULTRALYTICS = True
except ImportError:
    HAS_ULTRALYTICS = False

pytestmark = pytest.mark.skipif(
    not HAS_ULTRALYTICS or not os.path.exists(VEHICLE_CHECKPOINT),
    reason="Ultralytics or local model weights not available in lightweight CI environment"
)


# ---------------------------------------------------------------------------
# Test 1: Checkpoint loading integrity and class mappings
# ---------------------------------------------------------------------------
def test_1_checkpoints_load_successfully():
    """Verify both vehicle (best.pt) and license plate (yolov8_plate.pt) checkpoints load."""
    assert os.path.exists(VEHICLE_CHECKPOINT), f"Missing vehicle checkpoint: {VEHICLE_CHECKPOINT}"
    assert os.path.exists(PLATE_CHECKPOINT), f"Missing plate checkpoint: {PLATE_CHECKPOINT}"

    v_detector = VehicleDetector(model_path=VEHICLE_CHECKPOINT)
    assert v_detector._model is not None, "Vehicle model failed to initialize."
    
    # Verify the 8 custom vehicle classes
    model_classes = set(v_detector._model.names.values())
    expected_8_classes = {"car", "truck", "bus", "motorbike", "three_wheeler", "lcv", "bicycle", "other"}
    assert expected_8_classes.issubset(model_classes), f"Model classes {model_classes} do not match expected 8 classes."

    p_detector = PlateDetector(model_path=PLATE_CHECKPOINT)
    assert p_detector._model is not None, "Plate model failed to initialize."
    assert "license_plate" in set(p_detector._model.names.values())


# ---------------------------------------------------------------------------
# Test 2: Vehicle inference on real image
# ---------------------------------------------------------------------------
def test_2_vehicle_inference_on_real_image():
    """Verify vehicle detector executes inference on a real traffic validation image."""
    if not os.path.exists(REAL_VAL_IMAGE):
        pytest.skip(f"Test image not available: {REAL_VAL_IMAGE}")

    v_detector = VehicleDetector(model_path=VEHICLE_CHECKPOINT, min_confidence=0.40)
    with Image.open(REAL_VAL_IMAGE) as img:
        detections = v_detector.detect(img)

    assert isinstance(detections, list)
    assert len(detections) > 0, "Expected at least one vehicle detected in validation traffic image."
    for d in detections:
        assert "type" in d
        assert "confidence" in d
        assert "bbox" in d
        assert len(d["bbox"]) == 4
        assert 0.0 <= d["confidence"] <= 1.0


# ---------------------------------------------------------------------------
# Test 3: Plate inference on real image
# ---------------------------------------------------------------------------
def test_3_plate_inference_on_real_image():
    """Verify plate detector executes inference on a real validation image."""
    target_img = REAL_PLATE_IMAGE if os.path.exists(REAL_PLATE_IMAGE) else REAL_VAL_IMAGE
    if not os.path.exists(target_img):
        pytest.skip("No real validation image available for plate testing.")

    p_detector = PlateDetector(model_path=PLATE_CHECKPOINT, min_confidence=0.25)
    with Image.open(target_img) as img:
        plates = p_detector.detect_plates(img)

    assert isinstance(plates, list)
    # Check that any plate returned has valid bounding box structure
    for p in plates:
        assert "bbox" in p
        assert len(p["bbox"]) == 4
        assert 0.0 <= p["confidence"] <= 1.0


# ---------------------------------------------------------------------------
# Test 4: Bounding boxes and class mappings validity
# ---------------------------------------------------------------------------
def test_4_bounding_boxes_and_class_mappings():
    """Verify coordinate bounding convention [xmin, ymin, xmax, ymax] and clamping logic."""
    # Test coordinate clamping
    raw_box = [-10, -5, 2000, 1200]
    clamped = clamp_bbox(raw_box, width=1920, height=1080)
    assert clamped == [0, 0, 1920, 1080]
    assert clamped[0] <= clamped[2]
    assert clamped[1] <= clamped[3]

    # Test allowed vehicle class filtering
    v_detector = VehicleDetector(model_path=VEHICLE_CHECKPOINT, allowed_classes=["car", "bus"])
    assert v_detector.allowed_classes == {"car", "bus"}


# ---------------------------------------------------------------------------
# Test 5: Plate cropping and image preprocessing
# ---------------------------------------------------------------------------
def test_5_plate_preprocessing_dimensions_and_enhancement():
    """Verify preprocessor converts input, enhances contrast, and enforces minimum dimensions."""
    preprocessor = ImagePreprocessor(target_min_height=64, target_min_width=128)

    # Test with small synthetic crop (30x60 RGB)
    small_crop = np.ones((30, 60, 3), dtype=np.uint8) * 180
    enhanced = preprocessor.prepare_for_ocr(small_crop)

    assert isinstance(enhanced, np.ndarray)
    assert enhanced.dtype == np.uint8
    assert enhanced.ndim == 2  # Grayscale
    assert enhanced.shape[0] >= 64, f"Height {enhanced.shape[0]} should be scaled >= 64"
    assert enhanced.shape[1] >= 128, f"Width {enhanced.shape[1]} should be scaled >= 128"


# ---------------------------------------------------------------------------
# Test 6: OCR execution on plate crop
# ---------------------------------------------------------------------------
def test_6_ocr_execution_on_plate_crop():
    """Verify OCR component returns (text, confidence) without throwing exceptions."""
    ocr = IndianPlateOCR()

    # Synthetic plate image with clear text
    import cv2
    plate_img = np.ones((60, 240, 3), dtype=np.uint8) * 255
    cv2.putText(plate_img, "DL01AB1234", (15, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)

    text, conf = ocr.extract_text(plate_img)
    assert isinstance(text, str)
    assert isinstance(conf, float)
    assert 0.0 <= conf <= 1.0
    if ocr.is_available:
        # Tesseract should read synthetic plate text
        cleaned = IndianPlateCleaner().clean_text(text)
        assert "DL" in cleaned or len(cleaned) > 0


# ---------------------------------------------------------------------------
# Test 7: Complete pipeline returns consistent structured result
# ---------------------------------------------------------------------------
def test_7_complete_pipeline_structured_result():
    """Verify full ALPRPipeline produces a complete StandardAIOutputContract."""
    pipeline = ALPRPipeline(generate_annotated_image=True)

    # Use real validation image or fallback to generated synthetic vehicle
    if os.path.exists(REAL_VAL_IMAGE):
        with open(REAL_VAL_IMAGE, "rb") as f:
            img_bytes = f.read()
    else:
        dummy = Image.new("RGB", (640, 480), color=(100, 100, 100))
        buf = io.BytesIO()
        dummy.save(buf, format="JPEG")
        img_bytes = buf.getvalue()

    result = pipeline.process_image(image_id="test_run_001", image_bytes=img_bytes)

    assert isinstance(result, StandardAIOutputContract)
    assert result.image_id == "test_run_001"
    assert result.status in ("success", "partial")
    assert result.execution_time_ms is not None
    assert result.execution_time_ms > 0
    assert "vehicle_detection_ms" in result.stage_timings
    assert "plate_detection_ms" in result.stage_timings
    assert "ocr_extraction_ms" in result.stage_timings
    assert "visualization_ms" in result.stage_timings

    assert result.annotated_image is not None
    assert isinstance(result.annotated_image, str)
    assert len(result.annotated_image) > 50  # Base64 string


# ---------------------------------------------------------------------------
# Test 8: Empty scene handling
# ---------------------------------------------------------------------------
def test_8_empty_scene_handling():
    """Verify pipeline handles image with no vehicles/plates gracefully without errors."""
    pipeline = ALPRPipeline(generate_annotated_image=False)

    # Solid neutral color image has zero vehicles
    blank = Image.new("RGB", (300, 300), color=(50, 50, 50))
    buf = io.BytesIO()
    blank.save(buf, format="PNG")
    img_bytes = buf.getvalue()

    result = pipeline.process_image(image_id="blank_scene", image_bytes=img_bytes)
    assert isinstance(result, StandardAIOutputContract)
    assert len(result.vehicles) == 0
    assert len(result.unassociated_plates) == 0
    assert result.status == "success"


# ---------------------------------------------------------------------------
# Test 9: Invalid inputs and missing model error handling
# ---------------------------------------------------------------------------
def test_9_invalid_inputs_and_missing_models():
    """Verify informative exceptions are raised on corrupt inputs or missing models."""
    pipeline = ALPRPipeline(generate_annotated_image=False)

    # Empty bytes (0 bytes)
    with pytest.raises((InvalidImageException, Exception)):
        pipeline.process_image("empty", image_bytes=b"")

    # Corrupt garbage bytes
    with pytest.raises((InvalidImageException, Exception)):
        pipeline.process_image("corrupt", image_bytes=b"NotAnImageHeaderData")

    # Missing model path
    with pytest.raises(ModelNotConfiguredException):
        v = VehicleDetector(model_path="non_existent/path/weights.pt")
        dummy = Image.new("RGB", (50, 50))
        v.detect(dummy)

    with pytest.raises(ModelNotConfiguredException):
        p = PlateDetector(model_path="non_existent/path/plate_weights.pt")
        dummy = Image.new("RGB", (50, 50))
        p.detect_plate(dummy)


# ---------------------------------------------------------------------------
# Test 10: Repeated inference reuses model without reloading
# ---------------------------------------------------------------------------
def test_10_repeated_inference_reuses_model():
    """Verify that multiple process_image calls reuse the exact same loaded model instance."""
    pipeline = ALPRPipeline(generate_annotated_image=False)
    v_model_instance = pipeline.vehicle_detector._model
    p_model_instance = pipeline.plate_detector._model

    dummy = Image.new("RGB", (100, 100), color="blue")
    buf = io.BytesIO()
    dummy.save(buf, format="JPEG")
    img_bytes = buf.getvalue()

    # Run inference twice
    pipeline.process_image("reuse_1", image_bytes=img_bytes)
    pipeline.process_image("reuse_2", image_bytes=img_bytes)

    # Model instances should remain identical in memory (no reloading)
    assert pipeline.vehicle_detector._model is v_model_instance
    assert pipeline.plate_detector._model is p_model_instance


# ---------------------------------------------------------------------------
# Test 11: Text cleaner and state code validation
# ---------------------------------------------------------------------------
def test_11_text_cleaner_and_state_code():
    """Verify Indian plate cleaning, state code recognition, and standard plate formatting."""
    cleaner = IndianPlateCleaner()

    # Valid Indian formats
    assert cleaner.clean_text("RJ-14 AB 1234") == "RJ14AB1234"
    assert cleaner.clean_text("dl 01 ab 9999") == "DL01AB9999"
    assert cleaner.clean_text("!@#MH 12 CD 5678$%^") == "MH12CD5678"

    assert cleaner.validate_state_code("MH12AB1234") is True
    assert cleaner.validate_state_code("RJ14AB1234") is True
    assert cleaner.validate_state_code("ZZ99AB1234") is False

    assert cleaner.is_valid_format("MH12AB1234") is True
    assert cleaner.is_valid_format("22BH1234AA") is True
    assert cleaner.is_valid_format("INVALIDTEXT123") is False

    assert cleaner.format_plate("MH12AB1234") == "MH 12 AB 1234"


# ---------------------------------------------------------------------------
# Test 12: Empty OCR text honest representation
# ---------------------------------------------------------------------------
def test_12_empty_ocr_text_honest_representation():
    """Verify that when OCR extracts no text or unreadable noise, it is represented honestly."""
    class MockVehicleDetector(BaseVehicleDetector):
        def detect(self, image):
            return [{"type": "car", "confidence": 0.91, "bbox": [50, 50, 200, 200]}]

    class MockPlateDetector(BasePlateDetector):
        def detect_plate(self, vehicle_crop):
            return [10, 10, 60, 30]

        def detect_plate_with_conf(self, vehicle_crop):
            return ([10, 10, 60, 30], 0.85)

    class MockBlankOCR(BasePlateOCR):
        def extract_text(self, plate_crop):
            return ("", 0.0)

    pipeline = ALPRPipeline(
        vehicle_detector=MockVehicleDetector(),
        plate_detector=MockPlateDetector(),
        ocr_engine=MockBlankOCR(),
        generate_annotated_image=False,
    )

    img = Image.new("RGB", (300, 300), color=(128, 128, 128))
    result = pipeline.process_image("empty_ocr_test", image=img)

    assert result.status == "success"
    assert len(result.vehicles) == 1
    v = result.vehicles[0]
    assert v.plate is not None
    assert v.plate.text == ""
    assert v.plate.raw_text is None
    assert v.plate.confidence == 0.0
    assert v.plate.ocr_confidence is None
    assert v.plate.detection_confidence == 0.85
    assert v.plate.bbox == [60, 60, 110, 80]

    # Serialization check: no invented text in JSON dump
    dump = result.model_dump()
    assert dump["vehicles"][0]["plate"]["text"] == ""
    assert dump["vehicles"][0]["plate"]["raw_text"] is None


# ---------------------------------------------------------------------------
# Test 13: OCR preprocessing diagnostics
# ---------------------------------------------------------------------------
def test_13_ocr_preprocessing_diagnostics():
    """Verify image preprocessor steps: scaling, grayscale, CLAHE, and binarization."""
    preprocessor = ImagePreprocessor(target_min_height=64, target_min_width=128)

    # 1. Test RGBA and RGB array conversion
    rgba_crop = np.zeros((20, 40, 4), dtype=np.uint8)
    enhanced_rgba = preprocessor.prepare_for_ocr(rgba_crop)
    assert enhanced_rgba.ndim == 2
    assert enhanced_rgba.shape[0] >= 64
    assert enhanced_rgba.shape[1] >= 128

    # 2. Test Otsu binarization option
    rgb_crop = np.random.randint(50, 200, (30, 50, 3), dtype=np.uint8)
    binarized = preprocessor.prepare_for_ocr(rgb_crop, binarize=True)
    unique_vals = set(np.unique(binarized))
    assert unique_vals.issubset({0, 255}), f"Binarized image should only contain 0 and 255: {unique_vals}"

    # 3. Test that legible synthetic characters preserve character distinction
    import cv2
    legible_plate = np.ones((50, 200, 3), dtype=np.uint8) * 255
    cv2.putText(legible_plate, "KA03AB1234", (10, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    processed = preprocessor.prepare_for_ocr(legible_plate)
    assert processed.shape[0] >= 64
    assert processed.shape[1] >= 128
    # Black text on white background should have contrast
    assert np.min(processed) < 50
    assert np.max(processed) > 200


# ---------------------------------------------------------------------------
# Test 14: Visualization serialization enabled and disabled
# ---------------------------------------------------------------------------
def test_14_visualization_serialization_enabled_and_disabled():
    """Verify Base64 JPEG generation when enabled, and strict None/null when disabled."""
    # A. Enabled
    pipeline_enabled = ALPRPipeline(generate_annotated_image=True)
    dummy = Image.new("RGB", (200, 200), color=(100, 100, 100))
    res_enabled = pipeline_enabled.process_image("vis_enabled", image=dummy)
    assert res_enabled.annotated_image is not None
    assert isinstance(res_enabled.annotated_image, str)
    assert len(res_enabled.annotated_image) > 50
    assert res_enabled.annotated_image.startswith("/9j/")  # Standard JPEG Base64 magic bytes
    assert res_enabled.stage_timings.get("visualization_ms", 0.0) >= 0.0
    dump_enabled = res_enabled.model_dump()
    assert dump_enabled["annotated_image"] is not None

    # B. Disabled
    pipeline_disabled = ALPRPipeline(generate_annotated_image=False)
    res_disabled = pipeline_disabled.process_image("vis_disabled", image=dummy)
    assert res_disabled.annotated_image is None
    dump_disabled = res_disabled.model_dump()
    assert dump_disabled["annotated_image"] is None
    json_disabled = res_disabled.model_dump_json()
    assert '"annotated_image":null' in json_disabled.replace(" ", "")

    # C. Custom visualizer without to_base64 method (fallback encoding)
    class CustomArrayVisualizer(BaseVisualizer):
        def annotate(self, image, contract):
            return np.zeros((100, 100, 3), dtype=np.uint8)

    pipeline_custom = ALPRPipeline(visualizer=CustomArrayVisualizer(), generate_annotated_image=True)
    res_custom = pipeline_custom.process_image("custom_vis", image=dummy)
    assert res_custom.annotated_image is not None
    assert len(res_custom.annotated_image) > 20


# ---------------------------------------------------------------------------
# Test 15: Coordinate mapping and boundary edge clamping
# ---------------------------------------------------------------------------
def test_15_coordinate_mapping_and_edge_clamping():
    """Verify coordinate mapping across multiple vehicles and bounding box clamping at boundaries."""
    class MockMultiVehicle(BaseVehicleDetector):
        def detect(self, image):
            return [
                # Negative coordinates exceeding left/top
                {"type": "car", "confidence": 0.88, "bbox": [-30, -20, 120, 140]},
                # Bbox exceeding image width/height (image is 300x200)
                {"type": "truck", "confidence": 0.92, "bbox": [150, 100, 450, 350]},
            ]

    class MockMultiPlate(BasePlateDetector):
        def detect_plate(self, vehicle_crop):
            b, _ = self.detect_plate_with_conf(vehicle_crop)
            return b

        def detect_plate_with_conf(self, vehicle_crop):
            # Plate relative to crop
            return ([10, 15, 60, 45], 0.79)

    pipeline = ALPRPipeline(
        vehicle_detector=MockMultiVehicle(),
        plate_detector=MockMultiPlate(),
        generate_annotated_image=False,
    )

    img = Image.new("RGB", (300, 200), color="blue")
    result = pipeline.process_image("coords_test", image=img)

    assert len(result.vehicles) == 2
    # Vehicle 0 was [-30, -20, 120, 140] -> clamped to [0, 0, 120, 140]
    v0 = result.vehicles[0]
    assert v0.bbox == [0, 0, 120, 140]
    # Plate rel [10, 15, 60, 45] -> abs [0+10, 0+15, 0+60, 0+45] = [10, 15, 60, 45]
    assert v0.plate.bbox == [10, 15, 60, 45]

    # Vehicle 1 was [150, 100, 450, 350] -> clamped to [150, 100, 300, 200]
    v1 = result.vehicles[1]
    assert v1.bbox == [150, 100, 300, 200]
    # Plate rel [10, 15, 60, 45] -> abs [150+10, 100+15, 150+60, 100+45] = [160, 115, 210, 145]
    assert v1.plate.bbox == [160, 115, 210, 145]


# ---------------------------------------------------------------------------
# Test 16: Spatial containment and unassociated plates
# ---------------------------------------------------------------------------
def test_16_spatial_containment_and_unassociated_plates():
    """Verify that plates without associated vehicles are preserved under unassociated_plates."""
    class EmptyVehicleDetector(BaseVehicleDetector):
        def detect(self, image):
            return []

    class GlobalPlateDetector(BasePlateDetector):
        def detect_plate(self, vehicle_crop):
            return None

        def detect_plates(self, image):
            return [{"bbox": [40, 50, 160, 90], "confidence": 0.81}]

    class MockPlateOCR(BasePlateOCR):
        def extract_text(self, plate_crop):
            return ("DL02CD5678", 0.89)

    pipeline = ALPRPipeline(
        vehicle_detector=EmptyVehicleDetector(),
        plate_detector=GlobalPlateDetector(),
        ocr_engine=MockPlateOCR(),
        generate_annotated_image=False,
    )

    img = Image.new("RGB", (300, 200), color="white")
    result = pipeline.process_image("unassociated_test", image=img)

    assert result.status == "success"
    assert len(result.vehicles) == 0
    assert len(result.unassociated_plates) == 1
    un_plate = result.unassociated_plates[0]
    assert un_plate.bbox == [40, 50, 160, 90]
    assert un_plate.detection_confidence == 0.81
    assert un_plate.text == "DL02CD5678"
    assert un_plate.confidence == 0.89

