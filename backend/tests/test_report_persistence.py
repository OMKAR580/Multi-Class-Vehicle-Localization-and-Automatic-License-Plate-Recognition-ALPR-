"""Comprehensive integration and unit tests for Report Persistence, LocalStorage, and Reports API."""

import io
import json
import os
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import Base, get_db
from app.core.deps import get_current_user
from app.main import app
from app.models.detection import DetectionJob
from app.models.report import Report, ReportFolder
from app.models.user import User
from app.schemas.reports import ReportFilterParams, ReportGenerateRequest
from app.services.reports_service import ReportsService
from app.services.storage_service import LocalStorageService, get_storage_service

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def temp_storage_root():
    """Creates a temporary directory for isolated storage tests, ensuring backend/storage is untouched."""
    tmp_dir = tempfile.mkdtemp(prefix="vp_test_storage_")
    yield Path(tmp_dir)
    shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest_asyncio.fixture
async def db_session():
    """Creates an isolated in-memory SQLite async engine with all tables initialized."""
    engine = create_async_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
def storage_service(temp_storage_root) -> LocalStorageService:
    """Isolated LocalStorageService instance bound to the temporary storage directory."""
    return LocalStorageService(base_dir=temp_storage_root)


@pytest_asyncio.fixture
async def test_users(db_session: AsyncSession):
    """Creates two distinct user accounts to verify multi-tenant isolation."""
    user_a = User(
        id=str(uuid.uuid4()),
        username="operator_alpha",
        email="alpha@visionplate.ai",
        role="operator",
        is_active=True,
    )
    user_b = User(
        id=str(uuid.uuid4()),
        username="operator_beta",
        email="beta@visionplate.ai",
        role="operator",
        is_active=True,
    )
    db_session.add_all([user_a, user_b])
    await db_session.commit()
    await db_session.refresh(user_a)
    await db_session.refresh(user_b)
    return user_a, user_b


@pytest_asyncio.fixture
async def seed_detection_data(db_session: AsyncSession, test_users):
    """Seeds historical detection jobs for user A."""
    user_a, _ = test_users
    job = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=user_a.id,
        status="COMPLETED",
        media_type="image",
        media_url="2026/11/14/test_img.jpg",
        processing_time_ms=1240.5,
        raw_result={"vehicles": [{"type": "car", "confidence": 0.95}]},
    )
    db_session.add(job)
    await db_session.commit()


# =============================================================================
# 1. ORM & REPOSITORY TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_report_and_folder_orm_relationships(db_session: AsyncSession, test_users):
    """Verifies ReportFolder and Report model creation, cascade, and ON DELETE SET NULL."""
    user_a, _ = test_users

    # 1. Create ReportFolder
    folder = ReportFolder(
        user_id=user_a.id,
        name="Executive Compliance Audits",
        description="Quarterly review folders",
        color="emerald",
    )
    db_session.add(folder)
    await db_session.commit()
    await db_session.refresh(folder)

    assert folder.id is not None
    assert folder.name == "Executive Compliance Audits"

    # 2. Create Report assigned to folder
    report = Report(
        title="Q4 Recognition Audit",
        report_type="recognition_summary",
        file_format="pdf",
        user_id=user_a.id,
        folder_id=folder.id,
        storage_key="reports/2026/11/15/sample.pdf",
        file_size_bytes=1024,
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)

    assert report.folder_id == folder.id
    assert report.user_id == user_a.id

    # 3. Verify ON DELETE SET NULL on folder deletion
    await db_session.delete(folder)
    await db_session.commit()
    await db_session.refresh(report)

    assert report.folder_id is None  # Report is preserved in uncategorized state!


# =============================================================================
# 2. PERSISTENCE LIFECYCLE SERVICE TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_generate_and_persist_pdf(
    db_session: AsyncSession,
    storage_service: LocalStorageService,
    test_users,
    seed_detection_data,
):
    """Verifies end-to-end PDF report generation, physical file persistence, and metadata commit."""
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    req = ReportGenerateRequest(
        report_type="recognition_summary",
        format="pdf",
        title="Verified PDF Audit Report",
    )

    res = await service.generate_and_persist_report(current_user=user_a, request=req)

    assert res.id is not None
    assert res.title == "Verified PDF Audit Report"
    assert res.file_format == "pdf"
    assert res.file_size_bytes > 0

    # Verify physical file on disk
    persisted_report = await service.repo.get_report_by_id(res.id, user_a.id)
    assert persisted_report is not None
    assert persisted_report.storage_key.startswith("reports/")
    assert persisted_report.storage_key.endswith(".pdf")

    # Check magic bytes '%PDF'
    file_bytes = await storage_service.read_bytes(persisted_report.storage_key)
    assert file_bytes.startswith(b"%PDF")
    assert len(file_bytes) == res.file_size_bytes


