"""Service layer orchestrating report generation, preview assembly, and PDF/CSV/JSON exports."""

import io
import json
import math
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.pdfgen import canvas

from app.core.exceptions import InvalidFileException
from app.core.logging import logger
from app.models.report import Report, ReportFolder
from app.models.user import User
from app.repositories.reports_repository import ReportsRepository
from app.schemas.reports import (
    FolderCreateRequest,
    FolderListResponse,
    FolderResponse,
    FolderUpdateRequest,
    ReportColumn,
    ReportExportRequest,
    ReportGenerateRequest,
    ReportMoveRequest,
    ReportMoveResponse,
    ReportOverviewResponse,
    ReportPreviewRequest,
    ReportPreviewResponse,
    ReportTemplateInfo,
    SavedReportListResponse,
    SavedReportResponse,
)
from app.services.storage_service import BaseStorageService, get_storage_service

REPORT_TEMPLATES: List[ReportTemplateInfo] = [
    ReportTemplateInfo(
        id="recognition_summary",
        title="Recognition Summary Report",
        description="Comprehensive audit of ALPR inference jobs, localized vehicles, detected license plates, and OCR success rates.",
        category="Executive Summary",
        supported_formats=["pdf", "csv", "json"],
    ),
    ReportTemplateInfo(
        id="vehicle_distribution",
        title="Vehicle Distribution Report",
        description="Breakdown of detected vehicles grouped by verified YOLOv8 classification (cars, trucks, buses, two-wheelers, auto rickshaws).",
        category="Classification Audit",
        supported_formats=["pdf", "csv", "json"],
    ),
    ReportTemplateInfo(
        id="plate_recognition",
        title="License Plate Recognition Report",
        description="Detailed analysis distinguishing between localized plate bounding boxes and valid OCR text extractions with MoRTH standards.",
        category="ALPR & OCR Audit",
        supported_formats=["pdf", "csv", "json"],
    ),
    ReportTemplateInfo(
        id="processing_performance",
        title="Processing Performance Report",
        description="Operational throughput and latency telemetry across completed jobs, categorized by duration distribution brackets.",
        category="System Performance",
        supported_formats=["pdf", "csv", "json"],
    ),
    ReportTemplateInfo(
        id="media_breakdown",
        title="Media Breakdown Report",
        description="Comparative workload and accuracy evaluation contrasting still image assets against 1-FPS sampled video feeds.",
        category="Media Telemetry",
        supported_formats=["pdf", "csv", "json"],
    ),
    ReportTemplateInfo(
        id="custom_range",
        title="Custom Date-Range Report",
        description="Targeted investigation report executing deep multi-parametric filtering over user-specified date boundaries.",
        category="Custom Inspection",
        supported_formats=["pdf", "csv", "json"],
    ),
]


