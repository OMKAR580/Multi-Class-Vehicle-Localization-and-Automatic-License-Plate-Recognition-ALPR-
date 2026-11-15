"""
VisionPlate AI — Phase 07E.9
Strict Read-Only Live Supabase Schema Inspection Script
Connects to Supabase PostgreSQL using application settings and gathers
comprehensive catalog metadata for production readiness verification.
"""

import sys
import os
import json
import asyncio
from urllib.parse import urlparse
import asyncpg

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.core.database import build_postgres_ssl_context

async def run_inspection():
    raw_url = settings.get_database_url()
    parsed = urlparse(raw_url)
    
    # Sanitize and verify host
    print(f"Target Host: {parsed.hostname}")
    print(f"Target Port: {parsed.port}")
    print(f"Target Database: {parsed.path.lstrip('/')}")
    print(f"Connected User: {parsed.username}")
    
    if not parsed.hostname or "supabase.com" not in parsed.hostname:
        print("[ERROR] Aborting: Target host cannot be positively identified as Supabase.")
        sys.exit(1)
        
    # In development mode, use TLS without CA verification since Supabase uses a private Intermediate CA
    # In production, POSTGRES_CA_CERT_PATH will provide the Supabase Root CA
    ssl_ctx = build_postgres_ssl_context(
        ca_cert_path=settings.POSTGRES_CA_CERT_PATH,
        verify=bool(settings.POSTGRES_CA_CERT_PATH),
    )
    
    # Use SQLAlchemy engine for identical connection handling as application
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import text
    
    engine_kwargs = {
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "ssl": ssl_ctx,
    }
    
    print("\nConnecting to Supabase via SQLAlchemy engine (Read-Only Inspection)...")
    async_engine = create_async_engine(
        raw_url,
        connect_args=engine_kwargs,
        echo=False,
    )
    
    print("Testing connection...")
    async with async_engine.connect() as conn:
        print("Successfully connected to live Supabase database!")
        
        report = {}
        
        # 1. Database Identity
        ver = await conn.scalar(text("SELECT version();"))
        db_name = await conn.scalar(text("SELECT current_database();"))
        current_schema = await conn.scalar(text("SELECT current_schema();"))
        current_user = await conn.scalar(text("SELECT current_user;"))
        search_path = await conn.scalar(text("SHOW search_path;"))
        
        report["identity"] = {
            "version": ver,
            "database": db_name,
            "schema": current_schema,
            "user": current_user,
            "search_path": search_path,
        }
        
        # 2. Existing tables in public schema
        res = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """))
        table_names = [row[0] for row in res.fetchall()]
        report["tables"] = table_names
        
        # Check specific tables
        target_tables = [
            "users", "oauth_accounts", "user_identities", "detections",
            "vehicles", "plates", "files", "reports", "audit_logs",
            "report_folders", "alembic_version", "_alembic_0004_state"
        ]
        report["table_existence"] = {t: (t in table_names) for t in target_tables}
        
        # Check row counts
        counts = {}
        for t in table_names:
            if t in target_tables or t in ["_alembic_0004_state", "alembic_version"]:
                try:
                    cnt = await conn.scalar(text(f'SELECT count(*) FROM public."{t}";'))
                    counts[t] = cnt
                except Exception as e:
                    counts[t] = f"Error: {e}"
        report["row_counts"] = counts
        
        # 3. Alembic Version Table Details
        if "alembic_version" in table_names:
            av_col = (await conn.execute(text("""
                SELECT column_name, data_type, character_maximum_length 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'alembic_version' AND column_name = 'version_num';
            """))).mappings().first()
            av_rows = (await conn.execute(text("SELECT * FROM alembic_version;"))).mappings().all()
            report["alembic_version"] = {
                "column": dict(av_col) if av_col else None,
                "rows": [dict(r) for r in av_rows],
            }
        else:
            report["alembic_version"] = None
            
        # 4. _alembic_0004_state Table Details
        if "_alembic_0004_state" in table_names:
            s_rows = (await conn.execute(text("SELECT * FROM _alembic_0004_state;"))).mappings().all()
            report["_alembic_0004_state"] = [dict(r) for r in s_rows]
        else:
            report["_alembic_0004_state"] = None
            
        # 5. Detailed Column Inventory for Target Tables
        table_details = {}
        for t in target_tables:
            if t not in table_names:
                continue
                
            # Columns
            cols = (await conn.execute(text("""
                SELECT 
                    column_name, 
                    data_type, 
                    udt_name,
                    character_maximum_length, 
                    is_nullable, 
                    column_default
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = :tbl
                ORDER BY ordinal_position;
            """), {"tbl": t})).mappings().all()
            
            # Primary key
            pk = (await conn.execute(text("""
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                WHERE tc.table_schema = 'public' AND tc.table_name = :tbl AND tc.constraint_type = 'PRIMARY KEY';
            """), {"tbl": t})).fetchall()
            
            # Foreign keys
            fks = (await conn.execute(text("""
                SELECT
                    tc.constraint_name,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name,
                    rc.delete_rule,
                    rc.update_rule
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                JOIN information_schema.referential_constraints rc
                    ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
                JOIN information_schema.constraint_column_usage ccu
                    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
                WHERE tc.table_schema = 'public' AND tc.table_name = :tbl AND tc.constraint_type = 'FOREIGN KEY';
            """), {"tbl": t})).mappings().all()
            
            # Unique constraints
            uqs = (await conn.execute(text("""
                SELECT
                    tc.constraint_name,
                    kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                WHERE tc.table_schema = 'public' AND tc.table_name = :tbl AND tc.constraint_type = 'UNIQUE';
            """), {"tbl": t})).mappings().all()
            
            # Indexes
            idxs = (await conn.execute(text("""
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = :tbl;
            """), {"tbl": t})).mappings().all()
            
            # Check constraints
            checks = (await conn.execute(text("""
                SELECT tc.constraint_name, cc.check_clause
                FROM information_schema.table_constraints tc
                JOIN information_schema.check_constraints cc
                    ON tc.constraint_name = cc.constraint_name AND tc.table_schema = cc.constraint_schema
                WHERE tc.table_schema = 'public' AND tc.table_name = :tbl AND tc.constraint_type = 'CHECK';
            """), {"tbl": t})).mappings().all()
            
            table_details[t] = {
                "columns": [dict(c) for c in cols],
                "primary_key": [p[0] for p in pk],
                "foreign_keys": [dict(f) for f in fks],
                "unique_constraints": [dict(u) for u in uqs],
                "indexes": [dict(i) for i in idxs],
                "check_constraints": [dict(ch) for ch in checks],
            }
            
        report["table_details"] = table_details
        
        # 6. Check for orphaned records in reports before FK addition
        if "reports" in table_names and "users" in table_names:
            orphaned_users = await conn.scalar(text("""
                SELECT count(*) 
                FROM reports r 
                LEFT JOIN users u ON (r.user_id = u.id)
                WHERE r.user_id IS NOT NULL AND u.id IS NULL;
            """))
            report["reports_orphaned_user_records"] = orphaned_users
        else:
            report["reports_orphaned_user_records"] = None
            
    await async_engine.dispose()
    return report

if __name__ == "__main__":
    rep = asyncio.run(run_inspection())
    with open("backend/scripts/live_supabase_schema_snapshot.json", "w") as f:
        json.dump(rep, f, indent=2, default=str)
    print("\nInspection complete! Detailed snapshot written to backend/scripts/live_supabase_schema_snapshot.json")
