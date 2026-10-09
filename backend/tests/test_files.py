"""Tests for Secure File Upload API (Issue #5)."""

import io
import struct
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.exceptions import StorageException
from app.core.security import create_access_token
from app.main import app
from app.models.file import FileMetadata
from app.models.user import User
from app.repositories.file_repository import FileRepository
from app.repositories.user_repository import UserRepository
from app.services.storage_service import LocalStorageService, get_storage_service

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def valid_jpeg_bytes() -> bytes:
    """Generate a valid in-memory JPEG byte string."""
    buf = io.BytesIO()
    img = Image.new("RGB", (64, 64), color="blue")
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def valid_png_bytes() -> bytes:
    """Generate a valid in-memory PNG byte string."""
    buf = io.BytesIO()
    img = Image.new("RGB", (64, 64), color="green")
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def valid_mp4_bytes() -> bytes:
    """Generate a minimal valid ISOBMFF MP4 byte string."""
    ftyp_payload = b"isom\x00\x00\x02\x00isomiso2mp41"
    ftyp_box = struct.pack(">I", 8 + len(ftyp_payload)) + b"ftyp" + ftyp_payload
    mdat_payload = b"test_video_frame_payload_data_12345678"
    mdat_box = struct.pack(">I", 8 + len(mdat_payload)) + b"mdat" + mdat_payload
    return ftyp_box + mdat_box


@pytest_asyncio.fixture
async def file_test_env():
    """
    Set up an isolated in-memory database and temporary local storage directory.
    Overrides FastAPI get_db and get_storage_service dependencies.
    """
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    temp_storage_dir = tempfile.TemporaryDirectory()
    storage_svc = LocalStorageService(base_dir=Path(temp_storage_dir.name))

    async def override_get_db():
        async with session_factory() as session:
            yield session

    def override_get_storage():
        return storage_svc

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_storage_service] = override_get_storage

    # Create a registered test user
    async with session_factory() as session:
        user_repo = UserRepository(session)
        user = User(
            id="usr_upload_tester_01",
            email="tester@visionplate.ai",
            full_name="Upload Tester",
            is_active=True,
            role="operator",
        )
        await user_repo.create(user)

    client = TestClient(app)
    token = create_access_token(subject="usr_upload_tester_01")
    auth_headers = {"Authorization": f"Bearer {token}"}

    yield {
        "client": client,
        "token": token,
        "auth_headers": auth_headers,
        "user_id": "usr_upload_tester_01",
        "storage": storage_svc,
        "session_factory": session_factory,
    }

    app.dependency_overrides.clear()
    temp_storage_dir.cleanup()
    await engine.dispose()


# ─── 1. Authentication & Ownership Tests ──────────────────────────────────────

def test_unauthenticated_upload_rejected(file_test_env, valid_jpeg_bytes):
    """Verify that requests missing an Authorization header are rejected with HTTP 401."""
    client = file_test_env["client"]
    files = {"file": ("test.jpg", valid_jpeg_bytes, "image/jpeg")}
    response = client.post("/api/v1/files/upload", files=files)
    assert response.status_code == 401
    data = response.json()
    assert "error" in data or "detail" in data


def test_invalid_token_upload_rejected(file_test_env, valid_jpeg_bytes):
    """Verify that requests with an invalid/forged JWT are rejected with HTTP 401."""
    client = file_test_env["client"]
    files = {"file": ("test.jpg", valid_jpeg_bytes, "image/jpeg")}
    headers = {"Authorization": "Bearer invalid.token.payload"}
    response = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert response.status_code == 401


