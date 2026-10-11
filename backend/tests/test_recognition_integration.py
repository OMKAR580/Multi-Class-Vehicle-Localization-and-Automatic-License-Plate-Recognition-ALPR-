"""Issue #9 — Recognition Pipeline Integration & End-to-End Reliability Tests.

Comprehensive end-to-end integration tests verifying:
- Authenticated image upload -> ALPR recognition -> database persistence -> detail retrieval
- Authenticated video upload -> frame-based ALPR -> timestamp verification -> dual detail retrieval
- Combined image and video history pagination with deterministic descending sort
- History media-type ('image', 'video') and status ('COMPLETED', 'FAILED') filtering
- Data consistency across database entities, history summaries, and detail responses
- Strict per-user JWT authorization and IDOR boundary enforcement
- Robust error handling for corrupt inputs, non-existent assets, media-type mismatches, and 503s
- Transaction atomicity and rollback on database persistence failure
- Safe status and error message retrieval for failed detection jobs
- Guaranteed cleanup of temporary video files on both success and failure paths
"""

import io
import os
import tempfile
import uuid
from typing import Any, Dict, List, Optional
import cv2
import numpy as np
from PIL import Image
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ai.pipeline.alpr_pipeline import (
    ALPRPipeline,
    BasePlateDetector,
    BasePlateOCR,
    BasePostProcessor,
    BaseVehicleDetector,
)
from ai.video.frame_extractor import VideoFrameExtractor
from app.core.database import Base, get_db
from app.core.exceptions import ModelNotConfiguredException
from app.core.security import create_access_token
from app.main import app
from app.models.detection import DetectionJob, Plate, Vehicle
from app.models.file import FileMetadata
from app.models.user import User
from app.repositories.detection_repository import DetectionRepository
from app.repositories.file_repository import FileRepository
from app.repositories.user_repository import UserRepository
from app.schemas.recognition import ImageRecognitionRequest
from app.services.recognition_service import RecognitionService
from app.services.storage_service import LocalStorageService, get_storage_service

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_session():
    """Async session backed by an isolated in-memory SQLite database."""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )
    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
def test_storage(tmp_path):
    """LocalStorageService pointed to an isolated temporary directory."""
    return LocalStorageService(base_dir=tmp_path)


@pytest.fixture
def client_with_deps(db_session: AsyncSession, test_storage: LocalStorageService):
    """TestClient overriding get_db and get_storage_service dependencies."""
    async def _override_get_db():
        yield db_session

    def _override_get_storage():
        return test_storage

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_storage_service] = _override_get_storage

    with TestClient(app, raise_server_exceptions=False) as client:
        yield client

    app.dependency_overrides.clear()


# ==============================================================================
# Fake AI Adapters for Deterministic Testing
# ==============================================================================


class FakeMultiVehicleDetector(BaseVehicleDetector):
    def __init__(self, detections: Optional[List[Dict[str, Any]]] = None):
        self.detections = detections if detections is not None else [
            {"type": "car", "confidence": 0.94, "bbox": [50, 50, 450, 350]}
        ]

    def detect(self, image: Any) -> List[Dict[str, Any]]:
        return self.detections


class FakePlateDetector(BasePlateDetector):
    def __init__(self, plate_bbox: Any = ...):
        if plate_bbox is ...:
            self.plate_bbox = [100, 200, 300, 250]
        else:
            self.plate_bbox = plate_bbox

    def detect_plate(self, vehicle_crop: Any) -> Optional[List[int]]:
        return self.plate_bbox


class FakeOCR(BasePlateOCR):
    def __init__(self, text: str = "DL01AB1234", conf: float = 0.92):
        self.text = text
        self.conf = conf

    def extract_text(self, plate_crop: Any):
        return (self.text, self.conf)


class FakeCleaner(BasePostProcessor):
    def clean_plate_text(self, raw_text: str) -> str:
        return raw_text.upper().strip()


