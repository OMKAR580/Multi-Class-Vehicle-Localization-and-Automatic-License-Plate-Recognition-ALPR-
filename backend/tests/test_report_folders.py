"""Comprehensive unit and integration tests for Report Folder Management and Report Movement.

Covers all Phase 07E.6 requirements:
- Folder CRUD (Create, List, Get, Update, Delete)
- Per-user case-insensitive uniqueness and conflict handling
- Empty folder retention with report_count=0
- Report movement into folders and Unorganized (NULL)
- Preservation of reports and physical files upon folder deletion
- Multi-tenant isolation and anti-IDOR verification
"""

import asyncio
import os
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
import sys

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import Base, get_db
from app.core.deps import get_current_user
from app.main import app
from app.models.detection import DetectionJob
from app.models.report import Report, ReportFolder
from app.models.user import User
from app.schemas.reports import (
    FolderCreateRequest,
    FolderUpdateRequest,
    ReportFilterParams,
    ReportGenerateRequest,
    ReportMoveRequest,
)
from app.services.reports_service import ReportsService
from app.services.storage_service import LocalStorageService, get_storage_service

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def temp_storage_root():
    tmp_dir = tempfile.mkdtemp(prefix="vp_folder_test_storage_")
    yield Path(tmp_dir)
    shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest_asyncio.fixture
async def db_session():
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
    return LocalStorageService(base_dir=temp_storage_root)


@pytest_asyncio.fixture
async def test_users(db_session: AsyncSession):
    user_a = User(
        id=f"usr_a_{uuid.uuid4().hex[:8]}",
        email="operator_a@visionplate.ai",
        username="operator_a",
        hashed_password="hashed_pw_a",
        full_name="Operator Alpha",
        role="operator",
        is_active=True,
        email_verified=True,
    )
    user_b = User(
        id=f"usr_b_{uuid.uuid4().hex[:8]}",
        email="operator_b@visionplate.ai",
        username="operator_b",
        hashed_password="hashed_pw_b",
        full_name="Operator Beta",
        role="operator",
        is_active=True,
        email_verified=True,
    )
    db_session.add_all([user_a, user_b])
    await db_session.commit()
    return user_a, user_b


# =============================================================================
# 1. CREATE FOLDER TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_create_folder_201(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    req = FolderCreateRequest(name="Traffic Enforcement", description="Q4 Traffic Dockets", color="blue")
    folder = await service.create_folder(current_user=user_a, request=req)

    assert folder.id is not None
    assert folder.name == "Traffic Enforcement"
    assert folder.description == "Q4 Traffic Dockets"
    assert folder.color == "blue"
    assert folder.report_count == 0
    assert folder.user_id == user_a.id


