import pytest
from ai.pipeline.schema import StandardAIOutputContract, VehicleBoundingBox, PlateBoundingBox
from ai.pipeline.alpr_pipeline import ALPRPipeline

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
                    "bbox": [150, 250, 250, 300]
                }
            }
        ]
    }
    
    contract = StandardAIOutputContract(**data)
    assert contract.image_id == "test_img_001"
    assert len(contract.vehicles) == 1
    assert contract.vehicles[0].type == "car"
    assert contract.vehicles[0].plate.text == "DL01AB1234"

def test_alpr_pipeline_execution():
    pipeline = ALPRPipeline()
    result = pipeline.process_image("test_sample")
    assert isinstance(result, StandardAIOutputContract)
    assert result.image_id == "test_sample"