def test_authenticated_image_upload_jpeg(file_test_env, valid_jpeg_bytes):
    """Verify successful upload of a JPEG image by an authenticated user."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]
    files = {"file": ("front_plate.jpg", valid_jpeg_bytes, "image/jpeg")}

    response = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert response.status_code == 201

    data = response.json()
    assert "id" in data
    assert data["filename"] == "front_plate.jpg"
    assert data["mime_type"] == "image/jpeg"
    assert data["file_size_bytes"] == len(valid_jpeg_bytes)
    assert data["uploaded_by_user_id"] == file_test_env["user_id"]
    assert "storage_key" in data
    assert not data["storage_key"].startswith("/")
    assert not data["storage_key"].startswith("C:")


def test_authenticated_image_upload_png(file_test_env, valid_png_bytes):
    """Verify successful upload of a PNG image."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]
    files = {"file": ("vehicle_crop.png", valid_png_bytes, "image/png")}

    response = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert response.status_code == 201

    data = response.json()
    assert data["filename"] == "vehicle_crop.png"
    assert data["mime_type"] == "image/png"
    assert data["file_size_bytes"] == len(valid_png_bytes)
    assert data["uploaded_by_user_id"] == file_test_env["user_id"]


def test_authenticated_video_upload_mp4(file_test_env, valid_mp4_bytes):
    """Verify successful upload of a valid MP4 video container."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]
    files = {"file": ("traffic_camera.mp4", valid_mp4_bytes, "video/mp4")}

    response = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert response.status_code == 201

    data = response.json()
    assert data["filename"] == "traffic_camera.mp4"
    assert data["mime_type"] == "video/mp4"
    assert data["file_size_bytes"] == len(valid_mp4_bytes)
    assert data["uploaded_by_user_id"] == file_test_env["user_id"]


def test_owner_id_cannot_be_spoofed_by_client(file_test_env, valid_jpeg_bytes):
    """Verify that a client cannot choose or spoof the asset owner via form fields or headers."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]
    files = {"file": ("car.jpg", valid_jpeg_bytes, "image/jpeg")}
    # Client passes spoofed user_id in data payload
    data_payload = {"uploaded_by_user_id": "usr_victim_999", "user_id": "usr_victim_999"}

    response = client.post("/api/v1/files/upload", files=files, data=data_payload, headers=headers)
    assert response.status_code == 201

    data = response.json()
    # Owner must strictly be the authenticated user, ignoring spoofed fields
    assert data["uploaded_by_user_id"] == file_test_env["user_id"]
    assert data["uploaded_by_user_id"] != "usr_victim_999"


# ─── 2. Validation & Security Enforcement Tests ───────────────────────────────

def test_unsupported_file_extension(file_test_env):
    """Verify that unsupported extensions are rejected with HTTP 415."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]
    files = {"file": ("script.sh", b"echo 'hello'", "text/plain")}

    response = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert response.status_code == 415


def test_unsupported_content_type(file_test_env, valid_jpeg_bytes):
    """Verify that an unsupported declared Content-Type is rejected with HTTP 415."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]
    files = {"file": ("car.jpg", valid_jpeg_bytes, "application/pdf")}

    response = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert response.status_code == 415


def test_mismatched_extension_and_content_type(file_test_env, valid_jpeg_bytes):
    """Verify rejection when filename extension does not match Content-Type header."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]
    files = {"file": ("car.png", valid_jpeg_bytes, "image/jpeg")}

    response = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert response.status_code in (400, 415)


def test_spoofed_magic_bytes_rejected(file_test_env):
    """Verify rejection when file extension and header declare JPEG but content is plaintext."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]
    fake_jpeg = b"This is a text file pretending to be a JPEG image."
    files = {"file": ("fake.jpg", fake_jpeg, "image/jpeg")}

    response = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert response.status_code == 400
    data = response.json()
    assert "signature" in str(data).lower() or "format" in str(data).lower() or "invalid" in str(data).lower()


def test_empty_file_rejected(file_test_env):
    """Verify that empty uploads (0 bytes) are rejected with HTTP 400."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]
    files = {"file": ("empty.jpg", b"", "image/jpeg")}

    response = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert response.status_code == 400
    data = response.json()
    assert "empty" in str(data).lower()


def test_truncated_corrupt_jpeg_rejected(file_test_env, valid_jpeg_bytes):
    """Verify that truncated/damaged JPEG files fail deep decoding and return HTTP 400."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]
    # Truncate image to only first 40 bytes (header present, but body truncated)
    truncated_jpeg = valid_jpeg_bytes[:40]
    files = {"file": ("truncated.jpg", truncated_jpeg, "image/jpeg")}

    response = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert response.status_code == 400