class NumberedCanvas(canvas.Canvas):
    """Custom canvas tracking two-pass total page count for running footers."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#71717A"))

        # Running header
        self.drawString(36, 762, "VisionPlate AI — Operational Intelligence Report")
        self.drawRightString(576, 762, "CONFIDENTIAL / INTERNAL AUDIT")
        self.setStrokeColor(colors.HexColor("#E4E4E7"))
        self.setLineWidth(0.5)
        self.line(36, 756, 576, 756)

        # Running footer
        self.line(36, 42, 576, 42)
        self.drawString(36, 30, f"Generated UTC | Strict User Isolation Boundary Enforced")
        self.drawRightString(576, 30, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


class ReportsService:
    """Service generating report previews, managing saved reports, and handling PDF, CSV, and JSON exports."""

    def __init__(self, db: AsyncSession, storage: Optional[BaseStorageService] = None):
        self.db = db
        self.repo = ReportsRepository(session=db)
        self.storage = storage or get_storage_service()

    async def get_reports_overview(self, current_user: User) -> ReportOverviewResponse:
        """Retrieves catalog of templates and user record statistics."""
        meta = await self.repo.get_user_overview_meta(user_id=current_user.id)
        return ReportOverviewResponse(
            templates=REPORT_TEMPLATES,
            total_user_records=meta["total_user_records"],
            earliest_record_date=meta["earliest_record_date"],
            latest_record_date=meta["latest_record_date"],
            supported_formats=["pdf", "csv", "json"],
            generated_at=datetime.now(timezone.utc),
        )

    def _resolve_date_bounds(self, filters) -> Tuple[datetime, datetime]:
        """Resolves date boundaries ensuring valid start and end bounds."""
        now = datetime.now(timezone.utc)
        start_date = filters.start_date if filters else None
        end_date = filters.end_date if filters else None
        days = filters.days if filters else None

        if start_date is not None and end_date is not None:
            if start_date > end_date:
                raise InvalidFileException("start_date cannot be greater than end_date.")
            return start_date, end_date
        elif start_date is not None:
            if start_date > now:
                raise InvalidFileException("start_date cannot be in the future.")
            return start_date, now
        elif end_date is not None:
            day_span = days if days and days > 0 else 30
            return end_date - timedelta(days=day_span), end_date
        else:
            day_span = days if days and days > 0 else 30
            return now - timedelta(days=day_span), now

    async def generate_report_preview(
        self,
        current_user: User,
        request: ReportPreviewRequest,
    ) -> ReportPreviewResponse:
        """Generates structured report preview based on requested template and filters."""
        start_date, end_date = self._resolve_date_bounds(request.filters)
        filters = request.filters
        media_type = filters.media_type if filters else None
        status = filters.status if filters else None
        v_class = filters.vehicle_class if filters else None

        report_type = request.report_type
        matched_tpl = next((t for t in REPORT_TEMPLATES if t.id == report_type), REPORT_TEMPLATES[0])
        now = datetime.now(timezone.utc)
        report_id = f"RPT-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        applied_filters = {
            "media_type": media_type or "all",
            "status": status or "all",
            "vehicle_class": v_class or "all",
            "duration_days": (end_date - start_date).days,
        }

        # Template-specific dispatch
        if report_type in ("recognition_summary", "custom_range"):
            kpis, rows, total_rows = await self.repo.get_recognition_summary_report_data(
                user_id=current_user.id,
                start_date=start_date,
                end_date=end_date,
                media_type=media_type,
                status=status,
            )
            columns = [
                ReportColumn(key="job_id", label="Job Identifier", type="string"),
                ReportColumn(key="filename", label="Asset Filename", type="string"),
                ReportColumn(key="created_at", label="Created Timestamp", type="string"),
                ReportColumn(key="media_type", label="Media Type", type="badge"),
                ReportColumn(key="status", label="Status", type="badge"),
                ReportColumn(key="latency_ms", label="Latency (ms)", type="number"),
                ReportColumn(key="vehicles_detected", label="Vehicles", type="number"),
                ReportColumn(key="plates_detected", label="Plates", type="number"),
                ReportColumn(key="recognized_plates", label="Recognized Plate Numbers", type="string"),
            ]
            definitions = {
                "Job Success Rate": "Completed jobs / Terminal jobs (completed + failed) * 100.",
                "OCR Resolution Rate": "Plates with non-empty recognized text / Total plate bounding boxes * 100.",
                "Average Latency": "Mean execution duration across completed recognition jobs.",
            }
            caveats = [
                "Reflects user processing sessions, not real-world road traffic volume.",
                "Plate detection indicates an ROI localization, while recognized plate indicates valid extracted characters.",
            ]

        elif report_type == "vehicle_distribution":
            kpis, rows, total_rows = await self.repo.get_vehicle_distribution_report_data(
                user_id=current_user.id,
                start_date=start_date,
                end_date=end_date,
                media_type=media_type,
                status=status,
                vehicle_class=v_class,
            )
            columns = [
                ReportColumn(key="vehicle_id", label="Vehicle ID", type="string"),
                ReportColumn(key="detection_job_id", label="Job ID", type="string"),
                ReportColumn(key="vehicle_class", label="Class", type="badge"),
                ReportColumn(key="confidence_pct", label="Confidence %", type="number"),
                ReportColumn(key="bbox", label="Bounding Box [xmin, ymin, xmax, ymax]", type="string"),
                ReportColumn(key="media_type", label="Media", type="string"),
                ReportColumn(key="detected_at", label="Timestamp", type="string"),
            ]
            definitions = {
                "Vehicle Classes": "Classes localized by YOLOv8 (car, truck, bus, motorbike, auto_rickshaw).",
                "Confidence Score": "Model detection probability thresholded at minimum 0.25.",
            }
            caveats = [
                "Vehicle counts represent verified localized entities, decoupled from license plates.",
            ]

        elif report_type == "plate_recognition":
            kpis, rows, total_rows = await self.repo.get_plate_recognition_report_data(
                user_id=current_user.id,
                start_date=start_date,
                end_date=end_date,
                media_type=media_type,
                status=status,
            )
            columns = [
                ReportColumn(key="plate_id", label="Plate ID", type="string"),
                ReportColumn(key="job_id", label="Job ID", type="string"),
                ReportColumn(key="vehicle_type", label="Vehicle Type", type="string"),
                ReportColumn(key="plate_text", label="Recognized Plate Number", type="string"),
                ReportColumn(key="ocr_status", label="OCR Status", type="badge"),
                ReportColumn(key="plate_confidence_pct", label="Plate Conf %", type="number"),
                ReportColumn(key="bbox", label="Bounding Box", type="string"),
                ReportColumn(key="timestamp", label="Timestamp", type="string"),
            ]
            definitions = {
                "Plate Localization": "Bounding box localized by the YOLOv8 license plate detector.",
                "OCR Status": "RECOGNIZED when Indian plate OCR successfully extracted text; UNREADABLE when obscured.",
            }
            caveats = [
                "Unreadable OCR results are reported honestly and never fabricated.",
            ]

        elif report_type == "processing_performance":
            kpis, rows, total_rows = await self.repo.get_performance_report_data(
                user_id=current_user.id,
                start_date=start_date,
                end_date=end_date,
                media_type=media_type,
            )
            columns = [
                ReportColumn(key="job_id", label="Job ID", type="string"),
                ReportColumn(key="media_type", label="Media Type", type="badge"),
                ReportColumn(key="status", label="Status", type="string"),
                ReportColumn(key="processing_time_ms", label="Duration (ms)", type="number"),
                ReportColumn(key="latency_bracket", label="Latency Bracket", type="badge"),
                ReportColumn(key="executed_at", label="Timestamp", type="string"),
            ]
            definitions = {
                "Latency Bracket": "Fast (< 1s), Normal (1s - 2.5s), Heavy (> 2.5s).",
                "Evaluated Jobs": "Strictly completed jobs with persisted processing durations.",
            }
            caveats = [
                "Reflects server inference processing time including pre- and post-processing.",
            ]

        elif report_type == "media_breakdown":
            kpis, rows, total_rows = await self.repo.get_media_breakdown_report_data(
                user_id=current_user.id,
                start_date=start_date,
                end_date=end_date,
                status=status,
            )
            columns = [
                ReportColumn(key="media_category", label="Media Category", type="badge"),
                ReportColumn(key="total_jobs", label="Total Jobs", type="number"),
                ReportColumn(key="completed_jobs", label="Completed", type="number"),
                ReportColumn(key="failed_jobs", label="Failed", type="number"),
                ReportColumn(key="success_rate_pct", label="Success Rate %", type="percentage"),
                ReportColumn(key="vehicles_detected", label="Vehicles Detected", type="number"),
                ReportColumn(key="average_latency_ms", label="Avg Latency (ms)", type="number"),
            ]
            definitions = {
                "Media Categories": "Image (still photography) and Video (video streams sampled at 1 FPS).",
            }
            caveats = [
                "Video frames are sampled at 1 FPS to optimize computational bandwidth.",
            ]
        else:
            raise InvalidFileException(f"Unsupported report template: {report_type}")

        return ReportPreviewResponse(
            report_id=report_id,
            report_title=matched_tpl.title,
            report_type=report_type,
            period_start=start_date,
            period_end=end_date,
            timezone="UTC",
            applied_filters=applied_filters,
            summary_kpis=kpis,
            columns=columns,
            rows=rows,
            total_rows=total_rows,
            definitions=definitions,
            caveats=caveats,
            generated_at=now,
        )

    def generate_csv_from_preview(self, preview: ReportPreviewResponse) -> str:
        """Serializes a report preview into RFC 4180 compliant CSV."""
        def escape(v: Any) -> str:
            if v is None:
                return '""'
            s = str(v).replace('"', '""')
            return f'"{s}"'

        lines = [
            f"# VisionPlate AI Report — {preview.report_title}",
            f"# Report_ID,{preview.report_id}",
            f"# Generated_At,{preview.generated_at.isoformat()}",
            f"# Period,{preview.period_start.isoformat()} to {preview.period_end.isoformat()} (UTC)",
            "",
            "--- EXECUTIVE KPI SUMMARY ---",
            "Metric,Value",
        ]
        for k, v in preview.summary_kpis.items():
            if not isinstance(v, (dict, list)):
                lines.append(f"{escape(k)},{escape(v)}")

        lines.extend([
            "",
            "--- DETAILED TABULAR DATASET ---",
            ",".join(escape(col.label) for col in preview.columns),
        ])

        for row in preview.rows:
            lines.append(",".join(escape(row.get(col.key, "")) for col in preview.columns))

        return "\r\n".join(lines)

    async def export_report_csv(self, current_user: User, request: ReportExportRequest) -> str:
        """Generates RFC 4180 compliant CSV formatted content."""
        preview = await self.generate_report_preview(
            current_user=current_user,
            request=ReportPreviewRequest(report_type=request.report_type, filters=request.filters),
        )
        return self.generate_csv_from_preview(preview)

    def generate_json_from_preview(self, preview: ReportPreviewResponse) -> str:
        """Serializes a report preview into structured JSON."""
        return json.dumps(preview.model_dump(mode="json"), indent=2)

    async def export_report_json(self, current_user: User, request: ReportExportRequest) -> str:
        """Generates full structured JSON report."""
        preview = await self.generate_report_preview(
            current_user=current_user,
            request=ReportPreviewRequest(report_type=request.report_type, filters=request.filters),
        )
        return self.generate_json_from_preview(preview)

    def generate_pdf_from_preview(
        self, preview: ReportPreviewResponse, user_email: str = "operator@visionplate.ai"
    ) -> io.BytesIO:
        """Renders a report preview into an in-memory ReportLab PDF document."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=36,
            rightMargin=36,
            topMargin=48,
            bottomMargin=48,
        )

        styles = getSampleStyleSheet()

        brand_style = ParagraphStyle(
            "BrandTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#1A1815"),
        )
        report_title_style = ParagraphStyle(
            "ReportTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#EA580C"),
        )
        meta_label_style = ParagraphStyle(
            "MetaLabel",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#71717A"),
        )
        meta_val_style = ParagraphStyle(
            "MetaVal",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#1A1815"),
        )
        table_hdr_style = ParagraphStyle(
            "TableHdr",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=9,
            textColor=colors.white,
        )
        table_cell_style = ParagraphStyle(
            "TableCell",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7,
            leading=9,
            textColor=colors.HexColor("#18181B"),
        )
        caveat_style = ParagraphStyle(
            "Caveat",
            parent=styles["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=7,
            leading=9,
            textColor=colors.HexColor("#52525B"),
        )

        story = []

        # 1. Header Block
        story.append(Paragraph("VisionPlate AI — Intelligence Systems", brand_style))
        story.append(Paragraph(f"{preview.report_title} // ID: {preview.report_id}", report_title_style))
        story.append(Spacer(1, 8))

        # 2. Metadata Grid
        period_str = f"{preview.period_start.strftime('%Y-%m-%d')} to {preview.period_end.strftime('%Y-%m-%d')} UTC"
        meta_data = [
            [
                Paragraph("<b>Generated:</b>", meta_label_style),
                Paragraph(preview.generated_at.strftime("%Y-%m-%d %H:%M:%S UTC"), meta_val_style),
                Paragraph("<b>Reporting Period:</b>", meta_label_style),
                Paragraph(period_str, meta_val_style),
            ],
            [
                Paragraph("<b>Operator:</b>", meta_label_style),
                Paragraph(user_email, meta_val_style),
                Paragraph("<b>Applied Filters:</b>", meta_label_style),
                Paragraph(
                    f"Media: {preview.applied_filters.get('media_type', 'all')}, Status: {preview.applied_filters.get('status', 'all')}",
                    meta_val_style,
                ),
            ],
        ]
        meta_table = Table(meta_data, colWidths=[70, 190, 80, 200])
        meta_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAF8F5")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8CFC0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#EAE3D5")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 12))

        # 3. Executive KPI Summary Block
        story.append(
            Paragraph(
                "<b>Executive Summary KPIs</b>",
                ParagraphStyle("H2", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=colors.HexColor("#1A1815")),
            )
        )
        story.append(Spacer(1, 4))

        kpi_items = [
            (k.replace("_", " ").title(), str(v) if v is not None else "—")
            for k, v in preview.summary_kpis.items()
            if not isinstance(v, (dict, list))
        ]
        kpi_rows = []
        for i in range(0, len(kpi_items), 2):
            pair = kpi_items[i:i + 2]
            row = []
            for k, v in pair:
                row.extend([Paragraph(k, meta_label_style), Paragraph(v, meta_val_style)])
            while len(row) < 4:
                row.extend([Paragraph("", meta_label_style), Paragraph("", meta_val_style)])
            kpi_rows.append(row)

        if kpi_rows:
            kpi_table = Table(kpi_rows, colWidths=[140, 130, 140, 130])
            kpi_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8CFC0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#F0ECE4")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            story.append(kpi_table)
            story.append(Spacer(1, 14))

        # 4. Detailed Tabular Dataset
        story.append(
            Paragraph(
                f"<b>Detailed Dataset ({preview.total_rows} matching records)</b>",
                ParagraphStyle("H2", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=colors.HexColor("#1A1815")),
            )
        )
        story.append(Spacer(1, 4))

        col_count = len(preview.columns)
        table_width = 540
        col_w = table_width / max(1, col_count)

        headers = [Paragraph(col.label, table_hdr_style) for col in preview.columns]
        data_rows = [headers]

        for r in preview.rows[:100]:
            row_cells = []
            for col in preview.columns:
                val = r.get(col.key, "")
                txt = str(val if val is not None else "")
                if len(txt) > 28:
                    txt = txt[:25] + "..."
                row_cells.append(Paragraph(txt, table_cell_style))
            data_rows.append(row_cells)

        if len(data_rows) == 1:
            data_rows.append([Paragraph("No records found matching query criteria.", table_cell_style)] * col_count)

        detail_table = Table(data_rows, colWidths=[col_w] * col_count, repeatRows=1)
        detail_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1A1815")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8CFC0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#EAE3D5")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAF8F5")]),
        ]))
        story.append(detail_table)
        story.append(Spacer(1, 12))

        # 5. Definitions & Caveats (Footer Block)
        story.append(
            KeepTogether([
                Paragraph("<b>Operational Metric Definitions & Caveats:</b>", meta_label_style),
                Spacer(1, 2),
                Paragraph(
                    " • ".join([f"<b>{k}:</b> {v}" for k, v in preview.definitions.items()] + preview.caveats),
                    caveat_style,
                ),
            ])
        )

        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer

    async def export_report_pdf(self, current_user: User, request: ReportExportRequest) -> io.BytesIO:
        """Generates a professional, multi-page ReportLab PDF document."""
        preview = await self.generate_report_preview(
            current_user=current_user,
            request=ReportPreviewRequest(report_type=request.report_type, filters=request.filters),
        )
        return self.generate_pdf_from_preview(preview, current_user.email or "operator@visionplate.ai")

    # =========================================================================
    # PERSISTENT SAVED REPORT LIFECYCLE OPERATIONS
    # =========================================================================

    async def generate_and_persist_report(
        self,
        current_user: User,
        request: ReportGenerateRequest,
    ) -> SavedReportResponse:
        """
        Executes report aggregation, renders artifact bytes (PDF/CSV/JSON), persists
        the artifact to private storage, and commits report metadata to the database.
        Implements compensating cleanup to unlink orphaned storage files if DB commit fails.
        """
        # 1. Validate template
        matched_tpl = next((t for t in REPORT_TEMPLATES if t.id == request.report_type), None)
        if not matched_tpl:
            raise InvalidFileException(f"Unsupported report template: {request.report_type}")

        # 2. Validate format
        if request.format not in matched_tpl.supported_formats:
            raise InvalidFileException(
                f"Format '{request.format}' is not supported for template '{request.report_type}'."
            )

        # 3. Validate optional folder ownership
        if request.folder_id:
            folder = await self.repo.get_folder_by_id(folder_id=request.folder_id, user_id=current_user.id)
            if not folder:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Specified folder not found or unauthorized.",
                )

        # 4. Generate report preview and tabular dataset
        preview = await self.generate_report_preview(
            current_user=current_user,
            request=ReportPreviewRequest(report_type=request.report_type, filters=request.filters),
        )

        # 5. Render document artifact into binary bytes
        now = datetime.now(timezone.utc)
        if request.format == "pdf":
            pdf_buffer = self.generate_pdf_from_preview(preview, current_user.email or "operator@visionplate.ai")
            file_bytes = pdf_buffer.getvalue()
            ext = ".pdf"
        elif request.format == "csv":
            csv_str = self.generate_csv_from_preview(preview)
            file_bytes = csv_str.encode("utf-8")
            ext = ".csv"
        elif request.format == "json":
            json_str = self.generate_json_from_preview(preview)
            file_bytes = json_str.encode("utf-8")
            ext = ".json"
        else:
            raise InvalidFileException(f"Unsupported export format: {request.format}")

        file_size_bytes = len(file_bytes)

        # 6. Generate server-side collision-resistant storage key
        file_uuid = uuid.uuid4().hex
        storage_key = f"reports/{now.year}/{now.month:02d}/{now.day:02d}/{file_uuid}{ext}"

        # 7. Persist file to local private storage
        temp_file = tempfile.NamedTemporaryFile(delete=False)
        try:
            temp_file.write(file_bytes)
            temp_file.flush()
            temp_file_path = Path(temp_file.name)
        finally:
            temp_file.close()

        try:
            await self.storage.store(temp_file_path, storage_key)
        except Exception as store_err:
            if temp_file_path.exists():
                try:
                    temp_file_path.unlink()
                except Exception:
                    pass
            logger.error("Failed to write report artifact to storage: %s", store_err)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Storage persistence failure while saving report.",
            ) from store_err

        # Clean up temp file if not moved
        if temp_file_path.exists():
            try:
                temp_file_path.unlink()
            except Exception:
                pass

        # 8. Assemble compact metadata snapshot (strictly avoiding storing large row data in JSONB)
        compact_report_data = {
            "report_id": preview.report_id,
            "summary_kpis": preview.summary_kpis,
            "total_rows": preview.total_rows,
            "period_start": preview.period_start.isoformat(),
            "period_end": preview.period_end.isoformat(),
            "timezone": preview.timezone,
            "columns": [c.model_dump() for c in preview.columns],
            "definitions": preview.definitions,
            "caveats": preview.caveats,
        }
        parameters_snapshot = request.filters.model_dump(exclude_none=True) if request.filters else {}
        title = (
            request.title.strip()
            if request.title and request.title.strip()
            else f"{preview.report_title} - {now.strftime('%b %d, %Y')}"
        )

        # 9. Create and commit Report database record with compensating cleanup
        report = Report(
            title=title,
            report_type=request.report_type,
            file_format=request.format,
            user_id=current_user.id,
            folder_id=request.folder_id,
            storage_key=storage_key,
            file_size_bytes=file_size_bytes,
            parameters=parameters_snapshot,
            file_url=None,
            report_data=compact_report_data,
        )

        try:
            persisted = await self.repo.create_report(report)
            await self.db.commit()
            await self.db.refresh(persisted)
        except Exception as db_exc:
            await self.db.rollback()
            # Compensating cleanup: unlink newly created storage file
            try:
                await self.storage.delete(storage_key)
            except Exception as del_exc:
                logger.warning("Compensating cleanup failed for storage key '%s': %s", storage_key, del_exc)
            logger.error("Database persistence failed for report record: %s", db_exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to persist report metadata in database.",
            ) from db_exc

        return SavedReportResponse.model_validate(persisted)

    async def list_saved_reports(
        self,
        current_user: User,
        page: int = 1,
        page_size: int = 20,
        report_type: Optional[str] = None,
        file_format: Optional[str] = None,
        folder_id: Optional[str] = None,
        is_uncategorized: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> SavedReportListResponse:
        """Retrieves paginated saved reports for the authenticated user."""
        safe_page = max(1, page)
        safe_page_size = max(1, min(100, page_size))

        items, total = await self.repo.list_user_reports(
            user_id=current_user.id,
            page=safe_page,
            page_size=safe_page_size,
            report_type=report_type,
            file_format=file_format,
            folder_id=folder_id,
            is_uncategorized=is_uncategorized,
            search=search,
        )

        total_pages = max(1, math.ceil(total / safe_page_size)) if total > 0 else 1

        return SavedReportListResponse(
            items=[SavedReportResponse.model_validate(r) for r in items],
            total=total,
            page=safe_page,
            page_size=safe_page_size,
            total_pages=total_pages,
        )

    async def download_saved_report(
        self,
        report_id: str,
        current_user: User,
    ) -> Tuple[bytes, str, str]:
        """
        Validates ownership and retrieves stored report artifact bytes, content type,
        and safe download filename without exposing raw filesystem paths.
        """
        report = await self.repo.get_report_by_id(report_id=report_id, user_id=current_user.id)
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found or unauthorized.",
            )

        if not report.storage_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report artifact storage reference is missing.",
            )

        if not await self.storage.exists(report.storage_key):
            logger.error("Stored report artifact missing on disk: %s", report.storage_key)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stored report artifact not found on server.",
            )

        file_bytes = await self.storage.read_bytes(report.storage_key)

        # Content-Type mapping
        media_type_map = {
            "pdf": "application/pdf",
            "csv": "text/csv; charset=utf-8",
            "json": "application/json",
        }
        media_type = media_type_map.get(report.file_format.lower(), "application/octet-stream")

        # Safe client filename
        clean_title = "".join(c for c in report.title if c.isalnum() or c in ("-", "_", " ")).strip().replace(" ", "_").lower()
        if not clean_title:
            clean_title = "report"
        date_str = report.created_at.strftime("%Y%m%d")
        safe_filename = f"visionplate_{clean_title}_{date_str}.{report.file_format.lower()}"

        return file_bytes, media_type, safe_filename

    async def delete_saved_report(
        self,
        report_id: str,
        current_user: User,
    ) -> bool:
        """
        Performs safe two-step deletion: deletes database record transactionally first,
        then unlinks physical file from storage.
        """
        report = await self.repo.delete_report(report_id=report_id, user_id=current_user.id)
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found or unauthorized.",
            )

        await self.db.commit()

        if report.storage_key:
            try:
                await self.storage.delete(report.storage_key)
            except Exception as del_err:
                logger.warning("Failed to delete physical report file '%s': %s", report.storage_key, del_err)

        return True

    # =========================================================================
    # REPORT FOLDER MANAGEMENT METHODS
    # =========================================================================

    async def create_folder(
        self,
        current_user: User,
        request: FolderCreateRequest,
    ) -> FolderResponse:
        """Creates a new report organization folder enforcing per-user case-insensitive name uniqueness."""
        name = request.name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Folder name cannot be blank or whitespace only.",
            )

        # Check existing folder with same name for this user (case-insensitive)
        existing = await self.repo.get_folder_by_name(user_id=current_user.id, name=name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Folder with name '{name}' already exists.",
            )

        folder = ReportFolder(
            user_id=current_user.id,
            name=name,
            description=request.description,
            color=request.color or "orange",
        )

        try:
            saved_folder = await self.repo.create_folder(folder)
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Folder with name '{name}' already exists.",
            )

        return FolderResponse(
            id=saved_folder.id,
            user_id=saved_folder.user_id,
            name=saved_folder.name,
            description=saved_folder.description,
            color=saved_folder.color or "orange",
            report_count=0,
            created_at=saved_folder.created_at,
            updated_at=saved_folder.updated_at,
        )

    async def list_folders(self, current_user: User) -> FolderListResponse:
        """Lists all report folders owned by the authenticated user along with report counts."""
        rows = await self.repo.list_user_folders_with_counts(user_id=current_user.id)
        items = [
            FolderResponse(
                id=folder.id,
                user_id=folder.user_id,
                name=folder.name,
                description=folder.description,
                color=folder.color or "orange",
                report_count=count,
                created_at=folder.created_at,
                updated_at=folder.updated_at,
            )
            for folder, count in rows
        ]
        return FolderListResponse(items=items, total=len(items))

    async def get_folder_detail(self, folder_id: str, current_user: User) -> FolderResponse:
        """Retrieves a single folder's details and report count with strict ownership isolation."""
        folder = await self.repo.get_folder_by_id(folder_id=folder_id, user_id=current_user.id)
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found or unauthorized.",
            )

        count = await self.repo.get_folder_report_count(folder_id=folder_id, user_id=current_user.id)
        return FolderResponse(
            id=folder.id,
            user_id=folder.user_id,
            name=folder.name,
            description=folder.description,
            color=folder.color or "orange",
            report_count=count,
            created_at=folder.created_at,
            updated_at=folder.updated_at,
        )

    async def update_folder(
        self,
        folder_id: str,
        current_user: User,
        request: FolderUpdateRequest,
    ) -> FolderResponse:
        """Renames or updates folder metadata with conflict checks and ownership verification."""
        folder = await self.repo.get_folder_by_id(folder_id=folder_id, user_id=current_user.id)
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found or unauthorized.",
            )

        clean_name = None
        if request.name is not None:
            clean_name = request.name.strip()
            if not clean_name:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Folder name cannot be blank or whitespace only.",
                )
            if clean_name.lower() != folder.name.lower():
                existing = await self.repo.get_folder_by_name(user_id=current_user.id, name=clean_name)
                if existing and existing.id != folder.id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Folder with name '{clean_name}' already exists.",
                    )

        try:
            updated = await self.repo.update_folder(
                folder=folder,
                name=clean_name,
                description=request.description,
                color=request.color,
            )
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Folder with name '{clean_name}' already exists.",
            )

        count = await self.repo.get_folder_report_count(folder_id=folder_id, user_id=current_user.id)
        return FolderResponse(
            id=updated.id,
            user_id=updated.user_id,
            name=updated.name,
            description=updated.description,
            color=updated.color or "orange",
            report_count=count,
            created_at=updated.created_at,
            updated_at=updated.updated_at,
        )

    async def delete_folder(self, folder_id: str, current_user: User) -> Dict[str, Any]:
        """Deletes a folder while strictly preserving all member reports (unorganizing them)."""
        folder = await self.repo.get_folder_by_id(folder_id=folder_id, user_id=current_user.id)
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found or unauthorized.",
            )

        await self.repo.delete_folder(folder_id=folder_id, user_id=current_user.id)
        await self.db.commit()

        return {
            "status": "success",
            "message": "Folder deleted successfully. Associated reports preserved in Unorganized.",
            "folder_id": folder_id,
        }

    async def move_report(
        self,
        report_id: str,
        current_user: User,
        request: ReportMoveRequest,
    ) -> ReportMoveResponse:
        """
        Moves a report to a target folder or unorganizes it (folder_id=None).
        Strictly enforces user ownership on both the report and the target folder.
        """
        report = await self.repo.get_report_by_id(report_id=report_id, user_id=current_user.id)
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found or unauthorized.",
            )

        target_folder_id = request.folder_id
        if target_folder_id:
            target_folder = await self.repo.get_folder_by_id(folder_id=target_folder_id, user_id=current_user.id)
            if not target_folder:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Target folder not found or unauthorized.",
                )

        moved = await self.repo.move_report(
            report_id=report_id,
            user_id=current_user.id,
            folder_id=target_folder_id,
        )
        await self.db.commit()

        return ReportMoveResponse(
            status="success",
            report_id=report_id,
            folder_id=target_folder_id,
            message="Report moved successfully.",
        )


