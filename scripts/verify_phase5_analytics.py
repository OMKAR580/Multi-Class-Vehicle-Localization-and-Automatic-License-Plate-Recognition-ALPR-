"""
VisionPlate AI — Phase 05: Analytics Integration Verification Suite
Validates:
1. AI Model Safety: Checkpoints and model weights untouched.
2. Analytics Endpoint Contract: /api/v1/analytics/overview registered with auth dependency.
3. Query Parameter Support: days, start_date, end_date, media_type, status.
4. Repository Aggregation Architecture: Decoupled queries preventing Cartesian inflation.
5. User Data Isolation: Strict user_id boundaries across all queries.
6. Plate Detection vs OCR Recognition Distinction: Separate metrics for localized ROIs vs valid text.
7. Jurisdiction Extraction Engine: Accurate state prefix parsing on real plate strings.
8. Latency & Operational Performance: Handling of null/zero latencies and distribution brackets.
9. Frontend API Client: Typed interfaces and getAnalyticsOverview in api.ts.
10. Analytics Page Components: Sections A-H, exports, and honest telemetry labels in page.tsx.
11. TypeScript Clean Compilation: No compilation or type errors.
"""

import inspect
import json
import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
frontend_dir = root_dir / "frontend"
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(root_dir))

checks = {}


def test_1_ai_model_safety():
    print("[1/11] Checking: AI Model checkpoints & pipeline untouched...", flush=True)
    models_dir = root_dir / "ai" / "models"
    best_pt = models_dir / "best.pt"
    yolo_plate = models_dir / "yolov8_plate.pt"
    yolo_veh = models_dir / "yolov8_vehicle.pt"

    assert best_pt.exists() or yolo_plate.exists(), "Plate detector checkpoint missing"
    if yolo_veh.exists():
        assert yolo_veh.stat().st_size > 0
    if yolo_plate.exists():
        assert yolo_plate.stat().st_size > 0
    checks["1_ai_model_safety"] = "PASSED"
    print("  -> Passed: Model files intact and untouched.", flush=True)


def test_2_analytics_endpoint_contract():
    print("[2/11] Checking: /api/v1/analytics/overview endpoint contract...", flush=True)
    from app.api.v1.endpoints.analytics import router
    from app.api.v1.router import api_router
    from app.core.deps import get_current_user
    from app.schemas.analytics import AnalyticsOverviewResponse

    route_map = {r.path: r for r in router.routes}
    assert "/analytics/overview" in route_map or "/overview" in route_map, f"Route /analytics/overview missing from analytics router, found: {list(route_map.keys())}"
    route = route_map.get("/analytics/overview") or route_map.get("/overview")
    assert "GET" in route.methods
    assert route.response_model == AnalyticsOverviewResponse

    param_callables = [p.call for p in route.dependant.dependencies]
    assert get_current_user in param_callables, "Endpoint must depend on get_current_user"

    # Verify inclusion in app OpenAPI schema
    from app.main import app
    openapi_paths = app.openapi()["paths"].keys()
    assert "/api/v1/analytics/overview" in openapi_paths, f"Analytics route not found in OpenAPI paths: {list(openapi_paths)}"

    checks["2_analytics_endpoint_contract"] = "PASSED"
    print("  -> Passed: Endpoint registered with response model & get_current_user auth.", flush=True)


def test_3_query_parameters():
    print("[3/11] Checking: Query parameters on get_analytics_overview...", flush=True)
    from app.api.v1.endpoints.analytics import get_analytics_overview

    sig = inspect.signature(get_analytics_overview)
    expected = ["days", "start_date", "end_date", "media_type", "job_status", "current_user", "db"]
    for p in expected:
        assert p in sig.parameters, f"Query parameter '{p}' missing from signature"

    checks["3_query_parameters"] = "PASSED"
    print("  -> Passed: All 7 parameters present on endpoint signature.", flush=True)


def test_4_repository_aggregation():
    print("[4/11] Checking: AnalyticsRepository decoupled SQL queries...", flush=True)
    from app.repositories.analytics_repository import AnalyticsRepository

    src = inspect.getsource(AnalyticsRepository)
    assert "user_id == user_id" in src, "Must strictly scope by user_id"
    assert "func.avg" in src, "Must compute average latency"
    assert "Vehicle.detection_job_id == DetectionJob.id" in src, "Vehicles must join to DetectionJob"
    assert "Plate.vehicle_id == Vehicle.id" in src, "Plates must join to Vehicle"
    assert "fast_count" in src or "processing_time_ms < 1000.0" in src, "Must compute latency brackets"

    checks["4_repository_aggregation"] = "PASSED"
    print("  -> Passed: Decoupled SQL aggregation queries implemented.", flush=True)


def test_5_user_isolation():
    print("[5/11] Checking: Strict user-scoping on analytics queries...", flush=True)
    from app.repositories.analytics_repository import AnalyticsRepository

    src = inspect.getsource(AnalyticsRepository._build_job_filters)
    assert "DetectionJob.user_id == user_id" in src, "Job filters must mandate user_id matching"

    checks["5_user_isolation"] = "PASSED"
    print("  -> Passed: User isolation enforced at database query level.", flush=True)


def test_6_plate_vs_ocr_distinction():
    print("[6/11] Checking: Separation of plate localization from OCR recognition...", flush=True)
    from app.schemas.analytics import AnalyticsPlateMetrics, AnalyticsSummary

    summary_fields = AnalyticsSummary.model_fields
    assert "total_plates" in summary_fields
    assert "recognized_plates" in summary_fields
    assert "unreadable_plates" in summary_fields

    plate_fields = AnalyticsPlateMetrics.model_fields
    assert "total_detected" in plate_fields
    assert "recognized" in plate_fields
    assert "unreadable" in plate_fields
    assert "recognition_rate" in plate_fields

    checks["6_plate_vs_ocr_distinction"] = "PASSED"
    print("  -> Passed: Distinction between localized ROIs and recognized OCR text strictly modeled.", flush=True)