class MissingWeightsDetector(BaseVehicleDetector):
    def detect(self, image: Any) -> List[Dict[str, Any]]:
        raise ModelNotConfiguredException("Vehicle detection model weights not found on server.")


# Helpers
def create_test_image_bytes(width: int = 500, height: int = 400, color: str = "green") -> bytes:
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def create_test_video_bytes(
    width: int = 320,
    height: int = 240,
    fps: float = 10.0,
    num_frames: int = 10,
) -> bytes:
    fd, path = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)
    try:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(path, fourcc, fps, (width, height))
        for _ in range(num_frames):
            frame = np.zeros((height, width, 3), dtype=np.uint8)
            out.write(frame)
        out.release()

        with open(path, "rb") as f:
            return f.read()
    finally:
        if os.path.exists(path):
            os.unlink(path)


async def seed_user(db_session: AsyncSession, email: str = "e2e_user@vehiclevision.ai") -> tuple[User, str]:
    user_repo = UserRepository(db_session)
    user = User(email=email, full_name="E2E Operator", is_active=True)
    await user_repo.create(user)
    token = create_access_token(subject=user.id)
    return user, token


# ==============================================================================
# 1. End-to-End Image Recognition Flow
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_image_upload_recognition_persistence_and_detail(
    db_session: AsyncSession, client_with_deps: TestClient
):
    """E2E Scenario: Upload image -> Run ALPR recognition -> Retrieve persisted detail."""
    user, token = await seed_user(db_session, "img_e2e@vehiclevision.ai")
    auth_header = {"Authorization": f"Bearer {token}"}

    # Step 1: Upload real image asset
    img_data = create_test_image_bytes(640, 480)
    upload_resp = client_with_deps.post(
        "/api/v1/files/upload",
        headers=auth_header,
        files={"file": ("traffic_sample.jpg", img_data, "image/jpeg")},
    )
    assert upload_resp.status_code == 201
    file_id = upload_resp.json()["id"]

    # Step 2: Run image recognition with fake pipeline
    fake_pipeline = ALPRPipeline(
        vehicle_detector=FakeMultiVehicleDetector([
            {"type": "car", "confidence": 0.95, "bbox": [50, 50, 500, 400]}
        ]),
        plate_detector=FakePlateDetector([100, 200, 300, 260]),
        ocr_engine=FakeOCR("MH12DE1433", 0.96),
        cleaner=FakeCleaner(),
    )

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.recognition_service.ALPRPipeline", lambda: fake_pipeline)
        rec_resp = client_with_deps.post(
            "/api/v1/recognition/images",
            headers=auth_header,
            json={"file_id": file_id},
        )

    assert rec_resp.status_code == 200
    rec_data = rec_resp.json()
    job_id = rec_data["job_id"]
    assert rec_data["status"] == "COMPLETED"
    assert rec_data["file_id"] == file_id
    assert rec_data["image_width"] == 640
    assert rec_data["image_height"] == 480
    assert len(rec_data["vehicles"]) == 1
    assert rec_data["vehicles"][0]["plate"]["text"] == "MH12DE1433"

    # Step 3: Retrieve job detail via history detail endpoint
    detail_resp = client_with_deps.get(
        f"/api/v1/recognition/history/{job_id}",
        headers=auth_header,
    )
    assert detail_resp.status_code == 200
    detail_data = detail_resp.json()
    assert detail_data["job_id"] == job_id
    assert detail_data["status"] == "COMPLETED"
    assert detail_data["image_width"] == 640
    assert detail_data["image_height"] == 480
    assert len(detail_data["vehicles"]) == 1
    assert detail_data["vehicles"][0]["plate"]["text"] == "MH12DE1433"


