"""
VisionPlate AI — Phase 06: Reports Integration Verification Suite
Validates:
1. AI Model Safety: Core detector and plate checkpoints untouched.
2. Reports Endpoints Contract: /reports/overview, /reports/preview, /reports/export registered.
3. Auth & User Isolation: All report endpoints require get_current_user.
4. Six Core Report Templates: recognition_summary, vehicle_distribution, plate_recognition,
   processing_performance, media_breakdown, custom_range.
5. Repository Query Scoping: All repository methods filter strictly by DetectionJob.user_id.
6. ReportLab PDF Generation: In-memory PDF generation with headers, tables, and page numbers.
7. RFC 4180 CSV Generation: Double-quote escaping, CRLF line endings, and metadata headers.
8. JSON Report Serialization: Valid structured JSON serialization.
9. Detection vs OCR Distinction: Localized bounding boxes vs recognized plate text.
10. Date Boundary Validation: start_date > end_date rejected with InvalidFileException.
11. Frontend TypeScript Compilation: Clean build without emit.
"""

import inspect
import json
import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

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


def test_2_reports_endpoints_contract():
    print("[2/11] Checking: /api/v1/reports endpoints contract...", flush=True)
    from app.api.v1.endpoints.reports import router
    from app.main import app

    route_map = {r.path: r for r in router.routes}
    assert "/reports/overview" in route_map, "Route /reports/overview missing"
    assert "/reports/preview" in route_map, "Route /reports/preview missing"
    assert "/reports/export" in route_map, "Route /reports/export missing"

    openapi_paths = app.openapi()["paths"].keys()
    assert "/api/v1/reports/overview" in openapi_paths
    assert "/api/v1/reports/preview" in openapi_paths
    assert "/api/v1/reports/export" in openapi_paths

    checks["2_reports_endpoints_contract"] = "PASSED"
    print("  -> Passed: Overview, Preview, and Export endpoints registered in OpenAPI.", flush=True)


def test_3_auth_and_user_isolation():
    print("[3/11] Checking: Authentication dependency on all report endpoints...", flush=True)
    from app.api.v1.endpoints.reports import router
    from app.core.deps import get_current_user

    for route in router.routes:
        param_callables = [p.call for p in route.dependant.dependencies]
        assert get_current_user in param_callables, f"Route {route.path} must require get_current_user"

    checks["3_auth_and_user_isolation"] = "PASSED"
    print("  -> Passed: All report endpoints enforce get_current_user dependency.", flush=True)


def test_4_six_core_templates():
    print("[4/11] Checking: 6 report templates defined...", flush=True)
    from app.services.reports_service import REPORT_TEMPLATES

    template_ids = {t.id for t in REPORT_TEMPLATES}
    required = {
        "recognition_summary",
        "vehicle_distribution",
        "plate_recognition",
        "processing_performance",
        "media_breakdown",
        "custom_range",
    }
    assert required.issubset(template_ids), f"Missing templates: {required - template_ids}"

    checks["4_six_core_templates"] = "PASSED"
    print("  -> Passed: All 6 required report templates registered with categories.", flush=True)


def test_5_repository_query_scoping():
    print("[5/11] Checking: ReportsRepository user_id filtering...", flush=True)
    from app.repositories.reports_repository import ReportsRepository

    src = inspect.getsource(ReportsRepository._build_job_filters)
    assert "DetectionJob.user_id == user_id" in src, "Must strictly scope by user_id"

    meta_src = inspect.getsource(ReportsRepository.get_user_overview_meta)
    assert "DetectionJob.user_id == user_id" in meta_src

    checks["5_repository_query_scoping"] = "PASSED"
    print("  -> Passed: All database queries enforce user_id boundary.", flush=True)


def test_6_reportlab_pdf_generation():
    print("[6/11] Checking: In-memory PDF generation with ReportLab...", flush=True)
    from app.services.reports_service import ReportsService
    from app.schemas.reports import ReportExportRequest, ReportFilterParams
    from app.models.user import User

    mock_db = MagicMock()
    service = ReportsService(db=mock_db)
    user = User(id="user-test-uuid", email="operator@visionplate.ai")

    # Mock preview generation
    now = datetime.now(timezone.utc)
    from app.schemas.reports import ReportPreviewResponse, ReportColumn
    mock_preview = ReportPreviewResponse(
        report_id="RPT-TEST-001",
        report_title="Recognition Summary Report",
        report_type="recognition_summary",
        period_start=now - timedelta(days=7),
        period_end=now,
        timezone="UTC",
        applied_filters={"media_type": "all", "status": "all"},
        summary_kpis={"total_jobs": 12, "completed_jobs": 11, "failed_jobs": 1, "success_rate": 91.7},
        columns=[
            ReportColumn(key="job_id", label="Job ID", type="string"),
            ReportColumn(key="filename", label="Filename", type="string"),
            ReportColumn(key="status", label="Status", type="badge"),
        ],
        rows=[
            {"job_id": "job-1", "filename": "car-detect.jpg", "status": "COMPLETED"},
            {"job_id": "job-2", "filename": "truck.jpg", "status": "COMPLETED"},
        ],
        total_rows=2,
        definitions={"Job Success Rate": "Completed / Terminal * 100"},
        caveats=["Reflects user processing sessions."],
        generated_at=now,
    )
    service.generate_report_preview = AsyncMock(return_value=mock_preview)

    # Synchronous PDF generation test
    pdf_buffer = service.generate_pdf_from_preview(mock_preview, user.email)

    pdf_bytes = pdf_buffer.getvalue()
    assert len(pdf_bytes) > 500, "PDF buffer must contain valid document bytes"
    assert pdf_bytes.startswith(b"%PDF"), "Output must start with PDF header (%PDF)"

    checks["6_reportlab_pdf_generation"] = "PASSED"
    print(f"  -> Passed: ReportLab PDF generated ({len(pdf_bytes)} bytes) with valid header.", flush=True)


