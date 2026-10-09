"""Unit and integration tests for Issue #6 — Vehicle Detection and ALPR Recognition API."""

import io
import uuid
from typing import Any, Dict, List, Optional
import pytest
import pytest_asyncio
from PIL import Image
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ai.pipeline.alpr_pipeline import ALPRPipeline
from ai.pipeline.base import (
    BasePlateDetector,
    BasePlateOCR,
    BasePostProcessor,
    BaseVehicleDetector,
)
from app.core.config import settings
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
from app.services.recognition_service import RecognitionService
from app.services.storage_service import LocalStorageService, get_storage_service

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_session():
    """Async session backed by an in-memory SQLite database."""
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
    """LocalStorageService pointed to a temporary directory."""
    return LocalStorageService(base_dir=tmp_path)


@pytest.fixture
def client_with_deps(db_session: AsyncSession, test_storage: LocalStorageService):
    """TestClient that overrides get_db and get_storage_service dependencies."""

    async def _override_get_db():
        yield db_session

    def _override_get_storage():
        return test_storage

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_storage_service] = _override_get_storage

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


# ==============================================================================
# Fake AI Adapters for Deterministic Testing
# ==============================================================================


class FakeVehicleDetector(BaseVehicleDetector):
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
    def __init__(self, text: str = "RJ14AB1234", conf: float = 0.92):
        self.text = text
        self.conf = conf

    def extract_text(self, plate_crop: Any):
        return (self.text, self.conf)


class FakeCleaner(BasePostProcessor):
    def clean_plate_text(self, raw_text: str) -> str:
        return raw_text.upper().strip()


class MissingWeightsDetector(BaseVehicleDetector):
    def detect(self, image: Any) -> List[Dict[str, Any]]:
        raise ModelNotConfiguredException("Vehicle detection model weights not found.")


# Helper to generate test JPEG image bytes
def create_test_image_bytes(width: int = 500, height: int = 400, color: str = "blue") -> bytes:
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# Helper to seed user + file metadata + storage asset
async def seed_user_and_file(
    db_session: AsyncSession,
    storage: LocalStorageService,
    email: str = "operator@vehiclevision.ai",
    filename: str = "car_sample.jpg",
    mime_type: str = "image/jpeg",
    img_bytes: Optional[bytes] = None,
) -> tuple[User, FileMetadata]:
    user_repo = UserRepository(db_session)
    user = User(email=email, full_name="ALPR Operator", is_active=True)
    await user_repo.create(user)

    if img_bytes is None:
        img_bytes = create_test_image_bytes()

    file_repo = FileRepository(db_session)
    storage_key = storage.generate_storage_key(".jpg" if mime_type == "image/jpeg" else ".mp4")

    # Save to storage
    temp_path = storage.base_dir / f"temp_{uuid.uuid4().hex}"
    temp_path.write_bytes(img_bytes)
    await storage.store(temp_path, storage_key)

    file_meta = FileMetadata(
        id=str(uuid.uuid4()),
        filename=filename,
        file_path=storage_key,
        mime_type=mime_type,
        file_size_bytes=len(img_bytes),
        uploaded_by_user_id=user.id,
    )
    await file_repo.create(file_meta)

    return user, file_meta


# ==============================================================================
# 1. Authentication & Authorization Tests
# ==============================================================================


def test_recognition_missing_auth_returns_401(client_with_deps: TestClient):
    """POST /api/v1/recognition/images without token returns 401 Unauthorized."""
    response = client_with_deps.post("/api/v1/recognition/images", json={"file_id": "file_123"})
    assert response.status_code == 401


