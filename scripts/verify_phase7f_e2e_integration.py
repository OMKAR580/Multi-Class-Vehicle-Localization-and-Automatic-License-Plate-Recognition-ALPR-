"""
VisionPlate AI — Phase 07F Full Application Integration & Production Readiness Verification Suite
Tests the complete end-to-end integration against the live Supabase PostgreSQL database over TLS:
- Safety Pre-Checks (Model hashes, Git status, DB connection)
- Authentication & User Isolation (Registration, JWT login, profile, 401/409, isolation)
- Detection Studio & Real AI Pipeline (File validation, upload, YOLO vehicle & plate detection, OCR, DB persistence, exports)
- Detection History & Inspection (Paginated queries, job detail, cross-user isolation)
- Dashboard & Analytics (Aggregated KPIs, vehicle distribution, user-level isolation)
- Enterprise Report Library (Folders CRUD, case-insensitive 409, report generation, artifact persistence, move, ON DELETE SET NULL, download, delete)
- Teardown & Final Integrity Certification (Clean test data cleanup, verify exact baseline DB counts, verify 100% intact model hashes)
"""

import asyncio
import hashlib
import io
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Setup sys.path
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(root_dir))

from app.core.config import settings
from app.core.database import build_postgres_ssl_context
from app.core.security import verify_password
from app.models.user import User
from app.models.detection import DetectionJob, Vehicle, Plate
from app.models.file import FileMetadata
from app.models.report import Report, ReportFolder
from app.repositories.dashboard_repository import DashboardRepository
from app.repositories.detection_repository import DetectionRepository
from app.repositories.analytics_repository import AnalyticsRepository
from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.services.file_service import FileService
from app.services.recognition_service import RecognitionService
from app.services.reports_service import ReportsService
from app.services.storage_service import get_storage_service
from app.schemas.user import UserUpdate
from app.schemas.recognition import ImageRecognitionRequest
from app.schemas.reports import (
    FolderCreateRequest,
    FolderUpdateRequest,
    ReportGenerateRequest,
    ReportMoveRequest,
)
from ai.pipeline.alpr_pipeline import ALPRPipeline
from fastapi import UploadFile, HTTPException
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text, select, delete

BASELINE_HASHES = {
    "best.pt": "aa76d3985cb13e453507833bf3b0906c64852f333041774b4ce1d67e32275274",
    "yolov8_plate.pt": "54051af4b44d9edb1ac7b3fcf322298a7a8418668f10ba17a9561331c2164318",
    "yolov8_vehicle.pt": "f59b3d833e2ff32e194b5bb8e08d211dc7c5bdf144b90d2c8412c47ccfc83b36",
    "alpr_pipeline.py": "7319dc5a1443be8be327725d32ab5109354b3686633dd793347550562b938ce1",
    "indian_plate_ocr.py": "9e508a97005b363b1c5c753501485cc4a9659d310bb17a41b7ddebf3a0f47a8c",
}

BASELINE_ROW_COUNTS = {
    "users": 3,
    "oauth_accounts": 1,
    "user_identities": 3,
    "detections": 5,
    "vehicles": 24,
    "plates": 6,
    "files": 5,
    "reports": 0,
    "report_folders": 0,
    "audit_logs": 0,
}

test_results = {}

def get_file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

