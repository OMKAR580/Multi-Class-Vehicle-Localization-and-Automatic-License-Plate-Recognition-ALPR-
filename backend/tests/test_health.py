"""
Backend Health Endpoint Unit Test.
Uses FastAPI TestClient with a mocked DB session to avoid real DB dependency.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient


# Patch the DB engine creation BEFORE importing app to prevent asyncpg connection
_mock_engine = MagicMock()
_mock_session = MagicMock()

with patch("sqlalchemy.ext.asyncio.create_async_engine", return_value=_mock_engine), \
     patch("sqlalchemy.orm.sessionmaker", return_value=MagicMock()):
    from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "0.1.0"
    assert "environment" in data
