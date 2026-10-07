from app.schemas.health import HealthResponse
from app.schemas.user import UserCreate, UserResponse
from app.schemas.auth import Token, LoginRequest, OAuthLoginRequest
from app.schemas.detection import AIDetectionResponse, VehicleResult, LicensePlateResult, DetectionJobCreate, DetectionJobStatus
from app.schemas.report import ReportRequest, ReportResponse

__all__ = [
    "HealthResponse",
    "UserCreate",
    "UserResponse",
    "Token",
    "LoginRequest",
    "OAuthLoginRequest",
    "AIDetectionResponse",
    "VehicleResult",
    "LicensePlateResult",
    "DetectionJobCreate",
    "DetectionJobStatus",
    "ReportRequest",
    "ReportResponse",
]