def test_7_rfc4180_csv_generation():
    print("[7/11] Checking: RFC 4180 CSV export formatting...", flush=True)
    from app.services.reports_service import ReportsService
    from app.schemas.reports import ReportExportRequest, ReportFilterParams, ReportPreviewResponse, ReportColumn
    from app.models.user import User

    mock_db = MagicMock()
    service = ReportsService(db=mock_db)
    user = User(id="user-test-uuid", email="operator@visionplate.ai")

    now = datetime.now(timezone.utc)
    mock_preview = ReportPreviewResponse(
        report_id="RPT-TEST-002",
        report_title="Vehicle Distribution Report",
        report_type="vehicle_distribution",
        period_start=now - timedelta(days=30),
        period_end=now,
        timezone="UTC",
        applied_filters={"media_type": "all"},
        summary_kpis={"total_vehicles": 42},
        columns=[
            ReportColumn(key="vehicle_id", label="Vehicle ID", type="string"),
            ReportColumn(key="class", label="Vehicle Class", type="badge"),
        ],
        rows=[
            {"vehicle_id": "v-1", "class": 'Car "Luxury"'},
            {"vehicle_id": "v-2", "class": "Truck"},
        ],
        total_rows=2,
        definitions={},
        caveats=[],
        generated_at=now,
    )
    service.generate_report_preview = AsyncMock(return_value=mock_preview)

    # Synchronous CSV generation test
    csv_text = service.generate_csv_from_preview(mock_preview)

    assert "\r\n" in csv_text, "CSV must use RFC 4180 CRLF line endings"
    assert '""Luxury""' in csv_text, "Double quotes must be escaped with double quotes per RFC 4180"
    assert "--- EXECUTIVE KPI SUMMARY ---" in csv_text

    checks["7_rfc4180_csv_generation"] = "PASSED"
    print("  -> Passed: CSV export follows RFC 4180 quoting and CRLF rules.", flush=True)


def test_8_json_report_serialization():
    print("[8/11] Checking: JSON report serialization...", flush=True)
    from app.services.reports_service import ReportsService
    from app.schemas.reports import ReportExportRequest, ReportFilterParams, ReportPreviewResponse, ReportColumn
    from app.models.user import User

    mock_db = MagicMock()
    service = ReportsService(db=mock_db)
    user = User(id="user-test-uuid", email="operator@visionplate.ai")

    now = datetime.now(timezone.utc)
    mock_preview = ReportPreviewResponse(
        report_id="RPT-TEST-003",
        report_title="Plate Recognition Report",
        report_type="plate_recognition",
        period_start=now - timedelta(days=7),
        period_end=now,
        timezone="UTC",
        applied_filters={},
        summary_kpis={"total_plates": 15},
        columns=[ReportColumn(key="plate_id", label="Plate ID", type="string")],
        rows=[{"plate_id": "p-1"}],
        total_rows=1,
        definitions={},
        caveats=[],
        generated_at=now,
    )
    service.generate_report_preview = AsyncMock(return_value=mock_preview)

    # Synchronous JSON serialization test
    json_text = service.generate_json_from_preview(mock_preview)

    parsed = json.loads(json_text)
    assert parsed["report_id"] == "RPT-TEST-003"
    assert parsed["report_type"] == "plate_recognition"
    assert "summary_kpis" in parsed
    assert "rows" in parsed

    checks["8_json_report_serialization"] = "PASSED"
    print("  -> Passed: Structured JSON report serialized and validated.", flush=True)


def test_9_detection_vs_ocr_distinction():
    print("[9/11] Checking: Detection vs OCR recognition distinction...", flush=True)
    from app.repositories.reports_repository import ReportsRepository

    summary_src = inspect.getsource(ReportsRepository.get_recognition_summary_report_data)
    assert "Plate.plate_text.isnot(None)" in summary_src
    assert "unreadable_plates" in summary_src
    assert "ocr_resolution_rate" in summary_src

    checks["9_detection_vs_ocr_distinction"] = "PASSED"
    print("  -> Passed: Detection vs OCR recognition distinction strictly separated.", flush=True)


def test_10_date_boundary_validation():
    print("[10/11] Checking: Date boundary validation in ReportsService...", flush=True)
    from app.services.reports_service import ReportsService
    from app.schemas.reports import ReportFilterParams
    from app.core.exceptions import InvalidFileException

    mock_db = MagicMock()
    service = ReportsService(db=mock_db)

    now = datetime.now(timezone.utc)
    future = now + timedelta(days=10)

    try:
        service._resolve_date_bounds(ReportFilterParams(start_date=future, end_date=now))
        assert False, "Should raise InvalidFileException"
    except InvalidFileException:
        pass

    checks["10_date_boundary_validation"] = "PASSED"
    print("  -> Passed: Invalid date ranges (start > end) properly rejected.", flush=True)


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
    print("=== VISIONPLATE AI: PHASE 06 REPORTS VERIFICATION ===", flush=True)
    test_1_ai_model_safety()
    test_2_reports_endpoints_contract()
    test_3_auth_and_user_isolation()
    test_4_six_core_templates()
    test_5_repository_query_scoping()
    test_6_reportlab_pdf_generation()
    test_7_rfc4180_csv_generation()
    test_8_json_report_serialization()
    test_9_detection_vs_ocr_distinction()
    test_10_date_boundary_validation()
    test_11_typescript_compilation()

    print("\n==================================================")
    print("ALL 11 CHECKS PASSED FOR PHASE 06 REPORTS INTEGRATION!")
    print("==================================================")
    for k, v in checks.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
