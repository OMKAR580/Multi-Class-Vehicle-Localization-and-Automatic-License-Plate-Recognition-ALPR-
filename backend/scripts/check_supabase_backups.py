import asyncio
import os
import sys
from urllib.parse import urlparse
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.core.database import build_postgres_ssl_context

async def check_backup_status():
    raw_url = settings.get_database_url()
    ssl_ctx = build_postgres_ssl_context(
        ca_cert_path=settings.POSTGRES_CA_CERT_PATH,
        verify=bool(settings.POSTGRES_CA_CERT_PATH),
    )
    
    engine = create_async_engine(
        raw_url,
        connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0, "ssl": ssl_ctx},
    )
    
    async with engine.connect() as conn:
        print("Checking WAL archiver status...")
        try:
            arch = (await conn.execute(text("SELECT * FROM pg_stat_archiver;"))).mappings().all()
            for r in arch:
                print("pg_stat_archiver:", dict(r))
        except Exception as e:
            print("pg_stat_archiver error:", e)
            
        print("\nChecking available extensions...")
        try:
            exts = (await conn.execute(text("SELECT extname, extversion FROM pg_extension WHERE extname LIKE '%backup%' OR extname LIKE '%cron%' OR extname LIKE '%wal%';"))).mappings().all()
            for e in exts:
                print("extension:", dict(e))
        except Exception as e:
            print("extensions error:", e)
            
        print("\nChecking schemas...")
        try:
            schemas = (await conn.execute(text("SELECT schema_name FROM information_schema.schemata;"))).scalars().all()
            print("schemas:", schemas)
        except Exception as e:
            print("schemas error:", e)
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_backup_status())