def test_recognition_invalid_token_returns_401(client_with_deps: TestClient):
    """POST /api/v1/recognition/images with invalid Bearer token returns 401 Unauthorized."""
    response = client_with_deps.post(
        "/api/v1/recognition/images",
        headers={"Authorization": "Bearer invalid.token.str"},
        json={"file_id": "file_123"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_recognition_cross_user_file_access_rejected(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """User A cannot request recognition on an asset owned by User B."""
    user_a, _ = await seed_user_and_file(db_session, test_storage, email="usera@vehiclevision.ai")
    user_b, file_b = await seed_user_and_file(db_session, test_storage, email="userb@vehiclevision.ai")

    token_a = create_access_token(subject=user_a.id)

    # User A requests recognition using file_id belonging to User B
    response = client_with_deps.post(
        "/api/v1/recognition/images",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"file_id": file_b.id},
    )
    assert response.status_code == 401
    assert "Access denied" in response.json()["detail"]


# ==============================================================================
# 2. Input Asset & Validation Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_recognition_nonexistent_file_id_returns_404(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """Non-existent file_id reference returns 404 Not Found."""
    user, _ = await seed_user_and_file(db_session, test_storage)
    token = create_access_token(subject=user.id)

    response = client_with_deps.post(
        "/api/v1/recognition/images",
        headers={"Authorization": f"Bearer {token}"},
        json={"file_id": "non_existent_file_id_999"},
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_recognition_non_image_asset_returns_415(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """Referencing a video asset (video/mp4) returns 415 Unsupported Media Type."""
    user, video_file = await seed_user_and_file(
        db_session,
        test_storage,
        filename="clip.mp4",
        mime_type="video/mp4",
        img_bytes=b"dummy_mp4_bytes",
    )
    token = create_access_token(subject=user.id)

    response = client_with_deps.post(
        "/api/v1/recognition/images",
        headers={"Authorization": f"Bearer {token}"},
        json={"file_id": video_file.id},
    )
    assert response.status_code == 415
    assert "not supported" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_recognition_corrupt_image_bytes_returns_400(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """Corrupt image data in storage returns 400 Bad Request."""
    user, corrupt_file = await seed_user_and_file(
        db_session,
        test_storage,
        filename="corrupt.jpg",
        mime_type="image/jpeg",
        img_bytes=b"not_an_image_binary_data",
    )
    token = create_access_token(subject=user.id)

    # Override service pipeline with valid fake pipeline to isolate corruption check
    fake_pipeline = ALPRPipeline(
        vehicle_detector=FakeVehicleDetector(),
        plate_detector=FakePlateDetector(),
        ocr_engine=FakeOCR(),
        cleaner=FakeCleaner(),
    )

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.recognition_service.ALPRPipeline", lambda: fake_pipeline)
        response = client_with_deps.post(
            "/api/v1/recognition/images",
            headers={"Authorization": f"Bearer {token}"},
            json={"file_id": corrupt_file.id},
        )
    assert response.status_code == 400
    assert "corrupted" in response.json()["detail"].lower() or "invalid" in response.json()["detail"].lower()


# ==============================================================================
# 3. Model Weights & Inference Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_recognition_missing_model_weights_returns_503(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """Missing model weights trigger 503 Service Unavailable."""
    user, file_meta = await seed_user_and_file(db_session, test_storage)
    token = create_access_token(subject=user.id)

    missing_pipeline = ALPRPipeline(
        vehicle_detector=MissingWeightsDetector(),
        plate_detector=FakePlateDetector(),
        ocr_engine=FakeOCR(),
        cleaner=FakeCleaner(),
    )

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.recognition_service.ALPRPipeline", lambda: missing_pipeline)
        response = client_with_deps.post(
            "/api/v1/recognition/images",
            headers={"Authorization": f"Bearer {token}"},
            json={"file_id": file_meta.id},
        )
    assert response.status_code == 503
    assert "MODEL_NOT_CONFIGURED" in response.json()["error"]["code"]


@pytest.mark.asyncio
async def test_recognition_successful_alpr_inference(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """Successful ALPR image inference returns vehicle & plate details and persists job in DB."""
    user, file_meta = await seed_user_and_file(db_session, test_storage)
    token = create_access_token(subject=user.id)

    fake_pipeline = ALPRPipeline(
        vehicle_detector=FakeVehicleDetector([
            {"type": "car", "confidence": 0.95, "bbox": [100, 100, 400, 300]}
        ]),
        plate_detector=FakePlateDetector([20, 50, 120, 80]),
        ocr_engine=FakeOCR("MH12DE1428", 0.93),
        cleaner=FakeCleaner(),
    )

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.recognition_service.ALPRPipeline", lambda: fake_pipeline)
        response = client_with_deps.post(
            "/api/v1/recognition/images",
            headers={"Authorization": f"Bearer {token}"},
            json={"file_id": file_meta.id},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["file_id"] == file_meta.id
    assert data["status"] == "COMPLETED"
    assert data["image_width"] == 500
    assert data["image_height"] == 400
    assert len(data["vehicles"]) == 1

    veh = data["vehicles"][0]
    assert veh["type"] == "car"
    assert veh["confidence"] == 0.95
    assert veh["bbox"] == [100, 100, 400, 300]
    assert veh["plate"]["text"] == "MH12DE1428"
    assert veh["plate"]["confidence"] == 0.93

    # Check persistence in DB
    detection_repo = DetectionRepository(db_session)
    job = await detection_repo.get_by_id(data["job_id"])
    assert job is not None
    assert job.status == "COMPLETED"
    assert job.user_id == user.id


@pytest.mark.asyncio
async def test_recognition_no_vehicles_detected(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """Image with no vehicles returns empty vehicles list []."""
    user, file_meta = await seed_user_and_file(db_session, test_storage)
    token = create_access_token(subject=user.id)

    fake_pipeline = ALPRPipeline(
        vehicle_detector=FakeVehicleDetector([]),  # No vehicles detected
        plate_detector=FakePlateDetector(),
        ocr_engine=FakeOCR(),
        cleaner=FakeCleaner(),
    )

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.recognition_service.ALPRPipeline", lambda: fake_pipeline)
        response = client_with_deps.post(
            "/api/v1/recognition/images",
            headers={"Authorization": f"Bearer {token}"},
            json={"file_id": file_meta.id},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["vehicles"] == []


@pytest.mark.asyncio
async def test_recognition_vehicle_detected_without_plate(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """Vehicle detected without a license plate returns plate: null."""
    user, file_meta = await seed_user_and_file(db_session, test_storage)
    token = create_access_token(subject=user.id)

    fake_pipeline = ALPRPipeline(
        vehicle_detector=FakeVehicleDetector([
            {"type": "truck", "confidence": 0.88, "bbox": [20, 20, 300, 200]}
        ]),
        plate_detector=FakePlateDetector(None),  # No plate detected
        ocr_engine=FakeOCR(),
        cleaner=FakeCleaner(),
    )

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.recognition_service.ALPRPipeline", lambda: fake_pipeline)
        response = client_with_deps.post(
            "/api/v1/recognition/images",
            headers={"Authorization": f"Bearer {token}"},
            json={"file_id": file_meta.id},
        )

    assert response.status_code == 200
    data = response.json()
    assert len(data["vehicles"]) == 1
    assert data["vehicles"][0]["type"] == "truck"
    assert data["vehicles"][0]["plate"] is None


@pytest.mark.asyncio
async def test_recognition_coordinate_bounding_clamping(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """Out-of-bounds detector coordinates are clamped strictly within image dimensions [0, 0, width, height]."""
    user, file_meta = await seed_user_and_file(db_session, test_storage, img_bytes=create_test_image_bytes(500, 400))
    token = create_access_token(subject=user.id)

    # Out of bounds coordinates: xmax=9999, ymax=9999, xmin=-50, ymin=-50
    fake_pipeline = ALPRPipeline(
        vehicle_detector=FakeVehicleDetector([
            {"type": "bus", "confidence": 0.91, "bbox": [-50, -50, 9999, 9999]}
        ]),
        plate_detector=FakePlateDetector([10, 10, 9999, 9999]),
        ocr_engine=FakeOCR("KA01AB9999", 0.85),
        cleaner=FakeCleaner(),
    )

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.recognition_service.ALPRPipeline", lambda: fake_pipeline)
        response = client_with_deps.post(
            "/api/v1/recognition/images",
            headers={"Authorization": f"Bearer {token}"},
            json={"file_id": file_meta.id},
        )

    assert response.status_code == 200
    veh = response.json()["vehicles"][0]
    # Clamped to image dimensions (500x400)
    assert veh["bbox"] == [0, 0, 500, 400]
    assert veh["plate"]["bbox"] == [10, 10, 500, 400]


def test_openapi_recognition_route_registered(client_with_deps: TestClient):
    """OpenAPI schema registers POST /api/v1/recognition/images with response schemas."""
    response = client_with_deps.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "/api/v1/recognition/images" in schema["paths"]
    assert "post" in schema["paths"]["/api/v1/recognition/images"]


# ==============================================================================
# 5. Issue #7 — Video Processing and Frame-Based ALPR Tests
# ==============================================================================


def create_test_video_bytes(
    width: int = 320,
    height: int = 240,
    fps: float = 10.0,
    num_frames: int = 10,
) -> bytes:
    """Helper to generate a synthetic valid MP4 video binary in memory for testing."""
    import os
    import tempfile
    import cv2
    import numpy as np

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


def test_video_recognition_missing_auth_returns_401(client_with_deps: TestClient):
    """POST /api/v1/recognition/videos without token returns 401 Unauthorized."""
    response = client_with_deps.post("/api/v1/recognition/videos", json={"file_id": "video_123"})
    assert response.status_code == 401


def test_video_recognition_invalid_token_returns_401(client_with_deps: TestClient):
    """POST /api/v1/recognition/videos with invalid token returns 401 Unauthorized."""
    response = client_with_deps.post(
        "/api/v1/recognition/videos",
        headers={"Authorization": "Bearer invalid.token.str"},
        json={"file_id": "video_123"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_video_recognition_cross_user_file_access_rejected(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """User A cannot request video recognition on an asset owned by User B."""
    vid_bytes = create_test_video_bytes()
    user_a, _ = await seed_user_and_file(db_session, test_storage, email="usera_vid@vehiclevision.ai")
    user_b, file_b = await seed_user_and_file(
        db_session,
        test_storage,
        email="userb_vid@vehiclevision.ai",
        filename="clip.mp4",
        mime_type="video/mp4",
        img_bytes=vid_bytes,
    )

    token_a = create_access_token(subject=user_a.id)

    response = client_with_deps.post(
        "/api/v1/recognition/videos",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"file_id": file_b.id},
    )
    assert response.status_code in (401, 403)
    assert "Access denied" in response.json()["detail"]


@pytest.mark.asyncio
async def test_video_recognition_nonexistent_file_id_returns_404(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """Referencing a non-existent video file_id returns 404 Not Found."""
    user, _ = await seed_user_and_file(db_session, test_storage)
    token = create_access_token(subject=user.id)

    response = client_with_deps.post(
        "/api/v1/recognition/videos",
        headers={"Authorization": f"Bearer {token}"},
        json={"file_id": "nonexistent-file-id-12345"},
    )
    assert response.status_code == 404
    assert "File asset" in response.json()["detail"]


@pytest.mark.asyncio
async def test_video_recognition_image_asset_submitted_returns_415(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """Submitting an image asset (image/jpeg) to POST /recognition/videos returns 415 Unsupported Media Type."""
    user, file_img = await seed_user_and_file(
        db_session, test_storage, mime_type="image/jpeg", img_bytes=create_test_image_bytes()
    )
    token = create_access_token(subject=user.id)

    response = client_with_deps.post(
        "/api/v1/recognition/videos",
        headers={"Authorization": f"Bearer {token}"},
        json={"file_id": file_img.id},
    )
    assert response.status_code == 415
    assert "not supported for video recognition" in response.json()["detail"]


@pytest.mark.asyncio
async def test_image_recognition_video_asset_submitted_returns_415(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """Submitting a video asset (video/mp4) to POST /recognition/images returns 415 Unsupported Media Type."""
    vid_bytes = create_test_video_bytes()
    user, file_vid = await seed_user_and_file(
        db_session, test_storage, filename="traffic.mp4", mime_type="video/mp4", img_bytes=vid_bytes
    )
    token = create_access_token(subject=user.id)

    response = client_with_deps.post(
        "/api/v1/recognition/images",
        headers={"Authorization": f"Bearer {token}"},
        json={"file_id": file_vid.id},
    )
    assert response.status_code == 415
    assert "not supported for image recognition" in response.json()["detail"]


@pytest.mark.asyncio
async def test_video_recognition_corrupt_video_returns_400(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """Corrupt video bytes return 400 Bad Request."""
    user, file_corrupt = await seed_user_and_file(
        db_session,
        test_storage,
        filename="bad.mp4",
        mime_type="video/mp4",
        img_bytes=b"CORRUPT_MP4_HEADER_DATA_NOT_VALID_CONTAINER",
    )
    token = create_access_token(subject=user.id)

    response = client_with_deps.post(
        "/api/v1/recognition/videos",
        headers={"Authorization": f"Bearer {token}"},
        json={"file_id": file_corrupt.id},
    )
    assert response.status_code == 400
    assert "corrupted" in response.json()["detail"].lower() or "cannot be decoded" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_video_recognition_missing_model_weights_returns_503(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """Missing model weights during video frame ALPR inference return HTTP 503 Service Unavailable."""
    vid_bytes = create_test_video_bytes()
    user, file_meta = await seed_user_and_file(
        db_session, test_storage, filename="sample.mp4", mime_type="video/mp4", img_bytes=vid_bytes
    )
    token = create_access_token(subject=user.id)

    missing_pipeline = ALPRPipeline(vehicle_detector=MissingWeightsDetector())

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.recognition_service.ALPRPipeline", lambda: missing_pipeline)
        response = client_with_deps.post(
            "/api/v1/recognition/videos",
            headers={"Authorization": f"Bearer {token}"},
            json={"file_id": file_meta.id},
        )

    assert response.status_code == 503
    assert "weights" in response.json()["detail"].lower() or "not configured" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_video_recognition_successful_alpr_execution(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """POST /api/v1/recognition/videos executes frame sampling, runs ALPR pipeline, and returns VideoRecognitionResponse."""
    vid_bytes = create_test_video_bytes(width=320, height=240, fps=10.0, num_frames=15)
    user, file_meta = await seed_user_and_file(
        db_session, test_storage, filename="highway.mp4", mime_type="video/mp4", img_bytes=vid_bytes
    )
    token = create_access_token(subject=user.id)

    fake_pipeline = ALPRPipeline(
        vehicle_detector=FakeVehicleDetector([
            {"type": "motorbike", "confidence": 0.91, "bbox": [10, 10, 150, 120]}
        ]),
        plate_detector=FakePlateDetector([20, 20, 100, 50]),
        ocr_engine=FakeOCR("MH12DE5678", 0.95),
        cleaner=FakeCleaner(),
    )

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.recognition_service.ALPRPipeline", lambda: fake_pipeline)
        response = client_with_deps.post(
            "/api/v1/recognition/videos",
            headers={"Authorization": f"Bearer {token}"},
            json={"file_id": file_meta.id},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["job_id"] is not None and len(data["job_id"]) > 0
    assert data["file_id"] == file_meta.id
    assert data["status"] == "COMPLETED"
    assert data["video_width"] == 320
    assert data["video_height"] == 240
    assert data["total_frames"] == 15
    assert len(data["frames"]) > 0

    # Verify frame ALPR detection schema
    frame_0 = data["frames"][0]
    assert "frame_index" in frame_0
    assert "timestamp_seconds" in frame_0
    assert len(frame_0["vehicles"]) == 1
    assert frame_0["vehicles"][0]["type"] == "motorbike"
    assert frame_0["vehicles"][0]["plate"]["text"] == "MH12DE5678"

    # Verify persistence in DetectionJob, Vehicle, and Plate tables
    det_repo = DetectionRepository(db_session)
    job = await det_repo.get_by_id(data["job_id"])
    assert job is not None
    assert job.media_type == "video"
    assert job.user_id == user.id
    assert job.status == "COMPLETED"


def test_get_video_job_status_unauthenticated_returns_401(client_with_deps: TestClient):
    """GET /api/v1/recognition/videos/{job_id} without token returns 401 Unauthorized."""
    response = client_with_deps.get("/api/v1/recognition/videos/some_job_id")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_video_job_status_cross_user_rejected(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """User A cannot access User B's video recognition job."""
    vid_bytes = create_test_video_bytes()
    user_a, _ = await seed_user_and_file(db_session, test_storage, email="usera_job@vehiclevision.ai")
    user_b, file_b = await seed_user_and_file(
        db_session, test_storage, email="userb_job@vehiclevision.ai", filename="clip.mp4", mime_type="video/mp4", img_bytes=vid_bytes
    )

    token_a = create_access_token(subject=user_a.id)
    token_b = create_access_token(subject=user_b.id)

    fake_pipeline = ALPRPipeline(
        vehicle_detector=FakeVehicleDetector(),
        plate_detector=FakePlateDetector(),
        ocr_engine=FakeOCR(),
        cleaner=FakeCleaner(),
    )

    # User B creates a video recognition job
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.recognition_service.ALPRPipeline", lambda: fake_pipeline)
        resp_b = client_with_deps.post(
            "/api/v1/recognition/videos",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"file_id": file_b.id},
        )
    job_id_b = resp_b.json()["job_id"]

    # User A tries to GET User B's job status
    resp_get = client_with_deps.get(
        f"/api/v1/recognition/videos/{job_id_b}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp_get.status_code in (401, 403, 404)


@pytest.mark.asyncio
async def test_get_video_job_status_nonexistent_returns_404(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """GET /api/v1/recognition/videos/{job_id} for a nonexistent job returns 404 Not Found."""
    user, _ = await seed_user_and_file(db_session, test_storage)
    token = create_access_token(subject=user.id)

    response = client_with_deps.get(
        "/api/v1/recognition/videos/nonexistent_job_9999",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_video_job_status_success(
    db_session: AsyncSession, test_storage: LocalStorageService, client_with_deps: TestClient
):
    """GET /api/v1/recognition/videos/{job_id} successfully returns video recognition job data."""
    vid_bytes = create_test_video_bytes()
    user, file_meta = await seed_user_and_file(
        db_session, test_storage, filename="video_job.mp4", mime_type="video/mp4", img_bytes=vid_bytes
    )
    token = create_access_token(subject=user.id)

    fake_pipeline = ALPRPipeline(
        vehicle_detector=FakeVehicleDetector(),
        plate_detector=FakePlateDetector(),
        ocr_engine=FakeOCR(),
        cleaner=FakeCleaner(),
    )

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.recognition_service.ALPRPipeline", lambda: fake_pipeline)
        post_resp = client_with_deps.post(
            "/api/v1/recognition/videos",
            headers={"Authorization": f"Bearer {token}"},
            json={"file_id": file_meta.id},
        )

    job_id = post_resp.json()["job_id"]

    get_resp = client_with_deps.get(
        f"/api/v1/recognition/videos/{job_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert get_data["job_id"] == job_id
    assert get_data["file_id"] == file_meta.id
    assert get_data["status"] == "COMPLETED"
    assert len(get_data["frames"]) > 0


def test_openapi_video_routes_registered(client_with_deps: TestClient):
    """OpenAPI schema registers POST /api/v1/recognition/videos and GET /api/v1/recognition/videos/{job_id}."""
    response = client_with_deps.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "/api/v1/recognition/videos" in schema["paths"]
    assert "post" in schema["paths"]["/api/v1/recognition/videos"]
    assert "/api/v1/recognition/videos/{job_id}" in schema["paths"]
    assert "get" in schema["paths"]["/api/v1/recognition/videos/{job_id}"]