@pytest.mark.asyncio
async def test_generate_and_persist_csv(
    db_session: AsyncSession,
    storage_service: LocalStorageService,
    test_users,
    seed_detection_data,
):
    """Verifies RFC 4180 CSV generation and physical storage."""
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    req = ReportGenerateRequest(
        report_type="vehicle_distribution",
        format="csv",
        title="Vehicle CSV Dataset",
    )

    res = await service.generate_and_persist_report(current_user=user_a, request=req)

    assert res.file_format == "csv"
    assert res.file_size_bytes > 0

    persisted_report = await service.repo.get_report_by_id(res.id, user_a.id)
    file_bytes = await storage_service.read_bytes(persisted_report.storage_key)
    csv_text = file_bytes.decode("utf-8")
    assert "VisionPlate AI Report" in csv_text
    assert "\r\n" in csv_text  # RFC 4180 standard CRLF


@pytest.mark.asyncio
async def test_generate_and_persist_json(
    db_session: AsyncSession,
    storage_service: LocalStorageService,
    test_users,
    seed_detection_data,
):
    """Verifies structured JSON generation and physical storage."""
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    req = ReportGenerateRequest(
        report_type="processing_performance",
        format="json",
        title="System Telemetry JSON",
    )

    res = await service.generate_and_persist_report(current_user=user_a, request=req)

    assert res.file_format == "json"
    persisted_report = await service.repo.get_report_by_id(res.id, user_a.id)
    file_bytes = await storage_service.read_bytes(persisted_report.storage_key)
    data = json.loads(file_bytes.decode("utf-8"))
    assert "report_id" in data
    assert "summary_kpis" in data


@pytest.mark.asyncio
async def test_compensating_cleanup_on_db_failure(
    db_session: AsyncSession,
    storage_service: LocalStorageService,
    test_users,
    seed_detection_data,
):
    """Verifies that if database commit fails, the written storage file is unlinked."""
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    captured_storage_key = None

    async def faulty_create(report):
        nonlocal captured_storage_key
        captured_storage_key = report.storage_key
        raise RuntimeError("Simulated Database Constraint Collision")

    service.repo.create_report = faulty_create

    req = ReportGenerateRequest(
        report_type="recognition_summary",
        format="pdf",
        title="Failing Report",
    )

    with pytest.raises(Exception):
        await service.generate_and_persist_report(current_user=user_a, request=req)

    # Assert compensating action deleted the physical file
    assert captured_storage_key is not None
    assert not await storage_service.exists(captured_storage_key)


