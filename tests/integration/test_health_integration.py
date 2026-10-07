"""
Integration test: Backend Health Endpoint.
Requires backend service running. Skip unless INTEGRATION_TESTS=1 is set.
"""
import pytest

try:
    import sys
    import os
    sys.path.insert(0, os.path.abspath("backend"))
    from fastapi.testclient import TestClient
    from app.main import app
    BACKEND_AVAILABLE = True
except ImportError:
    BACKEND_AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not BACKEND_AVAILABLE,
    reason="Backend dependencies not installed. Run: pip install -r backend/requirements.txt"
)


@pytest.mark.skipif(not BACKEND_AVAILABLE, reason="Backend not available")
def test_health_check_integration():
    client = TestClient(app)
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"
