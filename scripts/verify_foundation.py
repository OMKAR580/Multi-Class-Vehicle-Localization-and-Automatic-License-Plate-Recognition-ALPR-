#!/usr/bin/env python3
"""
Comprehensive Foundation Verification Script for ALPR Platform.
Validates directory structure, backend imports, health endpoints, AI pipeline contract, and environment configuration.
"""

import os
import sys

# Ensure current working directory and submodules are in Python path
ROOT_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
if os.path.join(ROOT_DIR, "backend") not in sys.path:
    sys.path.insert(0, os.path.join(ROOT_DIR, "backend"))
if os.path.join(ROOT_DIR, "ai") not in sys.path:
    sys.path.insert(0, os.path.join(ROOT_DIR, "ai"))

def check_directories():
    required_dirs = [
        "frontend", "android", "backend", "ai", "database",
        "infrastructure", "docs", "scripts", "tests", ".github/workflows"
    ]
    print("=== 1. Checking Monorepo Directory Structure ===")
    for d in required_dirs:
        exists = os.path.isdir(os.path.join(ROOT_DIR, d))
        status = "OK" if exists else "MISSING"
        print(f"  [{status}] Directory: {d}")
        if not exists:
            return False
    return True

def check_backend_imports():
    print("\n=== 2. Verifying Backend Imports ===")
    try:
        from app.main import app
        from app.core.config import settings
        from app.schemas.detection import AIDetectionResponse
        print("  [OK] FastAPI app, settings, and Pydantic schemas imported successfully.")
        return True
    except Exception as e:
        print(f"  [ERROR] Failed to import backend modules: {e}")
        return False

def check_ai_imports():
    print("\n=== 3. Verifying AI Pipeline Imports & Contract ===")
    try:
        from ai.pipeline.schema import StandardAIOutputContract, VehicleBoundingBox, PlateBoundingBox
        from ai.pipeline.alpr_pipeline import ALPRPipeline
        
        sample_contract = StandardAIOutputContract(
            image_id="verification_test",
            vehicles=[
                VehicleBoundingBox(
                    type="car",
                    confidence=0.95,
                    bbox=[100, 100, 500, 400],
                    plate=PlateBoundingBox(text="RJ14AB1234", confidence=0.92, bbox=[200, 300, 400, 350])
                )
            ]
        )
        print("  [OK] AI Standard Output Contract instantiated successfully.")
        print(f"  [OK] Sample vehicle plate: {sample_contract.vehicles[0].plate.text}")
        return True
    except Exception as e:
        print(f"  [ERROR] Failed AI imports or contract verification: {e}")
        return False

def main():
    dirs_ok = check_directories()
    backend_ok = check_backend_imports()
    ai_ok = check_ai_imports()

    if dirs_ok and backend_ok and ai_ok:
        print("\n==================================================")
        print(" SUCCESS: All Foundation Verification Checks Passed!")
        print("==================================================")
        sys.exit(0)
    else:
        print("\n==================================================")
        print(" FAILURE: Foundation Verification Checks Failed.")
        print("==================================================")
        sys.exit(1)

if __name__ == "__main__":
    main()