@pytest.mark.asyncio
async def test_create_folder_empty_name_422(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, _ = test_users

    # Empty string validator test
    with pytest.raises(Exception):
        FolderCreateRequest(name="   ", description="Invalid")


@pytest.mark.asyncio
async def test_create_folder_duplicate_name_409(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    req1 = FolderCreateRequest(name="Highway Toll Audit")
    await service.create_folder(current_user=user_a, request=req1)

    # Case-insensitive duplicate name
    req2 = FolderCreateRequest(name="highway toll audit")
    with pytest.raises(Exception) as exc_info:
        await service.create_folder(current_user=user_a, request=req2)
    assert "already exists" in str(exc_info.value.detail).lower()


# =============================================================================
# 2. LIST FOLDERS & EMPTY FOLDER RETENTION
# =============================================================================

@pytest.mark.asyncio
async def test_list_folders_user_isolation(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, user_b = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    await service.create_folder(current_user=user_a, request=FolderCreateRequest(name="Folder Alpha 1"))
    await service.create_folder(current_user=user_a, request=FolderCreateRequest(name="Folder Alpha 2"))
    await service.create_folder(current_user=user_b, request=FolderCreateRequest(name="Folder Beta Private"))

    list_a = await service.list_folders(current_user=user_a)
    list_b = await service.list_folders(current_user=user_b)

    assert list_a.total == 2
    assert all(f.user_id == user_a.id for f in list_a.items)
    names_a = [f.name for f in list_a.items]
    assert "Folder Alpha 1" in names_a and "Folder Alpha 2" in names_a
    assert "Folder Beta Private" not in names_a

    assert list_b.total == 1
    assert list_b.items[0].name == "Folder Beta Private"


@pytest.mark.asyncio
async def test_empty_folder_listing_shows_count_zero(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    folder = await service.create_folder(current_user=user_a, request=FolderCreateRequest(name="Empty Inspection Vault"))

    res = await service.list_folders(current_user=user_a)
    found = next((f for f in res.items if f.id == folder.id), None)
    assert found is not None
    assert found.report_count == 0


# =============================================================================
# 3. GET FOLDER DETAILS
# =============================================================================

@pytest.mark.asyncio
async def test_get_folder_details_with_count(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    folder = await service.create_folder(current_user=user_a, request=FolderCreateRequest(name="Enforcement Dossiers"))

    # Persist report assigned to folder
    gen_req = ReportGenerateRequest(
        report_type="recognition_summary",
        format="json",
        title="Speed Check Report",
        folder_id=folder.id,
    )
    await service.generate_and_persist_report(current_user=user_a, request=gen_req)

    detail = await service.get_folder_detail(folder_id=folder.id, current_user=user_a)
    assert detail.id == folder.id
    assert detail.name == "Enforcement Dossiers"
    assert detail.report_count == 1


# =============================================================================
# 4. RENAME & UPDATE FOLDER
# =============================================================================

@pytest.mark.asyncio
async def test_rename_folder_success(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    folder = await service.create_folder(current_user=user_a, request=FolderCreateRequest(name="Drafts", color="orange"))

    updated = await service.update_folder(
        folder_id=folder.id,
        current_user=user_a,
        request=FolderUpdateRequest(name="Official Archives", color="emerald", description="Finalized"),
    )

    assert updated.id == folder.id
    assert updated.name == "Official Archives"
    assert updated.color == "emerald"
    assert updated.description == "Finalized"


@pytest.mark.asyncio
async def test_rename_folder_duplicate_conflict_409(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    f1 = await service.create_folder(current_user=user_a, request=FolderCreateRequest(name="Audit Alpha"))
    f2 = await service.create_folder(current_user=user_a, request=FolderCreateRequest(name="Audit Beta"))

    # Rename f2 to audit alpha (case-insensitive clash)
    with pytest.raises(Exception) as exc_info:
        await service.update_folder(
            folder_id=f2.id,
            current_user=user_a,
            request=FolderUpdateRequest(name="audit alpha"),
        )
    assert "already exists" in str(exc_info.value.detail).lower()


# =============================================================================
# 5. DELETE FOLDER & PRESERVE REPORTS (UNORGANIZE)
# =============================================================================

@pytest.mark.asyncio
async def test_delete_folder_success(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    folder = await service.create_folder(current_user=user_a, request=FolderCreateRequest(name="Temporary Folder"))
    res = await service.delete_folder(folder_id=folder.id, current_user=user_a)

    assert res["status"] == "success"
    assert res["folder_id"] == folder.id

    # Verify folder is gone
    folders_list = await service.list_folders(current_user=user_a)
    assert folder.id not in [f.id for f in folders_list.items]


@pytest.mark.asyncio
async def test_delete_folder_with_reports_preserves_reports_unorganized(
    db_session: AsyncSession, storage_service: LocalStorageService, test_users
):
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    folder = await service.create_folder(current_user=user_a, request=FolderCreateRequest(name="Vault To Delete"))

    # Generate 2 reports in this folder
    r1 = await service.generate_and_persist_report(
        current_user=user_a,
        request=ReportGenerateRequest(report_type="recognition_summary", format="json", folder_id=folder.id),
    )
    r2 = await service.generate_and_persist_report(
        current_user=user_a,
        request=ReportGenerateRequest(report_type="vehicle_distribution", format="csv", folder_id=folder.id),
    )

    assert r1.folder_id == folder.id
    assert r2.folder_id == folder.id

    # Delete folder
    await service.delete_folder(folder_id=folder.id, current_user=user_a)

    # Verify both reports still exist, storage artifact intact, and folder_id is NULL
    saved_list = await service.list_saved_reports(current_user=user_a, is_uncategorized=True)
    unorganized_ids = [r.id for r in saved_list.items]
    assert r1.id in unorganized_ids
    assert r2.id in unorganized_ids

    # Verify artifacts still exist on disk
    file1_bytes, _, _ = await service.download_saved_report(report_id=r1.id, current_user=user_a)
    assert len(file1_bytes) > 0


# =============================================================================
# 6. REPORT MOVEMENT & UNORGANIZE
# =============================================================================

@pytest.mark.asyncio
async def test_move_report_to_folder_success(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    f_source = await service.create_folder(current_user=user_a, request=FolderCreateRequest(name="Source Folder"))
    f_dest = await service.create_folder(current_user=user_a, request=FolderCreateRequest(name="Destination Folder"))

    report = await service.generate_and_persist_report(
        current_user=user_a,
        request=ReportGenerateRequest(report_type="recognition_summary", format="json", folder_id=f_source.id),
    )
    assert report.folder_id == f_source.id

    # Move report to destination folder
    move_res = await service.move_report(
        report_id=report.id,
        current_user=user_a,
        request=ReportMoveRequest(folder_id=f_dest.id),
    )
    assert move_res.status == "success"
    assert move_res.folder_id == f_dest.id

    # Verify updated counts
    detail_source = await service.get_folder_detail(folder_id=f_source.id, current_user=user_a)
    detail_dest = await service.get_folder_detail(folder_id=f_dest.id, current_user=user_a)
    assert detail_source.report_count == 0
    assert detail_dest.report_count == 1


@pytest.mark.asyncio
async def test_move_report_to_unorganized_null(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    folder = await service.create_folder(current_user=user_a, request=FolderCreateRequest(name="Temp Folder"))
    report = await service.generate_and_persist_report(
        current_user=user_a,
        request=ReportGenerateRequest(report_type="recognition_summary", format="json", folder_id=folder.id),
    )

    # Unorganize report
    move_res = await service.move_report(
        report_id=report.id,
        current_user=user_a,
        request=ReportMoveRequest(folder_id=None),
    )
    assert move_res.status == "success"
    assert move_res.folder_id is None

    detail = await service.get_folder_detail(folder_id=folder.id, current_user=user_a)
    assert detail.report_count == 0


# =============================================================================
# 7. SECURITY & IDOR ISOLATION TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_cross_user_folder_assignment_rejected(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, user_b = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    folder_b = await service.create_folder(current_user=user_b, request=FolderCreateRequest(name="Beta Vault"))

    # User A generates report attempting to use User B's folder
    with pytest.raises(Exception) as exc_info:
        await service.generate_and_persist_report(
            current_user=user_a,
            request=ReportGenerateRequest(report_type="recognition_summary", format="json", folder_id=folder_b.id),
        )
    assert exc_info.value.status_code in (400, 404)


@pytest.mark.asyncio
async def test_cross_user_folder_update_404(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, user_b = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    folder_b = await service.create_folder(current_user=user_b, request=FolderCreateRequest(name="Beta Secret Folder"))

    # User A attempts to rename User B's folder
    with pytest.raises(Exception) as exc_info:
        await service.update_folder(
            folder_id=folder_b.id,
            current_user=user_a,
            request=FolderUpdateRequest(name="Hijacked Name"),
        )
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_cross_user_folder_deletion_404(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, user_b = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    folder_b = await service.create_folder(current_user=user_b, request=FolderCreateRequest(name="Beta Critical Vault"))

    # User A attempts to delete User B's folder
    with pytest.raises(Exception) as exc_info:
        await service.delete_folder(folder_id=folder_b.id, current_user=user_a)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_cross_user_report_movement_404(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, user_b = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    report_b = await service.generate_and_persist_report(
        current_user=user_b,
        request=ReportGenerateRequest(report_type="recognition_summary", format="json"),
    )
    folder_a = await service.create_folder(current_user=user_a, request=FolderCreateRequest(name="Alpha Folder"))

    # User A attempts to move User B's report
    with pytest.raises(Exception) as exc_info:
        await service.move_report(
            report_id=report_b.id,
            current_user=user_a,
            request=ReportMoveRequest(folder_id=folder_a.id),
        )
    assert exc_info.value.status_code == 404


# =============================================================================
# 8. FASTAPI ENDPOINT HTTP INTEGRATION TESTS
# =============================================================================

def test_api_folder_crud_workflow(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    user_a, _ = test_users

    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_storage_service] = lambda: storage_service
    app.dependency_overrides[get_current_user] = lambda: user_a

    try:
        client = TestClient(app)

        # 1. Create Folder
        create_res = client.post(
            "/api/v1/reports/folders",
            json={"name": "Compliance Dockets 2026", "description": "National Highway ALPR", "color": "purple"},
        )
        assert create_res.status_code == 201
        folder_data = create_res.json()
        f_id = folder_data["id"]
        assert folder_data["name"] == "Compliance Dockets 2026"
        assert folder_data["color"] == "purple"
        assert folder_data["report_count"] == 0

        # 2. List Folders
        list_res = client.get("/api/v1/reports/folders")
        assert list_res.status_code == 200
        items = list_res.json()["items"]
        assert any(f["id"] == f_id for f in items)

        # 3. Get Folder Detail
        detail_res = client.get(f"/api/v1/reports/folders/{f_id}")
        assert detail_res.status_code == 200
        assert detail_res.json()["id"] == f_id

        # 4. Update Folder
        patch_res = client.patch(
            f"/api/v1/reports/folders/{f_id}",
            json={"name": "MoRTH Compliance Dockets", "color": "emerald"},
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["name"] == "MoRTH Compliance Dockets"
        assert patch_res.json()["color"] == "emerald"

        # 5. Generate Report into Folder
        gen_res = client.post(
            "/api/v1/reports/generate",
            json={"report_type": "recognition_summary", "format": "json", "folder_id": f_id},
        )
        assert gen_res.status_code == 201
        rep_id = gen_res.json()["id"]

        # Verify folder report count became 1
        detail_res2 = client.get(f"/api/v1/reports/folders/{f_id}")
        assert detail_res2.json()["report_count"] == 1

        # 6. Move Report to Unorganized
        move_res = client.patch(
            f"/api/v1/reports/{rep_id}/folder",
            json={"folder_id": None},
        )
        assert move_res.status_code == 200
        assert move_res.json()["folder_id"] is None

        # Verify folder report count returned to 0
        detail_res3 = client.get(f"/api/v1/reports/folders/{f_id}")
        assert detail_res3.json()["report_count"] == 0

        # 7. Delete Folder
        del_res = client.delete(f"/api/v1/reports/folders/{f_id}")
        assert del_res.status_code == 200

        # 8. Verify Folder Deleted
        detail_del = client.get(f"/api/v1/reports/folders/{f_id}")
        assert detail_del.status_code == 404

    finally:
        app.dependency_overrides.clear()


def test_api_unauthenticated_request_rejected():
    # Calling without auth dependency override
    client = TestClient(app)
    res = client.get("/api/v1/reports/folders")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_database_level_case_insensitive_unique_index(db_session: AsyncSession, test_users):
    """
    Validates that the database-level functional unique index uq_report_folders_user_lower_name
    enforces case-insensitive uniqueness even when inserting directly, bypassing the service layer.
    """
    user_a, _ = test_users
    f1 = ReportFolder(
        user_id=user_a.id,
        name="Security Audit",
        color="orange",
    )
    db_session.add(f1)
    await db_session.commit()

    f2 = ReportFolder(
        user_id=user_a.id,
        name="security audit",  # Exact lower case variant
        color="blue",
    )
    db_session.add(f2)
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_database_allows_same_folder_name_for_different_users(db_session: AsyncSession, test_users):
    """
    Validates that different users can have folders with identical or case-variant names.
    """
    user_a, user_b = test_users
    f_a = ReportFolder(user_id=user_a.id, name="Compliance Records", color="orange")
    f_b = ReportFolder(user_id=user_b.id, name="compliance records", color="emerald")
    db_session.add_all([f_a, f_b])
    await db_session.commit()
    assert f_a.id is not None
    assert f_b.id is not None


@pytest.mark.asyncio
async def test_whitespace_normalization_in_folder_creation(db_session: AsyncSession, storage_service: LocalStorageService, test_users):
    """
    Validates that leading and trailing whitespace is normalized and conflicts are prevented.
    """
    user_a, _ = test_users
    service = ReportsService(db=db_session, storage=storage_service)

    req1 = FolderCreateRequest(name="Toll Plaza Archive")
    folder1 = await service.create_folder(current_user=user_a, request=req1)
    assert folder1.name == "Toll Plaza Archive"

    req2 = FolderCreateRequest(name="  toll plaza archive  ")
    with pytest.raises(Exception) as exc:
        await service.create_folder(current_user=user_a, request=req2)
    assert "already exists" in str(exc.value.detail).lower()


