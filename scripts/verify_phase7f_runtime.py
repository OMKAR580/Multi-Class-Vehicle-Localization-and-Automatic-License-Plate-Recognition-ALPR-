import os
import sys
import shutil
from pathlib import Path
from urllib.parse import urlparse

backend_dir = os.path.abspath("backend")
sys.path.insert(0, backend_dir)
sys.path.insert(0, os.path.abspath("."))

from app.core.config import settings
from app.core.database import build_postgres_ssl_context
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import asyncio

async def check_backend():
    print("=== TASK A: BACKEND RUNTIME VERIFICATION ===")
    
    # 1. Config & Environment Variables
    print(f"App Name: {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"PostgreSQL SSL Verify: {settings.POSTGRES_SSL_VERIFY}")
    ca_path = os.path.abspath(os.path.join(backend_dir, "prod-ca-2021.crt"))
    print(f"CA Cert Exists: {os.path.isfile(ca_path)}")
    assert os.path.isfile(ca_path), "Missing prod-ca-2021.crt"
    
    # 2. Database Connection over TLS
    print("Connecting to live database over TLS...")
    ssl_ctx = build_postgres_ssl_context(ca_cert_path=ca_path, verify=True)
    engine = create_async_engine(
        settings.get_database_url(),
        connect_args={"ssl": ssl_ctx, "statement_cache_size": 0, "prepared_statement_cache_size": 0}
    )
    async with engine.connect() as conn:
        ver = await conn.scalar(text("SELECT version();"))
        print(f"PostgreSQL Version: {ver[:60]}...")
        av = await conn.scalar(text("SELECT version_num FROM alembic_version;"))
        print(f"Alembic Version: {av}")
        assert av == "0004_report_persistence"
    await engine.dispose()
    print("Database connection verified.")

    # 3. Model Checkpoints & AI Pipeline
    print("Verifying model files...")
    models = ["ai/models/best.pt", "ai/models/yolov8_plate.pt", "ai/models/yolov8_vehicle.pt"]
    for m in models:
        assert os.path.isfile(m), f"Missing model: {m}"
        print(f"  {m} ({os.path.getsize(m)} bytes) verified.")

    # 4. Storage Directories
    print("Verifying storage directories...")
    storage_root = os.path.abspath(settings.STORAGE_LOCAL_ROOT or "storage")
    os.makedirs(storage_root, exist_ok=True)
    test_file = os.path.join(storage_root, "write_test.tmp")
    with open(test_file, "w") as f:
        f.write("write_ok")
    assert os.path.isfile(test_file)
    os.remove(test_file)
    print(f"  Storage directory '{storage_root}' writable.")

    # 5. FastAPI App Lifespan and Route Registration
    from app.main import app
    route_paths = list(app.openapi()["paths"].keys())
                    
    print(f"FastAPI registered {len(route_paths)} routes.")
    assert "/docs" in [getattr(r, "path", None) for r in app.routes]
    assert any("/auth" in p for p in route_paths)
    assert any("/recognition" in p or "/detect" in p for p in route_paths)
    assert any("/reports" in p for p in route_paths)
    assert any("/dashboard" in p for p in route_paths)
    assert any("/analytics" in p for p in route_paths)
    print("FastAPI application initialized successfully.")

if __name__ == "__main__":
    asyncio.run(check_backend())
