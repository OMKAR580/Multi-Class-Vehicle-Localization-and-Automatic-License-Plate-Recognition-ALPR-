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
