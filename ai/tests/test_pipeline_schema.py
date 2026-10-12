import io
from PIL import Image
import pytest

from ai.pipeline.alpr_pipeline import ALPRPipeline
from ai.pipeline.schema import StandardAIOutputContract
from ai.pipeline.base import BaseVehicleDetector, BasePlateDetector, BasePlateOCR, BasePostProcessor


class FakeVehicleDetector(BaseVehicleDetector):
    def detect(self, image):
        return [{"type": "car", "confidence": 0.95, "bbox": [10, 10, 80, 80]}]


class FakePlateDetector(BasePlateDetector):
    def detect_plate(self, vehicle_crop):
        return [5, 5, 40, 20]


class FakeOCR(BasePlateOCR):
    def extract_text(self, plate_crop):
        return ("DL01AB1234", 0.92)


class FakeCleaner(BasePostProcessor):
    def clean_plate_text(self, raw_text):
        return raw_text


def test_standard_ai_output_contract():
    data = {
        "image_id": "test_img_001",
        "vehicles": [
            {
                "type": "car",
                "confidence": 0.95,
                "bbox": [100, 200, 300, 400],
                "plate": {
                    "text": "DL01AB1234",
                    "confidence": 0.92,
                    "bbox": [150, 250, 250, 300],
                },
            }
        ],
    }

    contract = StandardAIOutputContract(**data)
    assert contract.image_id == "test_img_001"
    assert len(contract.vehicles) == 1
    assert contract.vehicles[0].type == "car"
    assert contract.vehicles[0].plate.text == "DL01AB1234"


def test_alpr_pipeline_execution():
    pipeline = ALPRPipeline(
        vehicle_detector=FakeVehicleDetector(),
        plate_detector=FakePlateDetector(),
        ocr_engine=FakeOCR(),
        cleaner=FakeCleaner(),
    )

    # Create dummy 100x100 red image bytes
    img = Image.new("RGB", (100, 100), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    image_bytes = buf.getvalue()

    result = pipeline.process_image("test_sample", image_bytes=image_bytes)
    assert isinstance(result, StandardAIOutputContract)
    assert result.image_id == "test_sample"
    assert len(result.vehicles) == 1
    assert result.vehicles[0].type == "car"
    assert result.vehicles[0].plate.text == "DL01AB1234"