# =============================================================================
# 3. SECURITY & IDOR ISOLATION TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_user_report_isolation(
    db_session: AsyncSession,
    storage_service: LocalStorageService,
    test_users,
    seed_detection_data,
):
    """Verifies user A cannot list, download, or delete user B's reports."""
    user_a, user_b = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    # 1. User A creates report
    report_a = await service.generate_and_persist_report(
        current_user=user_a,
        request=ReportGenerateRequest(report_type="recognition_summary", format="json"),
    )

    # 2. User B lists reports -> should be empty
    list_b = await service.list_saved_reports(current_user=user_b)
    assert list_b.total == 0
    assert len(list_b.items) == 0

    # 3. User B attempts to download User A's report -> 404 Not Found
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await service.download_saved_report(report_id=report_a.id, current_user=user_b)
    assert exc_info.value.status_code == 404

    # 4. User B attempts to delete User A's report -> 404 Not Found
    with pytest.raises(HTTPException) as exc_info:
        await service.delete_saved_report(report_id=report_a.id, current_user=user_b)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_cross_user_folder_assignment_rejected(
    db_session: AsyncSession,
    storage_service: LocalStorageService,
    test_users,
    seed_detection_data,
):
    """Verifies that an operator cannot attach a report to another user's folder."""
    user_a, user_b = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    # User B creates a private folder
    folder_b = ReportFolder(user_id=user_b.id, name="User B Confidential Folder")
    db_session.add(folder_b)
    await db_session.commit()
    await db_session.refresh(folder_b)

    # User A attempts to persist report using User B's folder_id
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await service.generate_and_persist_report(
            current_user=user_a,
            request=ReportGenerateRequest(
                report_type="recognition_summary",
                format="pdf",
                folder_id=folder_b.id,
            ),
        )
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_safe_report_deletion_lifecycle(
    db_session: AsyncSession,
    storage_service: LocalStorageService,
    test_users,
    seed_detection_data,
):
    """Verifies transactional report deletion unlinks storage artifact after DB commit."""
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    report = await service.generate_and_persist_report(
        current_user=user_a,
        request=ReportGenerateRequest(report_type="media_breakdown", format="csv"),
    )

    persisted = await service.repo.get_report_by_id(report.id, user_a.id)
    storage_key = persisted.storage_key
    assert await storage_service.exists(storage_key)

    # Delete
    deleted = await service.delete_saved_report(report_id=report.id, current_user=user_a)
    assert deleted is True

    # Assert record is gone from DB
    assert await service.repo.get_report_by_id(report.id, user_a.id) is None
    # Assert physical file unlinked
    assert not await storage_service.exists(storage_key)


# =============================================================================
# 4. API ROUTE & REGRESSION TESTS VIA TESTCLIENT
# =============================================================================

def test_api_saved_reports_workflow(
    temp_storage_root,
):
    """End-to-end API test through FastAPI TestClient testing generate, list, download, and delete."""
    engine = create_async_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    import asyncio
    async def init_models():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    asyncio.run(init_models())

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    storage = LocalStorageService(base_dir=temp_storage_root)

    test_user = User(
        id="usr_api_test_001",
        username="api_operator",
        email="api_operator@visionplate.ai",
        role="operator",
        is_active=True,
    )

    async def seed_user():
        async with session_factory() as sess:
            sess.add(test_user)
            await sess.commit()
    asyncio.run(seed_user())

    async def override_db():
        async with session_factory() as sess:
            yield sess

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_storage_service] = lambda: storage
    app.dependency_overrides[get_current_user] = lambda: test_user

    try:
        with TestClient(app) as client:
            # 1. Generate report
            gen_res = client.post(
                "/api/v1/reports/generate",
                json={
                    "report_type": "recognition_summary",
                    "format": "json",
                    "title": "API Test Report",
                },
            )
            assert gen_res.status_code == 201
            data = gen_res.json()
            report_id = data["id"]
            assert data["title"] == "API Test Report"

            # 2. List saved reports
            list_res = client.get("/api/v1/reports/saved")
            assert list_res.status_code == 200
            list_data = list_res.json()
            assert list_data["total"] >= 1
            assert any(r["id"] == report_id for r in list_data["items"])

            # 3. Download report
            down_res = client.get(f"/api/v1/reports/{report_id}/download")
            assert down_res.status_code == 200
            assert down_res.headers["content-type"] == "application/json"
            assert "attachment; filename=" in down_res.headers["content-disposition"]
            downloaded_json = json.loads(down_res.content.decode("utf-8"))
            assert "report_id" in downloaded_json

            # 4. Delete report
            del_res = client.delete(f"/api/v1/reports/{report_id}")
            assert del_res.status_code == 200
            assert del_res.json()["status"] == "success"

            # 5. Download after delete -> 404
            down_del = client.get(f"/api/v1/reports/{report_id}/download")
            assert down_del.status_code == 404

            # 6. Verify backward compatibility: existing /preview and /export still work
            prev_res = client.post(
                "/api/v1/reports/preview",
                json={"report_type": "recognition_summary"},
            )
            assert prev_res.status_code == 200
            assert "columns" in prev_res.json()

            exp_res = client.post(
                "/api/v1/reports/export",
                json={"report_type": "recognition_summary", "format": "json"},
            )
            assert exp_res.status_code == 200
            assert exp_res.headers["content-type"] == "application/json"
    finally:
        app.dependency_overrides.clear()
        async def drop_models():
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
            await engine.dispose()
        asyncio.run(drop_models())