# ==============================================================================
# 2. End-to-End Video Recognition Flow
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_video_upload_recognition_timestamps_and_dual_retrieval(
    db_session: AsyncSession, client_with_deps: TestClient
):
    """E2E Scenario: Upload video -> Run frame-based ALPR -> Verify timestamps -> Verify /videos/{id} and /history/{id}."""
    user, token = await seed_user(db_session, "vid_e2e@vehiclevision.ai")
    auth_header = {"Authorization": f"Bearer {token}"}

    # Step 1: Upload valid video
    vid_data = create_test_video_bytes(320, 240, fps=10.0, num_frames=15)
    upload_resp = client_with_deps.post(
        "/api/v1/files/upload",
        headers=auth_header,
        files={"file": ("dashcam.mp4", vid_data, "video/mp4")},
    )
    assert upload_resp.status_code == 201
    file_id = upload_resp.json()["id"]

    # Step 2: Run video recognition
    fake_pipeline = ALPRPipeline(
        vehicle_detector=FakeMultiVehicleDetector([
            {"type": "bus", "confidence": 0.89, "bbox": [10, 10, 200, 150]}
        ]),
        plate_detector=FakePlateDetector([20, 50, 100, 80]),
        ocr_engine=FakeOCR("KA04HA1111", 0.91),
        cleaner=FakeCleaner(),
    )

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.recognition_service.ALPRPipeline", lambda: fake_pipeline)
        rec_resp = client_with_deps.post(
            "/api/v1/recognition/videos",
            headers=auth_header,
            json={"file_id": file_id},
        )

    assert rec_resp.status_code == 200
    rec_data = rec_resp.json()
    job_id = rec_data["job_id"]
    assert rec_data["status"] == "COMPLETED"
    assert rec_data["sampled_frames_count"] > 0
    assert len(rec_data["frames"]) > 0

    # Verify frame timestamps are non-negative and monotonic
    timestamps = [f["timestamp_seconds"] for f in rec_data["frames"]]
    assert all(ts >= 0.0 for ts in timestamps)
    assert timestamps == sorted(timestamps)

    # Step 3: Retrieve via GET /api/v1/recognition/videos/{job_id}
    vid_status_resp = client_with_deps.get(
        f"/api/v1/recognition/videos/{job_id}",
        headers=auth_header,
    )
    assert vid_status_resp.status_code == 200
    vid_status_data = vid_status_resp.json()
    assert vid_status_data["job_id"] == job_id
    assert vid_status_data["status"] == "COMPLETED"
    assert len(vid_status_data["frames"]) == len(rec_data["frames"])

    # Step 4: Retrieve via GET /api/v1/recognition/history/{job_id}
    hist_detail_resp = client_with_deps.get(
        f"/api/v1/recognition/history/{job_id}",
        headers=auth_header,
    )
    assert hist_detail_resp.status_code == 200
    hist_detail_data = hist_detail_resp.json()
    assert hist_detail_data["job_id"] == job_id
    assert hist_detail_data["status"] == "COMPLETED"
    assert len(hist_detail_data["frames"]) == len(rec_data["frames"])