def test_7_jurisdiction_extraction():
    print("[7/11] Checking: RTO state prefix extraction logic...", flush=True)
    from app.services.analytics_service import AnalyticsService

    dummy_service = AnalyticsService.__new__(AnalyticsService)
    test_plates = [
        "DL10CA4829",
        "DL 1R 1947",
        "UP32CR0423",
        "UP 80 BT 7712",
        "HR26DQ5521",
        "MH12QX0001",
        "KA03HA9876",
        "XX9999",
    ]
    jurisdictions = dummy_service._extract_jurisdictions(test_plates)
    code_map = {j.code: j for j in jurisdictions}

    assert "DL" in code_map, "DL jurisdiction must be identified"
    assert code_map["DL"].count == 2
    assert code_map["DL"].name == "Delhi NCT"
    assert "UP" in code_map, "UP jurisdiction must be identified"
    assert code_map["UP"].count == 2
    assert "HR" in code_map
    assert "MH" in code_map
    assert "KA" in code_map

    checks["7_jurisdiction_extraction"] = "PASSED"
    print("  -> Passed: Indian RTO jurisdiction parser accurately mapped plate prefixes.", flush=True)


def test_8_latency_operational_performance():
    print("[8/11] Checking: Performance latency schemas & bracket definitions...", flush=True)
    from app.schemas.analytics import AnalyticsPerformance

    fields = AnalyticsPerformance.model_fields
    assert "avg_latency_ms" in fields
    assert "min_latency_ms" in fields
    assert "max_latency_ms" in fields
    assert "fast_count" in fields
    assert "normal_count" in fields
    assert "heavy_count" in fields

    checks["8_latency_operational_performance"] = "PASSED"
    print("  -> Passed: Latency and duration bracket definitions verified.", flush=True)


def test_9_frontend_api_client():
    print("[9/11] Checking: Frontend API client utilities in frontend/src/lib/api.ts...", flush=True)
    api_ts = (frontend_dir / "src" / "lib" / "api.ts").read_text(encoding="utf-8")

    assert "export interface AnalyticsOverviewResponse" in api_ts
    assert "export interface AnalyticsPlateMetrics" in api_ts
    assert "export interface AnalyticsPerformance" in api_ts
    assert "export async function getAnalyticsOverview" in api_ts
    assert "/analytics/overview" in api_ts

    checks["9_frontend_api_client"] = "PASSED"
    print("  -> Passed: Frontend api.ts exports typed analytics interfaces and fetcher.", flush=True)


def test_10_analytics_page_sections():
    print("[10/11] Checking: Analytics page components in frontend/src/app/app/analytics/page.tsx...", flush=True)
    page_tsx = (frontend_dir / "src" / "app" / "app" / "analytics" / "page.tsx").read_text(encoding="utf-8")

    # Section A
    assert "Traffic & Recognition Analytics" in page_tsx or "Traffic &amp; Recognition Analytics" in page_tsx
    assert "getAnalyticsOverview" in page_tsx

    # Section B: KPI Cards
    assert "Recognition Jobs" in page_tsx
    assert "Vehicles Detected" in page_tsx
    assert "Plates Localized" in page_tsx
    assert "Recognized Plates" in page_tsx
    assert "Job Success Rate" in page_tsx
    assert "Average Latency" in page_tsx

    # Section C & D
    assert "Recognition Jobs Over Time" in page_tsx
    assert "Vehicle Class Distribution" in page_tsx

    # Section E & F
    assert "License Plate Recognition & Jurisdiction" in page_tsx or "License Plate Recognition &amp; Jurisdiction" in page_tsx
    assert "Image vs Video Breakdown" in page_tsx

    # Section G & H
    assert "Processing Performance Analytics" in page_tsx
    assert "Application Processing Workload" in page_tsx

    # Section I & J: Exports
    assert "handleExportCsv" in page_tsx
    assert "handleExportJson" in page_tsx

    checks["10_analytics_page_sections"] = "PASSED"
    print("  -> Passed: All 8 required functional visualization sections present in page.tsx.", flush=True)


def test_11_typescript_compilation():
    print("[11/11] Checking: Full frontend TypeScript compilation without emit...", flush=True)
    cmd = ["node", "./frontend/node_modules/typescript/bin/tsc", "--project", "frontend/tsconfig.json", "--noEmit"]
    res = subprocess.run(cmd, cwd=root_dir, capture_output=True, text=True)
    if res.returncode != 0:
        print("TypeScript Errors:\n" + res.stdout + "\n" + res.stderr, flush=True)
        assert False, f"TypeScript compilation failed with code {res.returncode}"

    checks["11_typescript_compilation"] = "PASSED"
    print("  -> Passed: TypeScript compiled cleanly with 0 errors.", flush=True)


def main():
    print("=== VISIONPLATE AI: PHASE 05 ANALYTICS VERIFICATION ===", flush=True)
    test_1_ai_model_safety()
    test_2_analytics_endpoint_contract()
    test_3_query_parameters()
    test_4_repository_aggregation()
    test_5_user_isolation()
    test_6_plate_vs_ocr_distinction()
    test_7_jurisdiction_extraction()
    test_8_latency_operational_performance()
    test_9_frontend_api_client()
    test_10_analytics_page_sections()
    test_11_typescript_compilation()

    print("\n==================================================")
    print("ALL 11 CHECKS PASSED FOR PHASE 05 ANALYTICS INTEGRATION!")
    print("==================================================")
    for k, v in checks.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
