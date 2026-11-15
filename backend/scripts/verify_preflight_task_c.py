import os
import sys
import json
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.core.database import build_postgres_ssl_context

async def run_preflight():
    ca_path = os.path.abspath(os.path.join(backend_dir, "prod-ca-2021.crt"))
    ssl_ctx = build_postgres_ssl_context(ca_cert_path=ca_path, verify=True)
    raw_url = settings.get_database_url()

    engine = create_async_engine(
        raw_url,
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "ssl": ssl_ctx,
        },
        echo=False,
    )

    print("Executing Task C Preflight over strict TLS...")
    async with engine.connect() as conn:
        ver = await conn.scalar(text("SELECT version();"))
        db = await conn.scalar(text("SELECT current_database();"))
        schema = await conn.scalar(text("SELECT current_schema();"))
        role = await conn.scalar(text("SELECT current_user;"))
        search_path = await conn.scalar(text("SHOW search_path;"))
        
        print(f"Database Identity: {db} (role: {role}, schema: {schema}, search_path: {search_path})")
        print(f"Engine Version: {ver}")
        
        # Check alembic_version
        av_exists = await conn.scalar(text("SELECT to_regclass('public.alembic_version');"))
        print(f"alembic_version table exists: {av_exists is not None}")
        assert av_exists is None, f"alembic_version already exists: {av_exists}"
        
        # Check report_folders
        rf_exists = await conn.scalar(text("SELECT to_regclass('public.report_folders');"))
        print(f"report_folders table exists: {rf_exists is not None}")
        assert rf_exists is None, f"report_folders already exists: {rf_exists}"
        
        # Check table inventory
        res = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """))
        tables = [r[0] for r in res.fetchall()]
        print(f"Public tables ({len(tables)}): {tables}")
        
        # Row counts
        counts = {}
        target_tables = ["users", "oauth_accounts", "user_identities", "detections", "vehicles", "plates", "files", "reports", "audit_logs"]
        for t in target_tables:
            cnt = await conn.scalar(text(f'SELECT count(*) FROM public."{t}";'))
            counts[t] = cnt
            print(f"  Row count for {t}: {cnt}")
            
        assert counts["users"] >= 1, "Expected existing users"
        assert counts["detections"] >= 1, "Expected existing detections"
        assert counts["reports"] == 0, "Expected 0 reports before migration"
        
        # Reports columns
        rep_cols = (await conn.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'reports'
            ORDER BY ordinal_position;
        """))).fetchall()
        rep_col_dict = {c[0]: c[1] for c in rep_cols}
        print("Reports columns:", list(rep_col_dict.keys()))
        assert "user_id" in rep_col_dict
        assert "file_url" in rep_col_dict
        assert "report_data" in rep_col_dict
        assert "folder_id" not in rep_col_dict, "folder_id already exists"
        assert "storage_key" not in rep_col_dict, "storage_key already exists"
        
        # Audit logs columns
        al_cols = (await conn.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'audit_logs'
            ORDER BY ordinal_position;
        """))).fetchall()
        al_col_dict = {c[0]: c[1] for c in al_cols}
        print("Audit logs columns count:", len(al_col_dict))
        assert "user_agent" not in al_col_dict, "user_agent should be absent before migration"
        
    await engine.dispose()
    print("\nTASK C PREFLIGHT VERIFICATION PASSED (100% MATCH WITH PHASE 07E.9)")

if __name__ == "__main__":
    asyncio.run(run_preflight())

