"""
Backend Pydantic Schema Unit Tests.
Tests all API request/response schemas without importing app.main,
the database layer, or any ASGI components.
"""
from app.schemas.auth import Token, LoginRequest
from app.schemas.detection import (
    DetectionJobCreate, LicensePlateResult, VehicleResult, AIDetectionResponse
)
from app.schemas.user import UserResponse


# ─── Auth Schemas ────────────────────────────────────────────────────────────

def test_token_schema():
    token = Token(access_token="abc123", token_type="bearer", refresh_token="refresh456")
    assert token.access_token == "abc123"
    assert token.token_type == "bearer"
    assert token.refresh_token == "refresh456"


def test_login_request_schema():
    req = LoginRequest(email="test@example.com", password="Secret123!")
    assert req.email == "test@example.com"
    assert req.password == "Secret123!"


# ─── Detection Schemas ───────────────────────────────────────────────────────

def test_detection_job_create_defaults():
    job = DetectionJobCreate(media_url="https://example.com/test.jpg")
    assert job.media_type == "image"
    assert job.media_url == "https://example.com/test.jpg"


def test_license_plate_result_schema():
    plate = LicensePlateResult(
        text="RJ14AB1234",
        confidence=0.91,
        bbox=[230, 350, 410, 395]
    )
    assert plate.text == "RJ14AB1234"
    assert 0.0 <= plate.confidence <= 1.0
    assert len(plate.bbox) == 4


def test_vehicle_result_with_plate():
    vehicle = VehicleResult(
        type="car",
        confidence=0.94,
        bbox=[120, 80, 540, 420],
        plate=LicensePlateResult(
            text="DL01AB5678",
            confidence=0.89,
            bbox=[230, 350, 410, 395]
        )
    )
    assert vehicle.type == "car"
    assert vehicle.plate is not None
    assert vehicle.plate.text == "DL01AB5678"


def test_ai_detection_response_schema():
    response = AIDetectionResponse(
        image_id="img_001",
        vehicles=[
            VehicleResult(
                type="truck",
                confidence=0.87,
                bbox=[50, 60, 300, 250]
            )
        ]
    )
    assert response.image_id == "img_001"
    assert len(response.vehicles) == 1
    assert response.vehicles[0].type == "truck"


# ─── User Schemas ─────────────────────────────────────────────────────────────

def test_user_response_schema():
    user = UserResponse(
        id="usr_demo_123",
        email="demo@test.com",
        full_name="Test User",
        is_active=True,
        role="user"
    )
    assert user.email == "demo@test.com"
    assert user.is_active is True
    assert user.role == "user"
