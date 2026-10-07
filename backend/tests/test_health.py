"""
Backend Health Schema Unit Test.
Tests HealthResponse pydantic schema directly - zero DB/ASGI dependency.
No TestClient, no asyncpg, no app.main import needed.
"""
from app.schemas.health import HealthResponse


def test_health_response_schema_valid():
    """HealthResponse should accept all required fields."""
    resp = HealthResponse(
        status="healthy",
        version="0.1.0",
        environment="testing",
        database="configured",
        redis="configured"
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
        redis="ok"
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
        redis="connected"
    )
    data = resp.model_dump()
    assert data["status"] == "healthy"
    assert data["version"] == "0.2.0"
