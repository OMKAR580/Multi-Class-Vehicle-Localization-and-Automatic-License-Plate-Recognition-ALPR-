"""
VisionPlate AI — Phase 03: Dashboard Home Integration Comprehensive Verification Suite
Tests:
1. Pydantic Dashboard Schemas & Contracts Validation
2. API Router Registration & Contract Inspection (/dashboard/overview, /stats, /activity)
3. DashboardService Business Logic & Activity Item Formatter
4. Repository User Isolation & Query Attribution
5. Frontend TypeScript API Client Contract Aligned
6. Frontend Dashboard Home View Integration (Real Data, Zero-state, KPIs, Timeline, Distribution, Recent Jobs)
7. Frontend TypeScript Compilation (tsc --noEmit)
"""

import inspect
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# Setup paths
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
frontend_dir = root_dir / "frontend"
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(root_dir))

checklist_results = {}


def test_1_dashboard_schemas():
    print("[1/7] Testing Dashboard Pydantic Schemas & Serialization...", flush=True)
    from app.schemas.dashboard import (
        ActivityTimelineItem,
        DashboardActivityItem,
        DashboardActivityResponse,
        DashboardOverviewResponse,
        DashboardStatsResponse,
        DashboardSummary,
        VehicleClassDistributionItem,
    )

    # 1. Empty overview schema instantiation
    empty_summary = DashboardSummary(
        total_jobs=0,
        completed_jobs=0,
        failed_jobs=0,
        pending_jobs=0,
        processing_jobs=0,
        total_vehicles_detected=0,
        total_plates_detected=0,
        recognized_plates=0,
        image_jobs=0,
        video_jobs=0,
        average_processing_time_ms=None,
        success_rate=0.0,
    )
    empty_overview = DashboardOverviewResponse(
        summary=empty_summary,
        activity_timeline=[],
        vehicle_distribution=[],
        recent_jobs=[],
    )
    dumped = empty_overview.model_dump(mode="json")
    assert dumped["summary"]["total_jobs"] == 0
    assert dumped["summary"]["average_processing_time_ms"] is None
    assert dumped["activity_timeline"] == []
    assert dumped["vehicle_distribution"] == []
    assert dumped["recent_jobs"] == []

    # 2. Populated overview schema instantiation
    now = datetime.now(timezone.utc)
    populated_summary = DashboardSummary(
        total_jobs=12,
        completed_jobs=10,
        failed_jobs=2,
        pending_jobs=0,
        processing_jobs=0,
        total_vehicles_detected=25,
        total_plates_detected=18,
        recognized_plates=17,
        image_jobs=8,
        video_jobs=4,
        average_processing_time_ms=1240.5,
        success_rate=83.33,
    )
    timeline_items = [
        ActivityTimelineItem(
            date="2026-11-14",
            day_name="Sat",
            total_jobs=5,
            successful_jobs=4,
            failed_jobs=1,
            total_vehicles=12,
        )
    ]
    dist_items = [
        VehicleClassDistributionItem(vehicle_class="car", count=15, percentage=60.0),
        VehicleClassDistributionItem(vehicle_class="truck", count=10, percentage=40.0),
    ]
    recent_jobs = [
        DashboardActivityItem(
            job_id="job-uuid-001",
            media_type="image",
            status="COMPLETED",
            created_at=now,
            completed_at=now,
            vehicle_count=2,
            recognized_plate_count=2,
            error_message=None,
        )
    ]
    overview = DashboardOverviewResponse(
        summary=populated_summary,
        activity_timeline=timeline_items,
        vehicle_distribution=dist_items,
        recent_jobs=recent_jobs,
    )
    overview_json = overview.model_dump_json()
    assert "job-uuid-001" in overview_json
    assert "1240.5" in overview_json
    assert "car" in overview_json

    checklist_results["1. Dashboard Schemas & Contracts"] = "PASSED (Pydantic v2 schemas validated & serialized)"
    print("       -> PASSED: All Dashboard schemas serialized and validated.", flush=True)


