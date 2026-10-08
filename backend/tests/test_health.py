"""Backend Health and Routing Tests."""

from fastapi.testclient import TestClient
from app.main import app
from app.schemas.health import HealthResponse


def test_app_startup_import():
    """Test 3: Basic application startup - verify app can be imported and initialized."""
    assert app is not None
    assert app.title == "VisionPlate AI Backend"
    assert app.version == "0.1.0"


def test_health_endpoint_success(client: TestClient):
    """Test 1: Health endpoint - verify GET /api/v1/health returns 200, JSON, healthy status."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "environment" in data


def test_api_v1_routing_mounted(client: TestClient):
    """Test 2: API routing - verify that versioned router is correctly mounted under /api/v1."""
    # /api/v1/health must be found (200), whereas unversioned root /health is not mounted (404)
    v1_response = client.get("/api/v1/health")
    assert v1_response.status_code == 200

    unversioned_response = client.get("/health")
    assert unversioned_response.status_code == 404


def test_health_response_schema_valid():
    """HealthResponse should accept all required fields."""
    resp = HealthResponse(
        status="healthy",
        version="0.1.0",
        environment="testing",
        database="configured",
        redis="configured",
    )
    assert resp.status == "healthy"
    assert resp.version == "0.1.0"
    assert resp.environment == "testing"
    assert resp.database == "configured"
    assert resp.redis == "configured"


def test_health_response_field_names():
    """Ensure all expected fields exist on HealthResponse."""
    required_fields = {"status", "version", "environment", "database", "redis"}
    resp = HealthResponse(
        status="healthy",
        version="0.1.0",
        environment="ci",
        database="ok",
        redis="ok",
    )
    for field in required_fields:
        assert hasattr(resp, field), f"HealthResponse missing field: {field}"


def test_health_response_dict_output():
    """HealthResponse.model_dump() should return all fields."""
    resp = HealthResponse(
        status="healthy",
        version="0.2.0",
        environment="production",
        database="connected",
        redis="connected",
    )
    data = resp.model_dump()
    assert data["status"] == "healthy"
    assert data["version"] == "0.2.0"
