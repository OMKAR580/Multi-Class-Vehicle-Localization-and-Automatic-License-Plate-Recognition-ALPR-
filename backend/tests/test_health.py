"""
Backend Health Endpoint Unit Test.
Uses FastAPI TestClient. No DB mocking needed:
  - create_async_engine() creates an object but does NOT open a connection.
  - The /health endpoint does NOT inject get_db at all.
So the test runs end-to-end with zero real DB interaction.
"""
from fastapi.testclient import TestClient
from app.main import app


def test_health_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "0.1.0"
        assert "environment" in data


def test_health_response_fields():
    """Verify all required HealthResponse fields are present."""
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
        data = response.json()
        required_fields = {"status", "version", "environment", "database", "redis"}
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