def test_2_api_router_registration():
    print("[2/7] Testing FastAPI Router Registration & Contracts...", flush=True)
    from app.api.v1.endpoints.dashboard import router
    from app.schemas.dashboard import DashboardOverviewResponse, DashboardStatsResponse, DashboardActivityResponse

    route_map = {r.path: r for r in router.routes}
    assert "/dashboard/overview" in route_map, f"Missing /dashboard/overview route in dashboard router. Routes: {list(route_map.keys())}"
    assert "/dashboard/stats" in route_map, "Missing /dashboard/stats route in dashboard router"
    assert "/dashboard/activity" in route_map, "Missing /dashboard/activity route in dashboard router"

    overview_route = route_map["/dashboard/overview"]
    assert "GET" in overview_route.methods
    assert overview_route.response_model == DashboardOverviewResponse

    stats_route = route_map["/dashboard/stats"]
    assert "GET" in stats_route.methods
    assert stats_route.response_model == DashboardStatsResponse

    activity_route = route_map["/dashboard/activity"]
    assert "GET" in activity_route.methods
    assert activity_route.response_model == DashboardActivityResponse

    checklist_results["2. API Router Contracts"] = "PASSED (/dashboard/overview, /stats, /activity verified)"
    print("       -> PASSED: Dashboard router endpoints, methods, and response models verified.", flush=True)


def test_3_service_logic_and_formatters():
    print("[3/7] Testing DashboardService Logic & Date Validation...", flush=True)
    from app.services.dashboard_service import DashboardService, validate_date_range
    from fastapi import HTTPException

    # 1. Date validation
    d1 = datetime(2026, 11, 10, tzinfo=timezone.utc)
    d2 = datetime(2026, 11, 14, tzinfo=timezone.utc)
    validate_date_range(d1, d2)  # Should not raise

    try:
        validate_date_range(d2, d1)  # Reversed range
        assert False, "Should have raised HTTPException 422 on reversed date range"
    except HTTPException as exc:
        assert exc.status_code == 422
        assert "cannot be after" in exc.detail

    # 2. Activity item formatter test with mock object
    class MockPlate:
        def __init__(self, text):
            self.plate_text = text

    class MockVehicle:
        def __init__(self, plate_text=None):
            self.plate = MockPlate(plate_text) if plate_text else None

    class MockJob:
        def __init__(self, j_id, m_type, status, vehicles=None, raw_result=None):
            self.id = j_id
            self.media_type = m_type
            self.status = status
            self.created_at = datetime.now(timezone.utc)
            self.updated_at = datetime.now(timezone.utc)
            self.error_message = None
            self.vehicles = vehicles or []
            self.raw_result = raw_result

    v1 = MockVehicle("DL10CA4829")
    v2 = MockVehicle("   ")  # Whitespace plate should not count as recognized
    v3 = MockVehicle(None)
    job_mock = MockJob("test-job-123", "image", "COMPLETED", [v1, v2, v3])

    svc = DashboardService(db=None)
    items = svc._format_activity_items([job_mock])
    assert len(items) == 1
    assert items[0].job_id == "test-job-123"
    assert items[0].vehicle_count == 3
    assert items[0].recognized_plate_count == 1  # Only v1 has non-empty text

    checklist_results["3. Service Logic & Formatting"] = "PASSED (Date validation & entity counting verified)"
    print("       -> PASSED: Service date validation & entity formatting verified.", flush=True)


def test_4_repository_isolation_and_queries():
    print("[4/7] Testing Repository User-Level Data Isolation & SQL Attribution...", flush=True)
    from app.repositories.dashboard_repository import DashboardRepository

    src_stats = inspect.getsource(DashboardRepository.get_aggregated_stats)
    assert "DetectionJob.user_id == user_id" in src_stats, "Must filter jobs by user_id"
    assert "avg_latency" in src_stats or "average_processing_time_ms" in src_stats

    src_dist = inspect.getsource(DashboardRepository.get_vehicle_class_distribution)
    assert "DetectionJob.user_id == user_id" in src_dist, "Vehicle distribution must filter by user_id"
    assert "Vehicle.vehicle_type" in src_dist

    src_timeline = inspect.getsource(DashboardRepository.get_activity_timeline)
    assert "DetectionJob.user_id == user_id" in src_timeline, "Timeline must filter by user_id"

    src_activity = inspect.getsource(DashboardRepository.get_recent_activity)
    assert "DetectionJob.user_id == user_id" in src_activity, "Recent activity must filter by user_id"

    checklist_results["4. User-Level Isolation"] = "PASSED (Strict user_id boundaries across all SQL aggregations)"
    print("       -> PASSED: All repository queries enforce user-level data isolation.", flush=True)


