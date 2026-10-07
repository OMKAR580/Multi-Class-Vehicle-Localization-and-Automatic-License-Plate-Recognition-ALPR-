import pytest
import sys
import os

sys.path.insert(0, os.path.abspath("ai"))

from pipeline.schema import StandardAIOutputContract, VehicleBoundingBox, PlateBoundingBox

def test_contract_compatibility():
    payload = {
        "image_id": "test_001",
        "vehicles": [
            {
                "type": "car",
                "confidence": 0.94,
                "bbox": [120, 80, 540, 420],
                "plate": {
                    "text": "RJ14AB1234",
                    "confidence": 0.91,
                    "bbox": [230, 350, 410, 395]
                }
            }
        ]
    }

    contract = StandardAIOutputContract(**payload)
    assert contract.vehicles[0].plate.text == "RJ14AB1234"
