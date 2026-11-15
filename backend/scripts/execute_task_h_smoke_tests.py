"""
VisionPlate AI — Phase 07E.10
Task H: Isolated Application Smoke Tests against Live Supabase Database
"""

import os
import sys
import uuid
import asyncio
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from fastapi import HTTPException

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.core.database import build_postgres_ssl_context
from app.models.user import User
from app.models.report import Report, ReportFolder
from app.services.reports_service import ReportsService
from app.services.storage_service import LocalStorageService
from app.repositories.dashboard_repository import DashboardRepository
from app.repositories.detection_repository import DetectionRepository
from app.schemas.reports import (
    FolderCreateRequest,
    FolderUpdateRequest,
    ReportGenerateRequest,
    ReportMoveRequest,
)

async def run_smoke_tests():
    print("=== TASK H: ISOLATED APPLICATION SMOKE TESTS ===")
    ca_path = os.path.abspath(os.path.join(backend_dir, "prod-ca-2021.crt"))
    ssl_ctx = build_postgres_ssl_context(ca_cert_path=ca_path, verify=True)
    
    engine = create_async_engine(
        settings.get_database_url(),
        connect_args={
            "ssl": ssl_ctx,
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        },
        echo=False,
    )
    
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    storage = LocalStorageService()
    
    test_uid1 = f"smoke_u1_{uuid.uuid4().hex[:8]}"
    test_uid2 = f"smoke_u2_{uuid.uuid4().hex[:8]}"
    test_email1 = f"{test_uid1}@visionplate.test"
    test_email2 = f"{test_uid2}@visionplate.test"
    
    saved_report_id = None
    created_folder_id = None
    
    async with session_factory() as db:
        try:
            # 1. Setup isolated test users
            print(f"\n[1/14] Creating isolated test users ({test_uid1}, {test_uid2})...")
            u1 = User(id=test_uid1, email=test_email1, username=test_uid1, role="operator", is_active=True)
            u2 = User(id=test_uid2, email=test_email2, username=test_uid2, role="operator", is_active=True)
            db.add_all([u1, u2])
            await db.commit()
            await db.refresh(u1)
            await db.refresh(u2)
            print("  -> Test users successfully created and committed.")
            
            service = ReportsService(db=db, storage=storage)
            
            # 2. Folder Creation
            print("\n[2/14] Testing folder creation...")
            folder_req = FolderCreateRequest(name="Prod Smoke Test Folder", description="Verification folder", color="#3b82f6")
            created_folder = await service.create_folder(u1, folder_req)
            created_folder_id = created_folder.id
            assert created_folder.id is not None
            assert created_folder.name == "Prod Smoke Test Folder"
            print(f"  -> Folder created: {created_folder.id} ('{created_folder.name}')")
            
            # 3. Folder Listing
            print("\n[3/14] Testing folder listing...")
            folder_resp = await service.list_folders(u1)
            assert any(f.id == created_folder.id for f in folder_resp.items)
            print(f"  -> Folders listed: found {folder_resp.total} folders for user.")
            
            # 4. Folder Renaming
            print("\n[4/14] Testing folder renaming...")
            renamed_folder = await service.update_folder(created_folder.id, u1, FolderUpdateRequest(name="Renamed Smoke Folder"))
            assert renamed_folder.name == "Renamed Smoke Folder"
            print(f"  -> Folder renamed to: '{renamed_folder.name}'")
            
            # 5. Case-insensitive duplicate folder rejection
            print("\n[5/14] Testing case-insensitive duplicate folder rejection...")
            dup_rejected = False
            try:
                await service.create_folder(u1, FolderCreateRequest(name="renamed smoke folder"))
            except HTTPException as exc:
                assert exc.status_code == 409
                dup_rejected = True
                print(f"  -> Duplicate folder rejected with HTTP 409: {exc.detail}")
            assert dup_rejected, "Expected 409 Conflict for duplicate folder name"
            
            # 6. Report Generation & Persistence
            print("\n[6/14] Testing persistent report generation...")
            gen_req = ReportGenerateRequest(
                report_type="recognition_summary",
                format="pdf",
                title="Prod Migration Smoke Report",
                folder_id=created_folder.id
            )
            saved_report = await service.generate_and_persist_report(u1, gen_req)
            saved_report_id = saved_report.id
            assert saved_report.id is not None
            assert saved_report.folder_id == created_folder.id
            print(f"  -> Report generated and persisted: {saved_report.id} (format: {saved_report.file_format})")
            
            # 7. Report Download & Storage Artifact Verification
            print("\n[7/14] Testing report download and artifact existence...")
            file_bytes, media_type, filename = await service.download_saved_report(saved_report.id, u1)
            assert media_type == "application/pdf"
            assert len(file_bytes) > 0
            assert file_bytes.startswith(b"%PDF")
            print(f"  -> Download artifact verified: {filename} ({len(file_bytes)} bytes, {media_type})")
            
            # 8. Move Report to Unorganized
            print("\n[8/14] Testing moving report to Unorganized (folder_id=None)...")
            moved_unorg = await service.move_report(saved_report.id, u1, ReportMoveRequest(folder_id=None))
            assert moved_unorg.folder_id is None
            print(f"  -> Report moved to Unorganized: folder_id={moved_unorg.folder_id}")
            
            # 9. Move Report back to Folder
            print("\n[9/14] Testing moving report back to folder...")
            moved_folder = await service.move_report(saved_report.id, u1, ReportMoveRequest(folder_id=created_folder.id))
            assert moved_folder.folder_id == created_folder.id
            print(f"  -> Report moved back to folder: folder_id={moved_folder.folder_id}")
            
            # 10. Folder Deletion with ON DELETE SET NULL
            print("\n[10/14] Testing folder deletion with report preservation in Unorganized...")
            del_msg = await service.delete_folder(created_folder.id, u1)
            created_folder_id = None
            print(f"  -> Folder deleted: {del_msg['message']}")
            rep_after_del = await db.get(Report, saved_report.id)
            assert rep_after_del is not None
            assert rep_after_del.folder_id is None
            print("  -> Verified: Report preserved with folder_id=None (Unorganized).")
            
            # 11. Cross-User Isolation Enforcement
            print("\n[11/14] Testing cross-user tenant isolation...")
            cross_user_blocked = False
            try:
                await service.download_saved_report(saved_report.id, u2)
            except HTTPException as exc:
                assert exc.status_code == 404
                cross_user_blocked = True
                print(f"  -> Cross-user download rejected with HTTP {exc.status_code}: {exc.detail}")
            assert cross_user_blocked
            
            # 12. Existing Detection History Access
            print("\n[12/14] Testing existing detection history accessibility...")
            existing_dets = (await db.execute(text("SELECT id, status, media_type FROM detections;"))).fetchall()
            assert len(existing_dets) == 5
            print(f"  -> Existing detections verified: retrieved {len(existing_dets)} historical jobs.")
            
            # 13. Dashboard & Analytics Queries
            print("\n[13/14] Testing dashboard and analytics queries...")
            dash_repo = DashboardRepository(session=db)
            stats = await dash_repo.get_aggregated_stats(user_id=u1.id)
            print(f"  -> Dashboard stats retrieved successfully: {stats}")
            
            # 14. Report Deletion with Storage Cleanup & Test Teardown
            print("\n[14/14] Testing report deletion and test cleanup...")
            del_rep_res = await service.delete_saved_report(saved_report.id, u1)
            assert del_rep_res is True
            saved_report_id = None
            print("  -> Report record deleted and storage artifact removed.")
            
        finally:
            print("\n[CLEANUP] Executing test teardown...")
            if saved_report_id:
                try:
                    await service.delete_saved_report(saved_report_id, u1)
                except Exception:
                    pass
            if created_folder_id:
                try:
                    await service.delete_folder(created_folder_id, u1)
                except Exception:
                    pass
            # Clean up test users
            await db.execute(text("DELETE FROM users WHERE id IN (:u1, :u2);"), {"u1": test_uid1, "u2": test_uid2})
            # Clean up the test user from previous interrupted attempt if any
            await db.execute(text("DELETE FROM users WHERE email LIKE '%@visionplate.test';"))
            await db.commit()
            print("  -> All temporary smoke test data cleaned up.")
            
    await engine.dispose()
    print("\nALL 14 APPLICATION SMOKE TESTS PASSED (100% SUCCESS).")

if __name__ == "__main__":
    asyncio.run(run_smoke_tests())
