"""Tests for configuration, API routing, and centralized error handling."""

import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.core.exceptions import (
    ALPRPlatformException,
    InvalidCredentialsException,
    ResourceNotFoundException,
    alpr_exception_handler,
    global_exception_handler,
)
from app.main import app


def test_cors_origins_parse_comma_separated_environment_value() -> None:
    settings = Settings(
        _env_file=None,
        CORS_ORIGINS="https://web.example, https://mobile.example",
    )
    assert settings.CORS_ORIGINS == [
        "https://web.example",
        "https://mobile.example",
    ]


def test_development_secret_is_ephemeral_and_database_password_empty() -> None:
    settings = Settings(
        _env_file=None,
        ENVIRONMENT="development",
        SECRET_KEY=None,
        POSTGRES_PASSWORD="",
    )
    assert settings.SECRET_KEY is not None
    assert len(settings.SECRET_KEY) >= 32
    assert settings.POSTGRES_PASSWORD == ""


def test_production_requires_secret_key() -> None:
    with pytest.raises(ValidationError, match="SECRET_KEY must be set"):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY=None,
            CORS_ORIGINS="https://web.example",
        )


def test_production_rejects_example_secret_placeholder() -> None:
    with pytest.raises(ValidationError, match="example placeholder"):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY="change_this_to_a_random_secret_key_min_32_chars_long",
            CORS_ORIGINS="https://web.example",
        )


def test_production_rejects_wildcard_cors() -> None:
    with pytest.raises(ValidationError, match="must not contain"):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY="s" * 40,
            CORS_ORIGINS="*",
        )


def test_health_endpoint_is_versioned_and_works() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_custom_exception_hierarchy() -> None:
    not_found = ResourceNotFoundException("Resource", "id_1")
    assert not_found.status_code == 404
    assert "Resource with identifier 'id_1' was not found." in not_found.message
    assert isinstance(not_found, ALPRPlatformException)

    invalid_creds = InvalidCredentialsException()
    assert invalid_creds.status_code == 401
    assert "Invalid authentication credentials." in invalid_creds.message
    assert isinstance(invalid_creds, ALPRPlatformException)


@pytest.mark.asyncio
async def test_alpr_exception_handler_returns_formatted_response() -> None:
    request = Request({"type": "http", "method": "GET", "path": "/api/v1/test", "headers": [], "server": ("testserver", 80)})
    exc = ResourceNotFoundException("Vehicle", "ABC-123")
    response = await alpr_exception_handler(request, exc)
    assert response.status_code == 404
    assert b"Vehicle with identifier 'ABC-123' was not found." in response.body


@pytest.mark.asyncio
async def test_global_exception_handler_returns_500_response() -> None:
    request = Request({"type": "http", "method": "GET", "path": "/api/v1/test", "headers": [], "server": ("testserver", 80)})
    exc = RuntimeError("Database crashed unexpectedly")
    response = await global_exception_handler(request, exc)
    assert response.status_code == 500
    assert b"An internal server error occurred." in response.body


def test_settings_environment_defaults() -> None:
    settings = Settings(_env_file=None)
    assert settings.APP_NAME == "VisionPlate AI Backend"
    assert settings.APP_VERSION == "0.1.0"
    assert settings.DEBUG is False
    assert settings.API_V1_PREFIX == "/api/v1"
    assert settings.LOG_LEVEL == "INFO"

