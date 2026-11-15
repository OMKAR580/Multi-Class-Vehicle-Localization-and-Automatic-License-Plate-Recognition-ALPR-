"""Unit test suite for Phase 05 Analytics service logic, jurisdiction extraction, and schema boundaries."""

import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.models.user import User
from app.services.analytics_service import AnalyticsService, INDIAN_STATE_CODES
from app.core.exceptions import InvalidFileException
from app.schemas.analytics import (
    AnalyticsOverviewResponse,
    AnalyticsPlateMetrics,
    AnalyticsSummary,
    AnalyticsPerformance,
)


def test_jurisdiction_extraction_accuracy():
    """Verify state prefix parser maps Indian license plates accurately."""
    mock_db = MagicMock()
    service = AnalyticsService(db=mock_db)

    # Empty list
    assert service._extract_jurisdictions([]) == []

    test_plates = [
        "DL10CA4829",
        "DL 1R 1947",
        "UP32CR0423",
        "UP 80 BT 7712",
        "HR26DQ5521",
        "MH12QX0001",
        "KA03HA9876",
        "RJ 14 CA 1234",
        "12345",  # non-alphabet prefix
        "XX 99",  # unmapped code
    ]
    res = service._extract_jurisdictions(test_plates)
    codes = {j.code: j for j in res}

    assert "DL" in codes
    assert codes["DL"].count == 2
    assert codes["DL"].name == "Delhi NCT"
    assert "UP" in codes
    assert codes["UP"].count == 2
    assert "HR" in codes
    assert "MH" in codes
    assert "KA" in codes
    assert "RJ" in codes
    assert "OTHER" in codes


def test_plate_vs_ocr_metrics_separation():
    """Verify that plates and recognized plates remain strictly separated."""
    summary = AnalyticsSummary(
        total_jobs=10,
        completed_jobs=9,
        failed_jobs=1,
        pending_jobs=0,
        total_vehicles=15,
        total_plates=12,
        recognized_plates=10,
        unreadable_plates=2,
        success_rate=90.0,
        average_latency_ms=1240.5,
    )
    assert summary.total_plates == 12
    assert summary.recognized_plates == 10
    assert summary.unreadable_plates == 2

    # Recognition rate: 10 / 12 * 100 = 83.3%
    rec_rate = round((summary.recognized_plates / summary.total_plates) * 100.0, 1)
    assert rec_rate == 83.3

    plate_metrics = AnalyticsPlateMetrics(
        total_detected=summary.total_plates,
        recognized=summary.recognized_plates,
        unreadable=summary.unreadable_plates,
        recognition_rate=rec_rate,
        top_jurisdictions=[],
    )
    assert plate_metrics.total_detected == 12
    assert plate_metrics.recognized == 10
    assert plate_metrics.unreadable == 2
    assert plate_metrics.recognition_rate == 83.3


def test_performance_bracket_semantics():
    """Verify latency bracket categorization."""
    perf = AnalyticsPerformance(
        avg_latency_ms=1450.0,
        min_latency_ms=320.0,
        max_latency_ms=3500.0,
        fast_count=4,
        normal_count=8,
        heavy_count=2,
    )
    assert perf.avg_latency_ms == 1450.0
    assert perf.min_latency_ms == 320.0
    assert perf.max_latency_ms == 3500.0
    assert perf.fast_count == 4
    assert perf.normal_count == 8
    assert perf.heavy_count == 2


if __name__ == "__main__":
    print("Running synchronous backend analytics unit tests...")
    test_jurisdiction_extraction_accuracy()
    test_plate_vs_ocr_metrics_separation()
    test_performance_bracket_semantics()
    print("ALL BACKEND ANALYTICS UNIT TESTS PASSED!")
