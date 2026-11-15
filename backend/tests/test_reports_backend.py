"""Unit tests for Phase 06 Reports service, schemas, and export formatters."""

import json
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock
import pytest

from app.core.exceptions import InvalidFileException
from app.models.user import User
from app.schemas.reports import (
    ReportFilterParams,
    ReportPreviewRequest,
    ReportExportRequest,
    ReportPreviewResponse,
    ReportColumn,
)
from app.services.reports_service import ReportsService, REPORT_TEMPLATES


def test_reports_templates_catalog():
    """Verify all 6 required report templates are defined with required attributes."""
    template_ids = {t.id for t in REPORT_TEMPLATES}
    expected = {
        "recognition_summary",
        "vehicle_distribution",
        "plate_recognition",
        "processing_performance",
        "media_breakdown",
        "custom_range",
    }
    assert expected.issubset(template_ids)
    for t in REPORT_TEMPLATES:
        assert len(t.title) > 0
        assert len(t.description) > 0
        assert set(t.supported_formats) == {"pdf", "csv", "json"}


def test_report_date_boundary_validation():
    """Test that inverted date boundaries raise InvalidFileException."""
    mock_db = MagicMock()
    service = ReportsService(db=mock_db)

    now = datetime.now(timezone.utc)
    future = now + timedelta(days=5)

    with pytest.raises(InvalidFileException) as exc_info:
        service._resolve_date_bounds(ReportFilterParams(start_date=future, end_date=now))
    assert "start_date cannot be greater than end_date" in str(exc_info.value)


def test_report_pdf_generation_validity():
    """Test in-memory PDF generation produces a valid document with %PDF magic header."""
    mock_db = MagicMock()
    service = ReportsService(db=mock_db)
    now = datetime.now(timezone.utc)

    preview = ReportPreviewResponse(
        report_id="RPT-UNIT-PDF",
        report_title="Recognition Summary Report",
        report_type="recognition_summary",
        period_start=now - timedelta(days=7),
        period_end=now,
        timezone="UTC",
        applied_filters={"media_type": "all", "status": "all"},
        summary_kpis={"total_jobs": 10, "completed_jobs": 9, "failed_jobs": 1, "success_rate": 90.0},
        columns=[
            ReportColumn(key="job_id", label="Job ID", type="string"),
            ReportColumn(key="filename", label="Filename", type="string"),
            ReportColumn(key="status", label="Status", type="badge"),
        ],
        rows=[
            {"job_id": "job-101", "filename": "car.jpg", "status": "COMPLETED"},
        ],
        total_rows=1,
        definitions={"Success Rate": "Completed / Terminal * 100"},
        caveats=["Internal unit test data."],
        generated_at=now,
    )

    pdf_buffer = service.generate_pdf_from_preview(preview, user_email="test@visionplate.ai")
    pdf_bytes = pdf_buffer.getvalue()

    assert len(pdf_bytes) > 500
    assert pdf_bytes.startswith(b"%PDF")


def test_report_csv_rfc4180_escaping():
    """Test RFC 4180 CSV export follows double quote escaping and CRLF endings."""
    mock_db = MagicMock()
    service = ReportsService(db=mock_db)
    now = datetime.now(timezone.utc)

    preview = ReportPreviewResponse(
        report_id="RPT-UNIT-CSV",
        report_title="Vehicle Distribution Report",
        report_type="vehicle_distribution",
        period_start=now - timedelta(days=30),
        period_end=now,
        timezone="UTC",
        applied_filters={"media_type": "image"},
        summary_kpis={"total_vehicles": 25},
        columns=[
            ReportColumn(key="id", label="ID", type="string"),
            ReportColumn(key="notes", label="Notes", type="string"),
        ],
        rows=[
            {"id": "v-1", "notes": 'Found in "Zone A", Mumbai'},
        ],
        total_rows=1,
        definitions={},
        caveats=[],
        generated_at=now,
    )

    csv_text = service.generate_csv_from_preview(preview)

    assert "\r\n" in csv_text
    assert '""Zone A""' in csv_text
    assert "--- EXECUTIVE KPI SUMMARY ---" in csv_text
    assert "--- DETAILED TABULAR DATASET ---" in csv_text


def test_report_json_serialization():
    """Test structured JSON serialization produces valid, parseable JSON."""
    mock_db = MagicMock()
    service = ReportsService(db=mock_db)
    now = datetime.now(timezone.utc)

    preview = ReportPreviewResponse(
        report_id="RPT-UNIT-JSON",
        report_title="Processing Performance Report",
        report_type="processing_performance",
        period_start=now - timedelta(days=7),
        period_end=now,
        timezone="UTC",
        applied_filters={},
        summary_kpis={"avg_latency_ms": 1420.5},
        columns=[ReportColumn(key="job_id", label="Job ID", type="string")],
        rows=[{"job_id": "j-202"}],
        total_rows=1,
        definitions={},
        caveats=[],
        generated_at=now,
    )

    json_text = service.generate_json_from_preview(preview)
    parsed = json.loads(json_text)

    assert parsed["report_id"] == "RPT-UNIT-JSON"
    assert parsed["summary_kpis"]["avg_latency_ms"] == 1420.5
    assert parsed["total_rows"] == 1
    assert parsed["rows"][0]["job_id"] == "j-202"