def test_truncated_corrupt_mp4_rejected(file_test_env, valid_mp4_bytes):
    """Verify that truncated MP4 files with broken atom lengths are rejected with HTTP 400."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]
    # Truncate MP4 in the middle of a box
    truncated_mp4 = valid_mp4_bytes[:24]
    files = {"file": ("broken.mp4", truncated_mp4, "video/mp4")}

    response = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert response.status_code == 400


def test_mp4_with_free_atom_no_mdat_rejected(file_test_env):
    """Verify that an MP4 containing only ftyp and free (padding) atoms without mdat is rejected."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]

    # Construct an MP4 with valid ftyp + free (padding) box, but NO mdat media data box
    ftyp_payload = b"isom\x00\x00\x02\x00isomiso2mp41"
    ftyp_box = struct.pack(">I", 8 + len(ftyp_payload)) + b"ftyp" + ftyp_payload
    free_payload = b"padding_without_actual_media_data_12345678"
    free_box = struct.pack(">I", 8 + len(free_payload)) + b"free" + free_payload
    padding_only_mp4 = ftyp_box + free_box

    files = {"file": ("padding_only.mp4", padding_only_mp4, "video/mp4")}
    response = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert response.status_code == 400
    data = response.json()
    assert "media data" in str(data).lower() or "mdat" in str(data).lower() or "invalid" in str(data).lower()


def test_mp4_with_empty_mdat_rejected(file_test_env):
    """Verify that an MP4 containing an mdat atom with zero payload bytes is rejected."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]

    # Construct an MP4 with ftyp + empty mdat (box size 8 = header only, 0 data bytes)
    ftyp_payload = b"isom\x00\x00\x02\x00isomiso2mp41"
    ftyp_box = struct.pack(">I", 8 + len(ftyp_payload)) + b"ftyp" + ftyp_payload
    empty_mdat_box = struct.pack(">I", 8) + b"mdat"
    empty_mdat_mp4 = ftyp_box + empty_mdat_box

    files = {"file": ("empty_mdat.mp4", empty_mdat_mp4, "video/mp4")}
    response = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert response.status_code == 400
    data = response.json()
    assert "media data" in str(data).lower() or "mdat" in str(data).lower() or "invalid" in str(data).lower()


def test_image_exceeding_max_pixels_rejected(file_test_env):
    """Verify that an image exceeding MAX_IMAGE_PIXELS (decompression bomb) is rejected."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]

    # 5001 x 5001 = 25,010,001 pixels (> 25,000,000 max pixels limit)
    buf = io.BytesIO()
    img = Image.new("L", (5001, 5001), 0)
    img.save(buf, format="PNG")
    huge_pixels_png = buf.getvalue()

    files = {"file": ("decompression_bomb.png", huge_pixels_png, "image/png")}
    response = client.post("/api/v1/files/upload", files=files, headers=headers)
    assert response.status_code == 400
    data = response.json()
    assert "decompression" in str(data).lower() or "pixel" in str(data).lower() or "invalid" in str(data).lower()


