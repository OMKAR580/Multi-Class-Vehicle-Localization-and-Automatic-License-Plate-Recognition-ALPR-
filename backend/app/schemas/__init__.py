from app.schemas.health import HealthResponse
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.schemas.auth import Token, LoginRequest
from app.schemas.detection import AIDetectionResponse, VehicleResult, LicensePlateResult, DetectionJobCreate, DetectionJobStatus
from app.schemas.report import ReportRequest, ReportResponse
from app.schemas.file import FileUploadResponse
from app.schemas.recognition import (
    ImageRecognitionRequest,
    RecognitionResponse,
    VideoFrameResult,
    VideoRecognitionRequest,
    VideoRecognitionResponse,
)

__all__ = [
    "HealthResponse",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "Token",
    "LoginRequest",
    "AIDetectionResponse",
    "VehicleResult",
    "LicensePlateResult",
    "DetectionJobCreate",
    "DetectionJobStatus",
    "ReportRequest",
    "ReportResponse",
    "FileUploadResponse",
    "ImageRecognitionRequest",
    "RecognitionResponse",
    "VideoRecognitionRequest",
    "VideoFrameResult",
    "VideoRecognitionResponse",
]
