import os
import sys
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.core.database import build_postgres_ssl_context

async def verify_stamp():
    ca_path = os.path.abspath(os.path.join(backend_dir, "prod-ca-2021.crt"))
    ssl_ctx = build_postgres_ssl_context(ca_cert_path=ca_path, verify=True)
    engine = create_async_engine(
        settings.get_database_url(),
        connect_args={
            "ssl": ssl_ctx,
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        }
    )
    async with engine.connect() as conn:
        ver = await conn.scalar(text("SELECT version_num FROM alembic_version;"))
        print(f"Live alembic_version row: {ver}")
        assert ver == "0003_supabase_users", f"Expected 0003_supabase_users, got {ver}"
        
        col = (await conn.execute(text("""
            SELECT column_name, data_type, character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'alembic_version';
        """))).mappings().first()
        print(f"alembic_version column: {dict(col)}")
        
        u_cnt = await conn.scalar(text("SELECT count(*) FROM users;"))
        d_cnt = await conn.scalar(text("SELECT count(*) FROM detections;"))
        v_cnt = await conn.scalar(text("SELECT count(*) FROM vehicles;"))
        print(f"Preserved counts: users={u_cnt}, detections={d_cnt}, vehicles={v_cnt}")
        assert u_cnt == 3 and d_cnt == 5 and v_cnt == 24
        
    await engine.dispose()
    print("TASK E BASELINE STAMP VERIFIED SUCCESSFULLY.")

if __name__ == "__main__":
    asyncio.run(verify_stamp())