def test_oversized_file_incremental_rejection(file_test_env, valid_jpeg_bytes):
    """Verify that files exceeding MAX_UPLOAD_SIZE_BYTES are rejected with HTTP 413."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]

    # Temporarily set upload limit to 100 bytes (smaller than valid_jpeg_bytes)
    with patch.object(settings, "MAX_UPLOAD_SIZE_BYTES", 100):
        files = {"file": ("large.jpg", valid_jpeg_bytes, "image/jpeg")}
        response = client.post("/api/v1/files/upload", files=files, headers=headers)
        assert response.status_code == 413
        data = response.json()
        assert "exceed" in str(data).lower() or "large" in str(data).lower()


def test_filename_sanitization_and_path_traversal(file_test_env, valid_jpeg_bytes):
    """Verify that path-traversal sequences in the filename are stripped."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]
    malicious_names = [
        "../../../../etc/passwd.jpg",
        r"..\..\..\windows\system32\cmd.jpg",
        "foo/bar/baz.jpg",
    ]

    for bad_name in malicious_names:
        files = {"file": (bad_name, valid_jpeg_bytes, "image/jpeg")}
        response = client.post("/api/v1/files/upload", files=files, headers=headers)
        assert response.status_code == 201
        data = response.json()
        saved_name = data["filename"]
        # Must not contain directory separators
        assert "/" not in saved_name
        assert "\\" not in saved_name
        assert ".." not in saved_name
        assert saved_name.endswith(".jpg")


def test_duplicate_filenames_generate_distinct_storage_keys(file_test_env, valid_jpeg_bytes):
    """Verify that uploading files with identical original names generates distinct storage keys."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]

    files_1 = {"file": ("plate.jpg", valid_jpeg_bytes, "image/jpeg")}
    resp_1 = client.post("/api/v1/files/upload", files=files_1, headers=headers)
    assert resp_1.status_code == 201

    files_2 = {"file": ("plate.jpg", valid_jpeg_bytes, "image/jpeg")}
    resp_2 = client.post("/api/v1/files/upload", files=files_2, headers=headers)
    assert resp_2.status_code == 201

    data_1 = resp_1.json()
    data_2 = resp_2.json()

    assert data_1["id"] != data_2["id"]
    assert data_1["storage_key"] != data_2["storage_key"]


# ─── 3. Rollback & Failure Cleanup Tests ──────────────────────────────────────

@pytest.mark.asyncio
async def test_database_failure_cleans_up_stored_file(file_test_env, valid_jpeg_bytes):
    """Verify that if database commit fails, the finalized file is deleted from storage."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]
    storage = file_test_env["storage"]

    files = {"file": ("cleanup_test.jpg", valid_jpeg_bytes, "image/jpeg")}

    # Mock FileRepository.create to raise an unexpected database exception
    with patch.object(FileRepository, "create", side_effect=Exception("Database connection severed")):
        response = client.post("/api/v1/files/upload", files=files, headers=headers)
        assert response.status_code in (500, 400)

    # Verify no orphaned files remain in storage directory
    stored_files = list(storage.base_dir.rglob("*.jpg"))
    assert len(stored_files) == 0


def test_storage_write_failure_returns_500(file_test_env, valid_jpeg_bytes):
    """Verify that storage backend failures return a safe HTTP 500 without leaking paths."""
    client = file_test_env["client"]
    headers = file_test_env["auth_headers"]

    with patch.object(LocalStorageService, "store", side_effect=StorageException("Disk full")):
        files = {"file": ("disk_full.jpg", valid_jpeg_bytes, "image/jpeg")}
        response = client.post("/api/v1/files/upload", files=files, headers=headers)
        assert response.status_code in (500, 400)
        data = response.json()
        # Verify no absolute disk path is leaked in response
        assert "E:" not in str(data)
        assert "C:" not in str(data)
        assert "/var" not in str(data)
        assert "/tmp" not in str(data)
        assert data["status_code"] in (500, 400)


# ─── 4. OpenAPI Route Documentation Verification ─────────────────────────────

def test_openapi_route_registered():
    """Verify that /api/v1/files/upload is documented in the OpenAPI schema with correct methods and responses."""
    client = TestClient(app)
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()

    paths = schema.get("paths", {})
    assert "/api/v1/files/upload" in paths
    upload_spec = paths["/api/v1/files/upload"]
    assert "post" in upload_spec

    post_spec = upload_spec["post"]
    assert "Files" in post_spec.get("tags", [])
    responses = post_spec.get("responses", {})
    assert "201" in responses
    assert "400" in responses
    assert "401" in responses
    assert "413" in responses
    assert "415" in responses