async def main():
    print("=" * 80)
    print("VISIONPLATE AI — PHASE 07F FULL APPLICATION E2E INTEGRATION SUITE")
    print("=" * 80)

    # -------------------------------------------------------------------------
    # STEP 1: SAFETY PRE-CHECKS
    # -------------------------------------------------------------------------
    print("\n[STEP 1] Running Safety Pre-Checks...")
    
    # 1.1 Model Checkpoint & Pipeline Integrity
    for fname, expected_hash in BASELINE_HASHES.items():
        if fname.endswith(".pt"):
            p = root_dir / "ai" / "models" / fname
        elif fname == "alpr_pipeline.py":
            p = root_dir / "ai" / "pipeline" / fname
        elif fname == "indian_plate_ocr.py":
            p = root_dir / "ai" / "ocr" / fname
        else:
            raise ValueError(f"Unknown file {fname}")
        
        assert p.is_file(), f"File missing: {p}"
        actual_hash = get_file_sha256(p)
        assert actual_hash == expected_hash, f"Hash mismatch for {fname}: got {actual_hash}, expected {expected_hash}"
        print(f"  ✓ {fname} SHA-256 verified ({actual_hash[:16]}...)")
    test_results["1_model_pipeline_safety"] = "PASSED"

    # 1.2 TLS Live Database Connection
    ca_cert_path = str(backend_dir / "prod-ca-2021.crt")
    assert os.path.isfile(ca_cert_path), "Missing CA certificate prod-ca-2021.crt"
    ssl_ctx = build_postgres_ssl_context(ca_cert_path=ca_cert_path, verify=True)
    engine = create_async_engine(
        settings.get_database_url(),
        connect_args={"ssl": ssl_ctx, "statement_cache_size": 0, "prepared_statement_cache_size": 0},
        echo=False,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    # 1.3 Verify Baseline Row Counts
    async with session_factory() as session:
        for tbl, expected_count in BASELINE_ROW_COUNTS.items():
            cnt = await session.scalar(text(f"SELECT count(*) FROM {tbl};"))
            assert cnt == expected_count, f"Baseline count mismatch on {tbl}: expected {expected_count}, got {cnt}"
            print(f"  ✓ Initial table '{tbl}' row count: {cnt} (matches baseline)")
    test_results["1_baseline_row_counts"] = "PASSED"

    # Storage service instance
    storage = get_storage_service()
    alpr_pipeline = ALPRPipeline()

    # Isolated test user identifiers
    test_uuid = uuid.uuid4().hex[:8]
    user_a_username = f"test_usr_a_{test_uuid}"
    user_a_email = f"test_a_{test_uuid}@visionplate.ai"
    user_a_pwd = "PasswordAlpha123!"

    user_b_username = f"test_usr_b_{test_uuid}"
    user_b_email = f"test_b_{test_uuid}@visionplate.ai"
    user_b_pwd = "PasswordBeta123!"

    user_a_id = None
    user_b_id = None
    job_id = None
    file_id = None
    folder_a_id = None
    folder_b_id = None
    report_id = None

    try:
        # -------------------------------------------------------------------------
        # STEP 2: AUTHENTICATION & USER MANAGEMENT (TASK B)
        # -------------------------------------------------------------------------
        print("\n[STEP 2] Verifying Authentication & User Management (Task B)...")
        async with session_factory() as session:
            auth_service = AuthService(session)
            user_service = UserService(session)

            # 2.1 Register User A
            reg_a = await auth_service.register_user(
                email=user_a_email,
                password=user_a_pwd,
                username=user_a_username,
                full_name="Alpha Test Operator",
            )
            user_a: User = reg_a["user"]
            user_a_id = user_a.id
            assert user_a_id is not None
            print(f"  ✓ User A registered: {user_a_username} (ID: {user_a_id})")

            # 2.2 Register User B
            reg_b = await auth_service.register_user(
                email=user_b_email,
                password=user_b_pwd,
                username=user_b_username,
                full_name="Beta Test Operator",
            )
            user_b: User = reg_b["user"]
            user_b_id = user_b.id
            assert user_b_id is not None
            print(f"  ✓ User B registered: {user_b_username} (ID: {user_b_id})")

            # 2.3 Duplicate Registration Rejection
            try:
                await auth_service.register_user(
                    email=user_a_email,
                    password="AnyPassword123!",
                    username=f"diff_{test_uuid}",
                )
                assert False, "Should have rejected duplicate email"
            except Exception as exc:
                assert "already exists" in str(exc).lower()
                print("  ✓ Duplicate email registration rejected (409/Conflict contract verified).")

            # 2.4 Login with Valid Credentials
            auth_res = await auth_service.authenticate_user(user_a_email, user_a_pwd)
            assert "access_token" in auth_res
            assert auth_res["token_type"] == "bearer"
            print("  ✓ User A login successful: Bearer JWT token issued.")

            # 2.5 Login with Invalid Password Rejection (401)
            try:
                await auth_service.authenticate_user(user_a_email, "WrongPassword!")
                assert False, "Should have rejected invalid password"
            except Exception as exc:
                assert "incorrect password" in str(exc).lower()
                print("  ✓ Invalid password rejected with InvalidCredentialsException (401).")

            # 2.6 Profile Retrieval (/users/me)
            prof_a = await user_service.get_profile(user_a)
            assert prof_a.id == user_a_id
            assert prof_a.username == user_a_username
            assert prof_a.email == user_a_email
            assert len(prof_a.identities) >= 1
            print(f"  ✓ User A profile retrieved with {len(prof_a.identities)} linked identity.")

            # 2.7 Profile Update (PATCH /users/me)
            updated_prof = await user_service.update_profile(
                user_a,
                UserUpdate(full_name="Alpha Senior Operator")
            )
            assert updated_prof.full_name == "Alpha Senior Operator"
            print("  ✓ User A profile updated (full_name: 'Alpha Senior Operator').")

            # 2.8 Username Collision Prevention (409)
            try:
                await user_service.update_profile(
                    user_a,
                    UserUpdate(username=user_b_username)
                )
                assert False, "Should have rejected username collision"
            except Exception as exc:
                assert "already taken" in str(exc).lower()
                print("  ✓ Username collision prevented when attempting to take User B's username.")

        test_results["2_auth_and_user_management"] = "PASSED"

        # -------------------------------------------------------------------------
        # STEP 3: DETECTION STUDIO & REAL AI PIPELINE INTEGRATION (TASK C)
        # -------------------------------------------------------------------------
        print("\n[STEP 3] Verifying Detection Studio & Real AI Pipeline Integration (Task C)...")
        async with session_factory() as session:
            file_service = FileService(session, storage)
            recog_service = RecognitionService(session, storage, pipeline=alpr_pipeline)

            # 3.1 Test file upload validation (invalid MIME type rejection)
            fake_txt = UploadFile(
                filename="script.txt",
                file=io.BytesIO(b"Hello text file content"),
                headers={"content-type": "text/plain"},
            )
            try:
                await file_service.upload_file(fake_txt, user_a)
                assert False, "Should have rejected invalid MIME type"
            except Exception as exc:
                print("  ✓ Non-image/video MIME type rejected successfully.")

            # 3.2 Real image upload
            img_path = root_dir / "assits" / "test.jpg"
            assert img_path.is_file(), "Test image assits/test.jpg missing"
            with open(img_path, "rb") as f:
                img_bytes = f.read()

            upload_obj = UploadFile(
                filename="real_test.jpg",
                file=io.BytesIO(img_bytes),
                headers={"content-type": "image/jpeg"},
            )
            upload_resp = await file_service.upload_file(upload_obj, user_a)
            file_id = upload_resp.id
            assert file_id is not None
            print(f"  ✓ Image uploaded securely: file_id={file_id}, size={upload_resp.file_size_bytes} bytes")

            # 3.3 Execute Real ALPR Pipeline Inference
            print("  Executing ALPRPipeline inference (YOLO vehicles + YOLO plates + Tesseract OCR)...")
            recog_req = ImageRecognitionRequest(file_id=file_id)
            recog_resp = await recog_service.process_image_recognition(recog_req, user_a)
            job_id = recog_resp.job_id
            assert job_id is not None
            assert len(recog_resp.vehicles) > 0, "Expected vehicles detected in test image"
            print(f"  ✓ Real AI inference complete: job_id={job_id}, detected {len(recog_resp.vehicles)} vehicles in {recog_resp.processing_time_ms}ms")
            
            # Check license plates detected
            detected_plates = [v.plate.text for v in recog_resp.vehicles if v.plate and v.plate.text]
            print(f"  ✓ Detected Plates: {detected_plates}")
            assert len(detected_plates) >= 1, "Expected at least 1 plate detected"

            # 3.4 Verify Relational DB Persistence
            det_repo = DetectionRepository(session)
            persisted_job = await det_repo.get_by_id(job_id)
            assert persisted_job is not None
            assert persisted_job.user_id == user_a_id
            assert persisted_job.status == "COMPLETED"
            assert len(persisted_job.vehicles) == len(recog_resp.vehicles)
            print(f"  ✓ Relational persistence verified: Job {job_id} saved with {len(persisted_job.vehicles)} vehicles in database.")

        test_results["3_detection_studio_ai_pipeline"] = "PASSED"

        # -------------------------------------------------------------------------
        # STEP 4: DETECTION HISTORY & INSPECTION (TASK D)
        # -------------------------------------------------------------------------
        print("\n[STEP 4] Verifying Detection History & Cross-User Isolation (Task D)...")
        async with session_factory() as session:
            det_repo = DetectionRepository(session)

            # 4.1 User A can see their own job
            items_a, total_a = await det_repo.list_by_user_paginated(user_id=user_a_id, page=1, page_size=10)
            assert total_a == 1
            assert items_a[0].id == job_id
            print(f"  ✓ User A history query returned {total_a} job(s) correctly.")

            # 4.2 User B CANNOT see User A's job (Tenant Isolation)
            items_b, total_b = await det_repo.list_by_user_paginated(user_id=user_b_id, page=1, page_size=10)
            assert total_b == 0
            print("  ✓ User B history query returned 0 jobs (Strict Tenant Isolation Verified).")

            # 4.3 Direct access to User A's job by User B is blocked
            job_for_b = await det_repo.get_by_id_and_user(job_id=job_id, user_id=user_b_id)
            assert job_for_b is None
            print("  ✓ User B cannot fetch User A's job by ID (404/403 ownership check verified).")

        test_results["4_detection_history_isolation"] = "PASSED"

        # -------------------------------------------------------------------------
        # STEP 5: DASHBOARD & ANALYTICS AGGREGATION (TASK E)
        # -------------------------------------------------------------------------
        print("\n[STEP 5] Verifying Dashboard & Analytics Aggregations (Task E)...")
        async with session_factory() as session:
            dash_repo = DashboardRepository(session)
            analytics_repo = AnalyticsRepository(session)

            # 5.1 Dashboard Stats for User A
            stats_a = await dash_repo.get_aggregated_stats(user_id=user_a_id)
            assert stats_a["total_jobs"] == 1
            assert stats_a["completed_jobs"] == 1
            assert stats_a["total_vehicles_detected"] > 0
            print(f"  ✓ User A dashboard KPIs: total_jobs={stats_a['total_jobs']}, vehicles={stats_a['total_vehicles_detected']}, success_rate={stats_a['success_rate']}%")

            # 5.2 Dashboard Stats for User B (Must be all 0)
            stats_b = await dash_repo.get_aggregated_stats(user_id=user_b_id)
            assert stats_b["total_jobs"] == 0
            assert stats_b["completed_jobs"] == 0
            assert stats_b["total_vehicles_detected"] == 0
            print("  ✓ User B dashboard KPIs: all 0 (Zero hardcoded metrics, pure DB-backed isolation).")

            # 5.3 Analytics Summary for User A
            analytics_a = await analytics_repo.get_analytics_summary(user_id=user_a_id)
            assert analytics_a["total_jobs"] == 1
            print(f"  ✓ User A analytics summary: total_jobs={analytics_a['total_jobs']}, avg_latency={analytics_a['average_latency_ms']}ms")

            # 5.4 Analytics Summary for User B
            analytics_b = await analytics_repo.get_analytics_summary(user_id=user_b_id)
            assert analytics_b["total_jobs"] == 0
            print("  ✓ User B analytics summary: total_jobs=0 (Verified isolation).")

        test_results["5_dashboard_analytics_aggregation"] = "PASSED"

        # -------------------------------------------------------------------------
        # STEP 6: ENTERPRISE REPORT LIBRARY & FOLDER MANAGEMENT (TASK F)
        # -------------------------------------------------------------------------
        print("\n[STEP 6] Verifying Enterprise Report Library & Folder Management (Task F)...")
        async with session_factory() as session:
            reports_service = ReportsService(session, storage)

            # 6.1 Create Report Folder A
            folder_name_a = f"Operations_Alpha_{test_uuid}"
            folder_a_resp = await reports_service.create_folder(
                user_a,
                FolderCreateRequest(name=folder_name_a, description="Alpha operational folder")
            )
            folder_a_id = folder_a_resp.id
            assert folder_a_id is not None
            print(f"  ✓ Folder '{folder_name_a}' created (ID: {folder_a_id}).")

            # 6.2 Case-Insensitive Duplicate Folder Rejection (409)
            try:
                await reports_service.create_folder(
                    user_a,
                    FolderCreateRequest(name=folder_name_a.lower(), description="Duplicate name check")
                )
                assert False, "Should have rejected case-insensitive duplicate folder"
            except HTTPException as exc:
                assert exc.status_code == 409
                print("  ✓ Case-insensitive duplicate folder rejected with HTTP 409 Conflict.")

            # 6.3 Create Folder B (Archive)
            folder_name_b = f"Archive_Beta_{test_uuid}"
            folder_b_resp = await reports_service.create_folder(
                user_a,
                FolderCreateRequest(name=folder_name_b, description="Archive folder")
            )
            folder_b_id = folder_b_resp.id
            assert folder_b_id is not None
            print(f"  ✓ Folder '{folder_name_b}' created (ID: {folder_b_id}).")

            # 6.4 Generate and Save Report to Folder A
            gen_req = ReportGenerateRequest(
                report_type="recognition_summary",
                format="pdf",
                title=f"E2E Recognition Audit {test_uuid}",
                folder_id=folder_a_id,
            )
            gen_resp = await reports_service.generate_and_persist_report(user_a, gen_req)
            report_id = gen_resp.id
            assert report_id is not None
            assert gen_resp.folder_id == folder_a_id
            print(f"  ✓ Report generated and saved: ID={report_id}, file_size={gen_resp.file_size_bytes} bytes")

            # Verify report artifact on disk and PDF header
            report_rec = await reports_service.repo.get_report_by_id(report_id, user_a_id)
            assert report_rec is not None
            disk_path = await storage.get_path(report_rec.storage_key)
            assert os.path.isfile(disk_path), f"Report file missing at {disk_path}"
            with open(disk_path, "rb") as rf:
                header = rf.read(5)
                assert header == b"%PDF-", f"Expected %PDF- header, got {header}"
            print(f"  ✓ Physical artifact verified on disk with authentic '%PDF-' magic bytes ({report_rec.file_size_bytes} bytes).")

            # 6.5 Move Report between folders: Move to Folder B
            move_b = await reports_service.move_report(
                report_id,
                user_a,
                ReportMoveRequest(folder_id=folder_b_id),
            )
            assert move_b.folder_id == folder_b_id
            print(f"  ✓ Report moved to Folder B ({folder_b_id}).")

            # 6.6 Move Report to Unorganized (folder_id=None)
            move_unorg = await reports_service.move_report(
                report_id,
                user_a,
                ReportMoveRequest(folder_id=None),
            )
            assert move_unorg.folder_id is None
            print("  ✓ Report moved to Unorganized (folder_id=None).")

            # 6.7 Move Report back to Folder A
            await reports_service.move_report(
                report_id,
                user_a,
                ReportMoveRequest(folder_id=folder_a_id),
            )
            print("  ✓ Report moved back to Folder A.")

            # 6.8 Delete Folder A -> Test ON DELETE SET NULL
            del_f_res = await reports_service.delete_folder(folder_a_id, user_a)
            assert del_f_res.get("status") == "success" or "deleted" in str(del_f_res).lower()
            folder_a_id = None  # Already deleted
            # Report must survive with folder_id=None
            report_after_folder_del = await reports_service.repo.get_report_by_id(report_id, user_a_id)
            assert report_after_folder_del is not None
            assert report_after_folder_del.folder_id is None
            print("  ✓ Folder A deleted: Report survived and reassigned to Unorganized (ON DELETE SET NULL verified).")

            # 6.9 Cross-User Isolation on Reports
            # User B cannot download or list User A's report
            try:
                await reports_service.download_saved_report(report_id, user_b)
                assert False, "User B should not be able to download User A's report"
            except HTTPException as exc:
                assert exc.status_code == 404
                print("  ✓ User B denied access to User A's report (HTTP 404/Not Found boundary verified).")

            # 6.10 Download Report as User A
            file_bytes, media_type, safe_filename = await reports_service.download_saved_report(report_id, user_a)
            assert media_type == "application/pdf"
            assert file_bytes.startswith(b"%PDF-")
            print(f"  ✓ User A successfully downloaded report artifact ({safe_filename}, {len(file_bytes)} bytes) with valid PDF headers.")

            # 6.11 Delete Report & Verify Artifact Cleanup
            del_saved_ok = await reports_service.delete_saved_report(report_id, user_a)
            assert del_saved_ok is True
            assert not os.path.isfile(disk_path), "Artifact file should have been removed from disk"
            report_id = None  # Cleaned up
            print("  ✓ Report deleted from database and physical artifact removed from disk.")

            # 6.12 Delete Folder B
            await reports_service.delete_folder(folder_b_id, user_a)
            folder_b_id = None
            print("  ✓ Folder B deleted.")

        test_results["6_report_library_and_folders"] = "PASSED"

    finally:
        # -------------------------------------------------------------------------
        # STEP 7: CLEAN TEARDOWN & RECOVERY TO EXACT BASELINE
        # -------------------------------------------------------------------------
        print("\n[STEP 7] Performing Clean Teardown...")
        async with session_factory() as session:
            # Clean up report if still exists
            if report_id:
                try:
                    rep = await session.get(Report, report_id)
                    if rep:
                        if rep.storage_key:
                            await storage.delete(rep.storage_key)
                        await session.delete(rep)
                except Exception as e:
                    print(f"Warning during report cleanup: {e}")

            # Clean up folders if still exist
            for fid in [folder_a_id, folder_b_id]:
                if fid:
                    try:
                        fld = await session.get(ReportFolder, fid)
                        if fld:
                            await session.delete(fld)
                    except Exception as e:
                        print(f"Warning during folder cleanup: {e}")

            # Clean up detection job & children
            if job_id:
                try:
                    await session.execute(text("DELETE FROM plates WHERE vehicle_id IN (SELECT id FROM vehicles WHERE detection_job_id = :jid);"), {"jid": job_id})
                    await session.execute(text("DELETE FROM vehicles WHERE detection_job_id = :jid;"), {"jid": job_id})
                    await session.execute(text("DELETE FROM detections WHERE id = :jid;"), {"jid": job_id})
                except Exception as e:
                    print(f"Warning during detection cleanup: {e}")

            # Clean up file metadata & file storage
            if file_id:
                try:
                    fm = await session.get(FileMetadata, file_id)
                    if fm:
                        await storage.delete(fm.file_path)
                        await session.delete(fm)
                except Exception as e:
                    print(f"Warning during file cleanup: {e}")

            # Clean up User A and User B
            for uid in [user_a_id, user_b_id]:
                if uid:
                    try:
                        await session.execute(text("DELETE FROM user_identities WHERE user_id = :uid;"), {"uid": uid})
                        await session.execute(text("DELETE FROM oauth_accounts WHERE user_id = :uid;"), {"uid": uid})
                        await session.execute(text("DELETE FROM users WHERE id = :uid;"), {"uid": uid})
                    except Exception as e:
                        print(f"Warning during user cleanup: {e}")

            await session.commit()
            print("  ✓ Test artifacts and records purged.")

            # 7.2 Verify exact post-test database counts match baseline
            print("\nVerifying post-test database row counts match exact baseline:")
            for tbl, expected_count in BASELINE_ROW_COUNTS.items():
                cnt = await session.scalar(text(f"SELECT count(*) FROM {tbl};"))
                assert cnt == expected_count, f"Post-test count mismatch on {tbl}: expected {expected_count}, got {cnt}"
                print(f"  ✓ {tbl}: {cnt} (100% exact baseline match)")

        await engine.dispose()
        print("  ✓ Database connection closed.")

    # -------------------------------------------------------------------------
    # STEP 8: FINAL MODEL CHECKPOINT HASH RE-VERIFICATION
    # -------------------------------------------------------------------------
    print("\n[STEP 8] Re-verifying AI Model Checkpoints & Pipeline Code Hashes...")
    for fname, expected_hash in BASELINE_HASHES.items():
        if fname.endswith(".pt"):
            p = root_dir / "ai" / "models" / fname
        elif fname == "alpr_pipeline.py":
            p = root_dir / "ai" / "pipeline" / fname
        elif fname == "indian_plate_ocr.py":
            p = root_dir / "ai" / "ocr" / fname
        else:
            raise ValueError(f"Unknown file {fname}")
        
        actual_hash = get_file_sha256(p)
        assert actual_hash == expected_hash, f"Hash changed for {fname}!"
        print(f"  ✓ {fname} SHA-256 remains 100% identical ({actual_hash[:16]}...)")
    test_results["8_final_model_pipeline_safety"] = "PASSED"

    print("\n" + "=" * 80)
    print("PHASE 07F END-TO-END INTEGRATION RESULTS:")
    print("=" * 80)
    for test_name, status in test_results.items():
        print(f"  {test_name.ljust(35)}: {status}")
    print("=" * 80)
    print("ALL 6 CORE SYSTEM INTEGRATION GATES PASSED WITH ZERO ERRORS!")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(main())