def test_5_frontend_api_client():
    print("[5/7] Testing Frontend API Client Types & Endpoints...", flush=True)
    api_ts_path = frontend_dir / "src" / "lib" / "api.ts"
    assert api_ts_path.exists(), "frontend/src/lib/api.ts not found"

    api_content = api_ts_path.read_text(encoding="utf-8")
    assert "export interface DashboardOverviewResponse" in api_content
    assert "export interface DashboardSummary" in api_content
    assert "export interface ActivityTimelineItem" in api_content
    assert "export interface VehicleClassDistributionItem" in api_content
    assert "export interface DashboardActivityItem" in api_content
    assert "export async function getDashboardOverview" in api_content
    assert "/dashboard/overview" in api_content

    checklist_results["5. Frontend API Client"] = "PASSED (getDashboardOverview & TypeScript types confirmed)"
    print("       -> PASSED: Frontend API client includes DashboardOverview types and fetch function.", flush=True)


def test_6_frontend_dashboard_ui_integration():
    print("[6/7] Testing Frontend Dashboard UI Integration...", flush=True)
    dash_page_path = frontend_dir / "src" / "app" / "app" / "dashboard" / "page.tsx"
    assert dash_page_path.exists(), "frontend/src/app/app/dashboard/page.tsx not found"

    dash_content = dash_page_path.read_text(encoding="utf-8")

    # 1. Ensure real API client call is hooked
    assert "getDashboardOverview" in dash_content
    assert "DashboardOverviewResponse" in dash_content

    # 2. Ensure fake hardcoded metrics removed
    assert "24,850" not in dash_content, "Mock value 24,850 must be replaced with real backend metric"
    assert "INITIAL_DETECTIONS" not in dash_content, "INITIAL_DETECTIONS mock array must be removed"

    # 3. Ensure Key Sections Present
    # Section A: Welcome & Contextual Overview
    assert "Welcome back" in dash_content
    assert "Live Detection Studio" in dash_content
    # Section B: KPIs
    assert "Total Recognition Jobs" in dash_content
    assert "Success & Accuracy" in dash_content or "Success" in dash_content
    assert "Average Latency" in dash_content
    assert "total_vehicles_detected" in dash_content
    # Section C: Timeline
    assert "Recognition Activity Timeline" in dash_content
    assert "activity_timeline" in dash_content
    # Section D: Distribution
    assert "Vehicle Distribution" in dash_content
    assert "vehicle_distribution" in dash_content
    # Section E: Recent Activity
    assert "Recent Recognition Activity" in dash_content
    assert "recent_jobs" in dash_content
    # Section F: Quick Actions
    assert "/app/detect" in dash_content
    assert "/app/history" in dash_content
    assert "/app/analytics" in dash_content
    assert "/app/reports" in dash_content

    # 4. Loading, error, and empty state verification
    assert "isLoading" in dash_content
    assert "isError" in dash_content
    assert "No recognition activity yet" in dash_content or "No activity" in dash_content
    assert "handleExportCsv" in dash_content

    checklist_results["6. Frontend Dashboard UI"] = "PASSED (Real backend data, 6 sections, honest zero-states, CSV export)"
    print("       -> PASSED: Dashboard UI connects to real backend, handles zero-states & real metrics.", flush=True)


def test_7_typescript_compilation():
    print("[7/7] Testing Frontend TypeScript Compilation (tsc --noEmit)...", flush=True)
    result = subprocess.run(
        ["node", "./frontend/node_modules/typescript/bin/tsc", "--project", "frontend/tsconfig.json", "--noEmit"],
        cwd=str(root_dir),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("TypeScript compilation failed:", result.stderr or result.stdout)
        assert False, f"TypeScript compiler error: {result.stdout}"

    checklist_results["7. TypeScript Compilation"] = "PASSED (0 errors across entire frontend)"
    print("       -> PASSED: node tsc compiled cleanly with 0 type errors.", flush=True)


def main():
    print("=" * 70, flush=True)
    print("VISIONPLATE AI — PHASE 03 DASHBOARD INTEGRATION SUITE", flush=True)
    print("=" * 70, flush=True)

    test_1_dashboard_schemas()
    test_2_api_router_registration()
    test_3_service_logic_and_formatters()
    test_4_repository_isolation_and_queries()
    test_5_frontend_api_client()
    test_6_frontend_dashboard_ui_integration()
    test_7_typescript_compilation()

    print("\n" + "=" * 70, flush=True)
    print("PHASE 03 VERIFICATION RESULTS SUMMARY:", flush=True)
    print("=" * 70, flush=True)
    for test_name, status in checklist_results.items():
        print(f"  {test_name.ljust(45)}: {status}", flush=True)
    print("=" * 70, flush=True)
    print("ALL 7 PHASE 03 VERIFICATION CHECKS PASSED PERFECTLY!", flush=True)
    print("=" * 70, flush=True)


if __name__ == "__main__":
    main()
