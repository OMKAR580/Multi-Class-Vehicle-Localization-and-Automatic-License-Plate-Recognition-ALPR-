import secrets
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import quote_plus

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    APP_NAME: str = "VisionPlate AI Backend"
    APP_VERSION: str = "0.1.0"
    PROJECT_NAME: str = "VisionPlate AI Backend"
    ENVIRONMENT: Literal["development", "testing", "production"] = "development"
    DEBUG: bool = False
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    API_V1_PREFIX: str = "/api/v1"
    API_V1_STR: str = "/api/v1"

    # Authentication configuration is consumed by existing routes. Development and
    # test runs get an ephemeral key; production must provide its own stable key.
    SECRET_KEY: str | None = Field(default=None, min_length=32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Comma-separated values from the environment are normalized into a list.
    CORS_ORIGINS: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )

    # Database settings remain available to existing code; no password is embedded.
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "vehicle_alpr"
    POSTGRES_USER: str = "alpr_admin"
    POSTGRES_PASSWORD: str = ""
    DATABASE_URL: str | None = None

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""

    # OAuth callback URLs — must match provider console registration exactly.
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"
    GITHUB_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/github/callback"
    OAUTH_STATE_SECRET: str = ""
    ALLOWED_REDIRECT_URLS: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:3000/dashboard",
            "http://localhost:3000/auth/callback",
        ]
    )

    # Storage and File Upload Configuration
    MAX_UPLOAD_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB
    STORAGE_BACKEND: str = "local"
    STORAGE_LOCAL_ROOT: str = str(BACKEND_DIR / "storage")
    ALLOWED_IMAGE_EXTENSIONS: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [".jpg", ".jpeg", ".png"]
    )
    ALLOWED_VIDEO_EXTENSIONS: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [".mp4"]
    )
    ALLOWED_MIME_TYPES: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["image/jpeg", "image/png", "video/mp4"]
    )

    # Video Processing Limits & Configuration
    MAX_VIDEO_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB
    MAX_VIDEO_DURATION_SECONDS: float = 60.0  # 60 seconds max duration
    MAX_VIDEO_DIMENSION: int = 4096  # 4096px max dimension
    VIDEO_SAMPLING_FPS: float = 1.0  # Sample 1 frame per second by default
    MAX_VIDEO_FRAMES_PER_JOB: int = 60  # Max 60 frames sampled per job
    MAX_VIDEO_PROCESSING_TIME_SECONDS: float = 30.0  # 30 seconds processing timeout

    # AI Pipeline & ALPR Configuration
    VEHICLE_MODEL_PATH: str = str(REPOSITORY_ROOT / "ai" / "models" / "yolov8_vehicle.pt")
    PLATE_MODEL_PATH: str = str(REPOSITORY_ROOT / "ai" / "models" / "yolov8_plate.pt")
    MIN_VEHICLE_CONFIDENCE: float = 0.40
    MIN_PLATE_CONFIDENCE: float = 0.40
    MIN_OCR_CONFIDENCE: float = 0.30
    MAX_INFERENCE_IMAGE_DIMENSION: int = 4096
    INFERENCE_TIMEOUT_SECONDS: int = 15

    model_config = SettingsConfigDict(
        env_file=(".env", str(BACKEND_DIR / ".env"), str(REPOSITORY_ROOT / ".env")),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def validate_security_settings(self) -> "Settings":
        if self.ENVIRONMENT == "production":
            if not self.SECRET_KEY:
                raise ValueError("SECRET_KEY must be set in production")
            if self.SECRET_KEY.startswith("change_this"):
                raise ValueError(
                    "SECRET_KEY must not use the example placeholder in production"
                )
            if "*" in self.CORS_ORIGINS:
                raise ValueError("CORS_ORIGINS must not contain '*' in production")
        elif not self.SECRET_KEY:
            self.SECRET_KEY = secrets.token_urlsafe(32)
        return self

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            return url
        user = quote_plus(self.POSTGRES_USER)
        password = quote_plus(self.POSTGRES_PASSWORD)
        return (
            f"postgresql+asyncpg://{user}:{password}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()
