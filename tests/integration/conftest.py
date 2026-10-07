"""
Integration tests conftest.
These tests require a running backend (FastAPI + DB), so they are skipped
unless the INTEGRATION_TESTS environment variable is set to '1'.
"""
import os
import pytest


def pytest_collection_modifyitems(config, items):
    """Skip all integration tests unless INTEGRATION_TESTS=1 is set."""
    if not os.environ.get("INTEGRATION_TESTS"):
        skip_integration = pytest.mark.skip(
            reason="Integration tests disabled. Set INTEGRATION_TESTS=1 to enable."
        )
        for item in items:
            item.add_marker(skip_integration)