# ==============================================================================
# 3. Combined History Pagination & Sorting
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_combined_history_pagination_and_sorting(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """E2E Scenario: User creates multiple image and video jobs; history paginates with newest-first ordering."""
    user, token = await seed_user(db_session, "pagination_user@vehiclevision.ai")
    auth_header = {"Authorization": f"Bearer {token}"}

    file_repo = FileRepository(db_session)
    det_repo = DetectionRepository(db_session)

    # Seed 2 image jobs and 2 video jobs directly
    jobs_created = []
    for i in range(4):
        media_type = "image" if i % 2 == 0 else "video"
        f_meta = FileMetadata(
            id=str(uuid.uuid4()),
            filename=f"asset_{i}.{'jpg' if media_type == 'image' else 'mp4'}",
            file_path=f"2026/10/11/{user.id}/asset_{i}",
            mime_type="image/jpeg" if media_type == "image" else "video/mp4",
            file_size_bytes=1024,
            uploaded_by_user_id=user.id,
        )
        await file_repo.create(f_meta)

        job = DetectionJob(
            user_id=user.id,
            status="COMPLETED",
            media_type=media_type,
            media_url=f_meta.file_path,
            processing_time_ms=15.0 + i,
            raw_result={"job_id": f"job_{i}", "vehicles": []} if media_type == "image" else {"job_id": f"job_{i}", "frames": []},
        )
        await det_repo.create(job)
        jobs_created.append(job)

    # Query page 1 (page_size = 2)
    p1_resp = client_with_deps.get(
        "/api/v1/recognition/history?page=1&page_size=2",
        headers=auth_header,
    )
    assert p1_resp.status_code == 200
    p1_data = p1_resp.json()
    assert p1_data["total"] == 4
    assert p1_data["page"] == 1
    assert p1_data["page_size"] == 2
    assert p1_data["total_pages"] == 2
    assert len(p1_data["items"]) == 2

    # Query page 2 (page_size = 2)
    p2_resp = client_with_deps.get(
        "/api/v1/recognition/history?page=2&page_size=2",
        headers=auth_header,
    )
    assert p2_resp.status_code == 200
    p2_data = p2_resp.json()
    assert p2_data["total"] == 4
    assert p2_data["page"] == 2
    assert len(p2_data["items"]) == 2

    # Verify descending ordering: first item on page 1 was created last
    all_items = p1_data["items"] + p2_data["items"]
    assert len(all_items) == 4
    for idx in range(len(all_items) - 1):
        assert all_items[idx]["created_at"] >= all_items[idx + 1]["created_at"]

    # Verify both media types appear
    media_types_found = {item["media_type"] for item in all_items}
    assert "image" in media_types_found
    assert "video" in media_types_found


# ==============================================================================
# 4. History Media-Type and Status Filtering
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_history_filtering_media_type_and_status(
    db_session: AsyncSession, client_with_deps: TestClient
):
    """E2E Scenario: History filter validation for media_type and status."""
    user, token = await seed_user(db_session, "filter_e2e@vehiclevision.ai")
    auth_header = {"Authorization": f"Bearer {token}"}
    det_repo = DetectionRepository(db_session)

    # Create 1 COMPLETED image job, 1 COMPLETED video job, 1 FAILED image job
    job1 = DetectionJob(
        user_id=user.id,
        status="COMPLETED",
        media_type="image",
        media_url="media/img1.jpg",
        raw_result={"vehicles": []},
    )
    job2 = DetectionJob(
        user_id=user.id,
        status="COMPLETED",
        media_type="video",
        media_url="media/vid1.mp4",
        raw_result={"frames": []},
    )
    job3 = DetectionJob(
        user_id=user.id,
        status="FAILED",
        media_type="image",
        media_url="media/img2.jpg",
        error_message="Corrupted image buffer",
    )
    await det_repo.create(job1)
    await det_repo.create(job2)
    await det_repo.create(job3)

    # Filter media_type=image
    resp_img = client_with_deps.get("/api/v1/recognition/history?media_type=image", headers=auth_header)
    assert resp_img.status_code == 200
    assert resp_img.json()["total"] == 2
    assert all(it["media_type"] == "image" for it in resp_img.json()["items"])

    # Filter media_type=video
    resp_vid = client_with_deps.get("/api/v1/recognition/history?media_type=video", headers=auth_header)
    assert resp_vid.status_code == 200
    assert resp_vid.json()["total"] == 1
    assert resp_vid.json()["items"][0]["media_type"] == "video"

    # Filter status=COMPLETED
    resp_comp = client_with_deps.get("/api/v1/recognition/history?status=COMPLETED", headers=auth_header)
    assert resp_comp.status_code == 200
    assert resp_comp.json()["total"] == 2
    assert all(it["status"] == "COMPLETED" for it in resp_comp.json()["items"])

    # Filter status=FAILED
    resp_failed = client_with_deps.get("/api/v1/recognition/history?status=FAILED", headers=auth_header)
    assert resp_failed.status_code == 200
    assert resp_failed.json()["total"] == 1
    assert resp_failed.json()["items"][0]["status"] == "FAILED"
    assert resp_failed.json()["items"][0]["error_message"] == "Corrupted image buffer"

    # Invalid filters return 400 Bad Request
    resp_bad_type = client_with_deps.get("/api/v1/recognition/history?media_type=pdf", headers=auth_header)
    assert resp_bad_type.status_code == 400
    resp_bad_status = client_with_deps.get("/api/v1/recognition/history?status=UNKNOWN", headers=auth_header)
    assert resp_bad_status.status_code == 400


# ==============================================================================
# 5. Data Consistency: DB Persistence vs. History vs. Detail Responses
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_counts_consistency_between_db_history_and_detail(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """E2E Scenario: Detection counts and vehicle/plate details remain strictly consistent across DB, history, and detail responses."""
    user, token = await seed_user(db_session, "consistency_user@vehiclevision.ai")
    auth_header = {"Authorization": f"Bearer {token}"}

    # Upload test image
    img_data = create_test_image_bytes(500, 400)
    upload_resp = client_with_deps.post(
        "/api/v1/files/upload",
        headers=auth_header,
        files={"file": ("two_cars.jpg", img_data, "image/jpeg")},
    )
    file_id = upload_resp.json()["id"]

    # Mock pipeline returning 2 vehicles: 1 with plate, 1 without plate
    fake_pipeline = ALPRPipeline(
        vehicle_detector=FakeMultiVehicleDetector([
            {"type": "car", "confidence": 0.95, "bbox": [10, 10, 200, 200]},
            {"type": "truck", "confidence": 0.90, "bbox": [210, 10, 400, 200]},
        ]),
        plate_detector=FakePlateDetector([50, 150, 150, 180]),
        ocr_engine=FakeOCR("KA01AB1111", 0.95),
        cleaner=FakeCleaner(),
    )

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.recognition_service.ALPRPipeline", lambda: fake_pipeline)
        rec_resp = client_with_deps.post(
            "/api/v1/recognition/images",
            headers=auth_header,
            json={"file_id": file_id},
        )

    assert rec_resp.status_code == 200
    job_id = rec_resp.json()["job_id"]

    # 1. Check SQL Database counts directly
    v_count_db = (
        await db_session.execute(
            select(func.count()).select_from(Vehicle).where(Vehicle.detection_job_id == job_id)
        )
    ).scalar_one()
    p_count_db = (
        await db_session.execute(
            select(func.count())
            .select_from(Plate)
            .join(Vehicle, Plate.vehicle_id == Vehicle.id)
            .where(Vehicle.detection_job_id == job_id)
        )
    ).scalar_one()

    assert v_count_db == 2
    assert p_count_db == 2  # FakePlateDetector detected a plate for each vehicle

    # 2. Check History summary counts
    hist_resp = client_with_deps.get("/api/v1/recognition/history", headers=auth_header)
    assert hist_resp.status_code == 200
    hist_item = hist_resp.json()["items"][0]
    assert hist_item["job_id"] == job_id
    assert hist_item["vehicle_count"] == v_count_db
    assert hist_item["plate_count"] == p_count_db

    # 3. Check Detail response counts
    detail_resp = client_with_deps.get(f"/api/v1/recognition/history/{job_id}", headers=auth_header)
    assert detail_resp.status_code == 200
    detail_vehicles = detail_resp.json()["vehicles"]
    assert len(detail_vehicles) == v_count_db
    plates_in_detail = sum(1 for v in detail_vehicles if v["plate"] is not None)
    assert plates_in_detail == p_count_db


# ==============================================================================
# 6. Strict Authorization and Cross-User Boundary Enforcement (IDOR)
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_strict_authorization_and_cross_user_isolation(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """E2E Scenario: User A cannot process User B's files, view User B's jobs, or see User B's history."""
    user_a, token_a = await seed_user(db_session, "user_alpha@vehiclevision.ai")
    user_b, token_b = await seed_user(db_session, "user_bravo@vehiclevision.ai")

    header_a = {"Authorization": f"Bearer {token_a}"}
    header_b = {"Authorization": f"Bearer {token_b}"}

    # User B uploads an image and a video
    img_b_resp = client_with_deps.post(
        "/api/v1/files/upload",
        headers=header_b,
        files={"file": ("b_car.jpg", create_test_image_bytes(), "image/jpeg")},
    )
    b_file_id = img_b_resp.json()["id"]

    vid_b_resp = client_with_deps.post(
        "/api/v1/files/upload",
        headers=header_b,
        files={"file": ("b_vid.mp4", create_test_video_bytes(), "video/mp4")},
    )
    b_vid_file_id = vid_b_resp.json()["id"]

    # User B runs image recognition
    fake_pipeline = ALPRPipeline(
        vehicle_detector=FakeMultiVehicleDetector(),
        plate_detector=FakePlateDetector(),
        ocr_engine=FakeOCR(),
        cleaner=FakeCleaner(),
    )
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.recognition_service.ALPRPipeline", lambda: fake_pipeline)
        job_b_resp = client_with_deps.post(
            "/api/v1/recognition/images",
            headers=header_b,
            json={"file_id": b_file_id},
        )
    b_job_id = job_b_resp.json()["job_id"]

    # 1. User A attempts to run recognition on User B's image asset -> 401/403
    cross_img_resp = client_with_deps.post(
        "/api/v1/recognition/images",
        headers=header_a,
        json={"file_id": b_file_id},
    )
    assert cross_img_resp.status_code in (401, 403)
    assert "Access denied" in cross_img_resp.json()["detail"]

    # 2. User A attempts to run recognition on User B's video asset -> 401/403
    cross_vid_resp = client_with_deps.post(
        "/api/v1/recognition/videos",
        headers=header_a,
        json={"file_id": b_vid_file_id},
    )
    assert cross_vid_resp.status_code in (401, 403)
    assert "Access denied" in cross_vid_resp.json()["detail"]

    # 3. User A attempts to view User B's job detail -> 401/403
    cross_detail_resp = client_with_deps.get(
        f"/api/v1/recognition/history/{b_job_id}",
        headers=header_a,
    )
    assert cross_detail_resp.status_code in (401, 403)
    assert "Access denied" in cross_detail_resp.json()["detail"]

    # 4. User A's history shows 0 jobs
    hist_a_resp = client_with_deps.get("/api/v1/recognition/history", headers=header_a)
    assert hist_a_resp.status_code == 200
    assert hist_a_resp.json()["total"] == 0
    assert len(hist_a_resp.json()["items"]) == 0


# ==============================================================================
# 7. Error Handling for Corrupt Inputs, Missing Assets, Mismatched Media, 503s
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_error_handling_and_edge_cases(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """E2E Scenario: Robust handling of missing assets, corrupt inputs, mismatched media, and missing weights."""
    user, token = await seed_user(db_session, "errors_user@vehiclevision.ai")
    auth_header = {"Authorization": f"Bearer {token}"}
    file_repo = FileRepository(db_session)

    # 1. Non-existent file ID -> 404
    resp_404 = client_with_deps.post(
        "/api/v1/recognition/images",
        headers=auth_header,
        json={"file_id": "nonexistent_file_id_999"},
    )
    assert resp_404.status_code == 404

    # 2. Non-existent job ID -> 404
    resp_job_404 = client_with_deps.get(
        "/api/v1/recognition/history/nonexistent_job_id_999",
        headers=auth_header,
    )
    assert resp_job_404.status_code == 404

    # 3. Corrupt image file -> 400
    corrupt_img_meta = FileMetadata(
        id=str(uuid.uuid4()),
        filename="corrupt.jpg",
        file_path="corrupt.jpg",
        mime_type="image/jpeg",
        file_size_bytes=100,
        uploaded_by_user_id=user.id,
    )
    # Store garbage bytes
    temp_path = test_storage.base_dir / "temp_corrupt"
    temp_path.write_bytes(b"NOT_A_VALID_JPEG_HEADER_RANDOM_GARBAGE")
    await test_storage.store(temp_path, "corrupt.jpg")
    await file_repo.create(corrupt_img_meta)

    resp_corrupt = client_with_deps.post(
        "/api/v1/recognition/images",
        headers=auth_header,
        json={"file_id": corrupt_img_meta.id},
    )
    assert resp_corrupt.status_code == 400
    assert "corrupted" in resp_corrupt.json()["detail"].lower()

    # 4. Mismatched media: video file passed to image recognition -> 415
    vid_meta = FileMetadata(
        id=str(uuid.uuid4()),
        filename="test.mp4",
        file_path="test.mp4",
        mime_type="video/mp4",
        file_size_bytes=1000,
        uploaded_by_user_id=user.id,
    )
    await file_repo.create(vid_meta)

    resp_mismatch = client_with_deps.post(
        "/api/v1/recognition/images",
        headers=auth_header,
        json={"file_id": vid_meta.id},
    )
    assert resp_mismatch.status_code == 415

    # 5. Missing AI model weights -> 503
    good_img_meta = FileMetadata(
        id=str(uuid.uuid4()),
        filename="valid.jpg",
        file_path="valid.jpg",
        mime_type="image/jpeg",
        file_size_bytes=len(create_test_image_bytes()),
        uploaded_by_user_id=user.id,
    )
    temp_good = test_storage.base_dir / "temp_good"
    temp_good.write_bytes(create_test_image_bytes())
    await test_storage.store(temp_good, "valid.jpg")
    await file_repo.create(good_img_meta)

    missing_weights_pipeline = ALPRPipeline(
        vehicle_detector=MissingWeightsDetector(),
        plate_detector=FakePlateDetector(),
        ocr_engine=FakeOCR(),
        cleaner=FakeCleaner(),
    )
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.recognition_service.ALPRPipeline", lambda: missing_weights_pipeline)
        resp_503 = client_with_deps.post(
            "/api/v1/recognition/images",
            headers=auth_header,
            json={"file_id": good_img_meta.id},
        )
    assert resp_503.status_code == 503
    assert "weights" in resp_503.json()["detail"].lower()


# ==============================================================================
# 8. Transaction Atomicity and Rollback on Persistence Failure
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_transaction_rollback_on_persistence_failure(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """E2E Scenario: If an error occurs during database persistence, the transaction rolls back cleanly with no zombie records."""
    user, token = await seed_user(db_session, "rollback_user@vehiclevision.ai")
    auth_header = {"Authorization": f"Bearer {token}"}

    # Upload test image
    upload_resp = client_with_deps.post(
        "/api/v1/files/upload",
        headers=auth_header,
        files={"file": ("rollback_car.jpg", create_test_image_bytes(), "image/jpeg")},
    )
    file_id = upload_resp.json()["id"]

    fake_pipeline = ALPRPipeline(
        vehicle_detector=FakeMultiVehicleDetector(),
        plate_detector=FakePlateDetector(),
        ocr_engine=FakeOCR(),
        cleaner=FakeCleaner(),
    )

    # Simulate database failure during vehicle persistence by having flush() raise an exception
    original_add = db_session.add

    def failing_add(instance):
        if isinstance(instance, Vehicle):
            raise RuntimeError("Database constraint or disk write error during vehicle insertion")
        return original_add(instance)

    service = RecognitionService(db=db_session, storage=test_storage, pipeline=fake_pipeline)
    target_user_id = user.id

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(db_session, "add", failing_add)
        with pytest.raises(RuntimeError):
            await service.process_image_recognition(
                request=ImageRecognitionRequest(file_id=file_id),
                current_user=user,
            )

    # Verify that NO DetectionJob record was committed to the database
    jobs_count = (
        await db_session.execute(
            select(func.count()).select_from(DetectionJob).where(DetectionJob.user_id == target_user_id)
        )
    ).scalar_one()
    vehicles_count = (
        await db_session.execute(select(func.count()).select_from(Vehicle))
    ).scalar_one()
    plates_count = (
        await db_session.execute(select(func.count()).select_from(Plate))
    ).scalar_one()

    assert jobs_count == 0
    assert vehicles_count == 0
    assert plates_count == 0


# ==============================================================================
# 9. Failed Job Safe Representation in History and Detail
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_failed_job_safe_history_and_detail_representation(
    db_session: AsyncSession, client_with_deps: TestClient
):
    """E2E Scenario: Detection jobs marked FAILED with error messages retrieve safely without 500 validation errors."""
    user, token = await seed_user(db_session, "failed_job_user@vehiclevision.ai")
    auth_header = {"Authorization": f"Bearer {token}"}
    det_repo = DetectionRepository(db_session)

    # 1. Image job that failed
    failed_img_job = DetectionJob(
        user_id=user.id,
        status="FAILED",
        media_type="image",
        media_url="media/failed_img.jpg",
        processing_time_ms=5.0,
        error_message="Image contains unsupported color profile",
        raw_result=None,
    )
    await det_repo.create(failed_img_job)

    # 2. Video job that failed
    failed_vid_job = DetectionJob(
        user_id=user.id,
        status="FAILED",
        media_type="video",
        media_url="media/failed_vid.mp4",
        processing_time_ms=12.0,
        error_message="Video stream truncated at frame 12",
        raw_result=None,
    )
    await det_repo.create(failed_vid_job)

    # Query history: both jobs retrieve with status FAILED, error_message, and 0 counts
    hist_resp = client_with_deps.get("/api/v1/recognition/history", headers=auth_header)
    assert hist_resp.status_code == 200
    items = hist_resp.json()["items"]
    assert len(items) == 2
    for item in items:
        assert item["status"] == "FAILED"
        assert item["error_message"] is not None
        assert item["vehicle_count"] == 0
        assert item["plate_count"] == 0

    # Query failed image job detail
    img_detail_resp = client_with_deps.get(
        f"/api/v1/recognition/history/{failed_img_job.id}",
        headers=auth_header,
    )
    assert img_detail_resp.status_code == 200
    img_data = img_detail_resp.json()
    assert img_data["job_id"] == failed_img_job.id
    assert img_data["status"] == "FAILED"
    assert img_data["error_message"] == "Image contains unsupported color profile"
    assert img_data["vehicles"] == []

    # Query failed video job status via /videos/{job_id}
    vid_status_resp = client_with_deps.get(
        f"/api/v1/recognition/videos/{failed_vid_job.id}",
        headers=auth_header,
    )
    assert vid_status_resp.status_code == 200
    vid_data = vid_status_resp.json()
    assert vid_data["job_id"] == failed_vid_job.id
    assert vid_data["status"] == "FAILED"
    assert vid_data["error_message"] == "Video stream truncated at frame 12"
    assert vid_data["frames"] == []


# ==============================================================================
# 10. Temporary Video File Cleanup on Success and Failure
# ==============================================================================


def test_e2e_video_extractor_temp_file_cleanup_on_success_and_failure():
    """E2E Scenario: VideoFrameExtractor creates isolated temp files and always unlinks them on both success and failure."""
    extractor = VideoFrameExtractor()
    temp_dir = tempfile.gettempdir()

    # Success scenario
    valid_vid = create_test_video_bytes(num_frames=5)
    files_before = set(os.listdir(temp_dir))
    fps, total_frames, w, h, duration, frames = extractor.extract_frames(valid_vid, "test_file_success")
    files_after = set(os.listdir(temp_dir))

    assert len(frames) > 0
    # No new leftover .mp4 files in temp directory
    new_mp4s = [f for f in files_after - files_before if f.endswith(".mp4")]
    assert len(new_mp4s) == 0

    # Failure scenario (corrupt video bytes)
    corrupt_vid = b"NOT_A_VALID_MP4_HEADER_GARBAGE_BYTES"
    files_before_err = set(os.listdir(temp_dir))
    with pytest.raises(Exception):
        extractor.extract_frames(corrupt_vid, "test_file_fail")
    files_after_err = set(os.listdir(temp_dir))

    new_mp4s_err = [f for f in files_after_err - files_before_err if f.endswith(".mp4")]
    assert len(new_mp4s_err) == 0
