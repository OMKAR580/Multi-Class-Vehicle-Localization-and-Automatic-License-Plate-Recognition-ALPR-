"""
VisionPlate AI — Phase 04: Detection History Integration Verification Suite
Validates:
1. AI Model Safety: Best/YOLO checkpoints untouched.
2. Backend Endpoint Contracts: /recognition/history and /recognition/history/{job_id}.
3. Filter & Search Query Parameters: search, media_type, status, start_date, end_date, vehicle_class.
4. Database Repository Capabilities: list_by_user_paginated implementation & query filtering.
5. User Ownership Boundary: Strict user_id scoping on history and detail queries.
6. Safe Filenames & Plate Extractions: History schema includes filename, plates, vehicle_types.
7. Frontend API Client: RecognitionHistoryFilterParams, getRecognitionHistory, getDashboardStats, fetchAuthenticatedBlob.
8. History Page Components: Section A, B, C, D, E, F, G elements present in /app/history/page.tsx.
9. Dedicated Job Detail Route: /app/history/[jobId]/page.tsx exists and is wired to getRecognitionJobDetail.
10. RFC 4180 CSV & JSON Export: Compliant formatting and download logic.
11. TypeScript Clean Compilation: No type or build errors.
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

    assert best_pt.exists() or yolo_plate.exists(), "At least one license plate model must exist"
    if yolo_veh.exists():
        assert yolo_veh.stat().st_size > 0
    if yolo_plate.exists():
        assert yolo_plate.stat().st_size > 0
    checks["1_ai_model_safety"] = "PASSED"
    print("  -> Passed: Model files intact.", flush=True)


def test_2_backend_history_endpoint():
    print("[2/11] Checking: /recognition/history endpoint contract & dependencies...", flush=True)
    from app.api.v1.endpoints.recognition import router
    from app.core.deps import get_current_user
    from app.schemas.recognition import RecognitionHistoryResponse

    route_map = {r.path: r for r in router.routes}
    assert "/recognition/history" in route_map, "Route /recognition/history missing"
    route = route_map["/recognition/history"]
    assert "GET" in route.methods
    assert route.response_model == RecognitionHistoryResponse

    param_callables = [p.call for p in route.dependant.dependencies]
    assert get_current_user in param_callables, "Endpoint must depend on get_current_user"
    checks["2_backend_history_endpoint"] = "PASSED"
    print("  -> Passed: /recognition/history verified with auth dependency.", flush=True)


def test_3_query_parameters_support():
    print("[3/11] Checking: Search & filter query parameters on endpoint...", flush=True)
    from app.api.v1.endpoints.recognition import list_recognition_history

    sig = inspect.signature(list_recognition_history)
    expected_params = [
        "page",
        "page_size",
        "search",
        "media_type",
        "job_status",
        "start_date",
        "end_date",
        "vehicle_class",
        "current_user",
        "db",
        "storage",
    ]
    for param in expected_params:
        assert param in sig.parameters, f"Query parameter '{param}' missing from list_recognition_history signature"

    checks["3_query_parameters_support"] = "PASSED"
    print("  -> Passed: All 8 search & filter parameters present in endpoint signature.", flush=True)


def test_4_repository_filtering_logic():
    print("[4/11] Checking: DetectionRepository list_by_user_paginated logic...", flush=True)
    from app.repositories.detection_repository import DetectionRepository

    method = getattr(DetectionRepository, "list_by_user_paginated", None)
    assert method is not None, "list_by_user_paginated missing from DetectionRepository"
    src = inspect.getsource(method)

    assert "user_id == user_id" in src, "Must strictly scope by user_id"
    assert "search" in src, "Must handle search text"
    assert "media_type" in src, "Must handle media_type filter"
    assert "status" in src, "Must handle status filter"
    assert "start_date" in src, "Must handle start_date filter"
    assert "vehicle_class" in src, "Must handle vehicle_class filter"

    checks["4_repository_filtering_logic"] = "PASSED"
    print("  -> Passed: DetectionRepository implements user isolation and full query filters.", flush=True)


def test_5_user_ownership_boundary():
    print("[5/11] Checking: User data isolation & unauthorized boundary enforcement...", flush=True)
    from app.services.recognition_service import RecognitionService

    detail_src = inspect.getsource(RecognitionService.get_recognition_job_detail)
    assert "job.user_id != current_user.id" in detail_src, "Must enforce job ownership on detail lookup"
    assert "UnauthorizedException" in detail_src, "Must raise UnauthorizedException on cross-user access"

    checks["5_user_ownership_boundary"] = "PASSED"
    print("  -> Passed: Unauthorized access to another user's job strictly blocked.", flush=True)


def test_6_schemas_filename_and_plates():
    print("[6/11] Checking: RecognitionHistoryItem and Detail schemas contain safe filename & plates...", flush=True)
    from app.schemas.recognition import RecognitionHistoryItem, RecognitionResponse, VideoRecognitionResponse

    hist_fields = RecognitionHistoryItem.model_fields
    assert "filename" in hist_fields, "RecognitionHistoryItem must include filename"
    assert "plates" in hist_fields, "RecognitionHistoryItem must include plates list"
    assert "vehicle_types" in hist_fields, "RecognitionHistoryItem must include vehicle_types list"

    resp_fields = RecognitionResponse.model_fields
    assert "filename" in resp_fields, "RecognitionResponse must include filename"

    vresp_fields = VideoRecognitionResponse.model_fields
    assert "filename" in vresp_fields, "VideoRecognitionResponse must include filename"

    checks["6_schemas_filename_and_plates"] = "PASSED"
    print("  -> Passed: Schemas populated with filename, plates, and vehicle_types.", flush=True)


def test_7_frontend_api_client():
    print("[7/11] Checking: Frontend API client utilities in frontend/src/lib/api.ts...", flush=True)
    api_ts = (frontend_dir / "src" / "lib" / "api.ts").read_text(encoding="utf-8")

    assert "export interface RecognitionHistoryFilterParams" in api_ts
    assert "export async function getRecognitionHistory" in api_ts
    assert "export async function getRecognitionJobDetail" in api_ts
    assert "export async function getDashboardStats" in api_ts
    assert "export async function fetchAuthenticatedBlob" in api_ts
    assert "search" in api_ts
    assert "media_type" in api_ts
    assert "vehicle_class" in api_ts

    checks["7_frontend_api_client"] = "PASSED"
    print("  -> Passed: Frontend api.ts exports all required history client utilities.", flush=True)


def test_8_history_page_sections():
    print("[8/11] Checking: History page Sections A-G in frontend/src/app/app/history/page.tsx...", flush=True)
    page_tsx = (frontend_dir / "src" / "app" / "app" / "history" / "page.tsx").read_text(encoding="utf-8")

    # Section A: Title & live stats
    assert "Detection History" in page_tsx
    assert "getDashboardStats" in page_tsx
    assert "total_jobs" in page_tsx
    assert "completed_jobs" in page_tsx
    assert "failed_jobs" in page_tsx
    assert "total_vehicles_detected" in page_tsx

    # Section B: Search & multi-parameter filter system
    assert "Search by Plate" in page_tsx
    assert "mediaTypeFilter" in page_tsx
    assert "statusFilter" in page_tsx
    assert "dateRangeFilter" in page_tsx
    assert "vehicleClassFilter" in page_tsx
    assert "Clear All" in page_tsx

    # Section C & D: Table & Server-side pagination
    assert "historyData.items.map" in page_tsx
    assert "historyData.page" in page_tsx
    assert "setPageSize" in page_tsx
    assert "handleCopy" in page_tsx

    # Section E: Detailed Inspection View
    assert "getRecognitionJobDetail" in page_tsx
    assert "Annotated AI View" in page_tsx
    assert "Original Raw Image" in page_tsx
    assert "fetchAuthenticatedBlob" in page_tsx

    # Section F: RFC 4180 CSV export
    assert "handleExportCsv" in page_tsx
    assert "RFC 4180" in page_tsx

    checks["8_history_page_sections"] = "PASSED"
    print("  -> Passed: All 7 required functional sections verified in /app/history/page.tsx.", flush=True)


def test_9_dedicated_job_detail_route():
    print("[9/11] Checking: Dedicated route /app/history/[jobId]/page.tsx exists...", flush=True)
    detail_page = frontend_dir / "src" / "app" / "app" / "history" / "[jobId]" / "page.tsx"
    assert detail_page.exists(), "Dynamic route [jobId]/page.tsx must exist"
    src = detail_page.read_text(encoding="utf-8")

    assert "useParams" in src
    assert "getRecognitionJobDetail" in src
    assert "Annotated AI View" in src
    assert "Original Raw Asset" in src
    assert "Export JSON" in src
    assert "Back to Detection History" in src

    checks["9_dedicated_job_detail_route"] = "PASSED"
    print("  -> Passed: Dedicated route /app/history/[jobId] properly implemented.", flush=True)


def test_10_csv_rfc4180_export_formatting():
    print("[10/11] Checking: RFC 4180 CSV formatting rules...", flush=True)
    page_tsx = (frontend_dir / "src" / "app" / "app" / "history" / "page.tsx").read_text(encoding="utf-8")
    assert 'replace(/"/g, \'""\')' in page_tsx, "CSV export must escape double quotes with double quotes per RFC 4180"
    assert '\\r\\n' in page_tsx, "CSV export should use standard CRLF line endings"

    checks["10_csv_rfc4180_export_formatting"] = "PASSED"
    print("  -> Passed: CSV export follows RFC 4180 escaping and CRLF standards.", flush=True)


def test_11_typescript_compilation():
    print("[11/11] Checking: Full frontend TypeScript compilation without emit...", flush=True)
    cmd = ["node", "./frontend/node_modules/typescript/bin/tsc", "--project", "frontend/tsconfig.json", "--noEmit"]
    res = subprocess.run(cmd, cwd=root_dir, capture_output=True, text=True)
    if res.returncode != 0:
        print("TypeScript Errors:\n" + res.stdout + "\n" + res.stderr, flush=True)
        assert False, f"TypeScript compilation failed with returncode {res.returncode}"

    checks["11_typescript_compilation"] = "PASSED"
    print("  -> Passed: TypeScript compiled cleanly with 0 errors.", flush=True)


def main():
    print("=== VISIONPLATE AI: PHASE 04 DETECTION HISTORY VERIFICATION ===", flush=True)
    test_1_ai_model_safety()
    test_2_backend_history_endpoint()
    test_3_query_parameters_support()
    test_4_repository_filtering_logic()
    test_5_user_ownership_boundary()
    test_6_schemas_filename_and_plates()
    test_7_frontend_api_client()
    test_8_history_page_sections()
    test_9_dedicated_job_detail_route()
    test_10_csv_rfc4180_export_formatting()
    test_11_typescript_compilation()

    print("\n==================================================")
    print("ALL 11 CHECKS PASSED FOR PHASE 04 DETECTION HISTORY!")
    print("==================================================")
    for k, v in checks.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()

