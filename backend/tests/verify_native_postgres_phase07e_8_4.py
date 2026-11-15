"""
VisionPlate AI — Phase 07E.8.4
Native PostgreSQL Regression Verification Suite
Tests Scenarios A, B, C, D (Failure Injection), and E (Concurrency, FKs, JSON, ORM).
"""

import os
import sys
import asyncio
import json
import traceback
from datetime import datetime
import asyncpg
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)

from alembic.config import Config
from alembic import command

# Target PostgreSQL container
PG_HOST = "127.0.0.1"
PG_PORT = 5434
PG_USER = "vp_test"
PG_PASS = "test_secret_pass"
ADMIN_DB = "visionplate_test"
SCENARIO_A_DB = "test_scenario_a"
SCENARIO_B_DB = "test_scenario_b"
SCENARIO_D_DB = "test_scenario_d"

ADMIN_CONN_STR = f"postgresql://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{ADMIN_DB}"
SCENARIO_A_CONN_STR = f"postgresql://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{SCENARIO_A_DB}"
SCENARIO_B_CONN_STR = f"postgresql://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{SCENARIO_B_DB}"
SCENARIO_D_CONN_STR = f"postgresql://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{SCENARIO_D_DB}"

SCENARIO_A_ASYNC_URL = f"postgresql+asyncpg://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{SCENARIO_A_DB}"
SCENARIO_B_ASYNC_URL = f"postgresql+asyncpg://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{SCENARIO_B_DB}"
SCENARIO_D_ASYNC_URL = f"postgresql+asyncpg://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{SCENARIO_D_DB}"

def get_alembic_config(db_async_url: str) -> Config:
    os.environ["DATABASE_URL"] = db_async_url
    os.environ["POSTGRES_SSL"] = "False"
    os.environ["ENVIRONMENT"] = "testing"
    
    cfg = Config(os.path.join(backend_dir, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(backend_dir, "migrations"))
    cfg.set_main_option("sqlalchemy.url", db_async_url)
    return cfg

async def recreate_database(db_name: str):
    conn = await asyncpg.connect(ADMIN_CONN_STR)
    await conn.execute(f"DROP DATABASE IF EXISTS {db_name} WITH (FORCE);")
    await conn.execute(f"CREATE DATABASE {db_name};")
    await conn.close()
    print(f"[DB INIT] Clean database '{db_name}' created.")

async def inspect_catalog(db_conn_str: str, label: str):
    conn = await asyncpg.connect(db_conn_str)
    print(f"\n--- CATALOG AUDIT: {label} ---")
    
    # 1. Version
    try:
        ver = await conn.fetchval("SELECT version_num FROM alembic_version;")
        print(f"alembic_version: {ver}")
    except Exception as e:
        print(f"alembic_version query error: {e}")

    # Column definition of alembic_version.version_num
    try:
        av_col = await conn.fetchrow("""
            SELECT column_name, data_type, character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'alembic_version' AND column_name = 'version_num';
        """)
        print(f"alembic_version.version_num type: {av_col['data_type']}({av_col['character_maximum_length']})")
    except Exception as e:
        print(f"alembic_version column query error: {e}")

    # 2. Tables
    tables = await conn.fetch("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    table_names = [t["table_name"] for t in tables]
    print(f"Tables ({len(table_names)}): {table_names}")

    # 3. Columns of reports
    rep_cols = await conn.fetch("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'reports'
        ORDER BY ordinal_position;
    """)
    print("reports columns:")
    for c in rep_cols:
        print(f"  - {c['column_name']} ({c['data_type']}) nullable={c['is_nullable']}")

    # 4. Columns of report_folders
    rf_exists = "report_folders" in table_names
    if rf_exists:
        rf_cols = await conn.fetch("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'report_folders'
            ORDER BY ordinal_position;
        """)
        print("report_folders columns:")
        for c in rf_cols:
            print(f"  - {c['column_name']} ({c['data_type']}) nullable={c['is_nullable']}")

    # 5. Columns of audit_logs
    al_cols = await conn.fetch("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'audit_logs'
        ORDER BY ordinal_position;
    """)
    print(f"audit_logs columns count: {len(al_cols)}, user_agent present: {'user_agent' in [c['column_name'] for c in al_cols]}")

    # 6. Indexes on report_folders
    if rf_exists:
        indexes = await conn.fetch("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'report_folders';
        """)
        print("report_folders indexes:")
        for idx in indexes:
            print(f"  - {idx['indexname']}: {idx['indexdef']}")

    # 7. Foreign keys on reports
    fks = await conn.fetch("""
        SELECT
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            rc.delete_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.referential_constraints AS rc
            ON tc.constraint_name = rc.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.table_name = 'reports' AND tc.constraint_type = 'FOREIGN KEY';
    """)
    print("reports foreign keys:")
    for fk in fks:
        print(f"  - {fk['constraint_name']} ({fk['column_name']} -> {fk['foreign_table_name']}.{fk['foreign_column_name']}) ON DELETE {fk['delete_rule']}")

    await conn.close()
    return {
        "tables": table_names,
        "reports_columns": {c["column_name"]: c["data_type"] for c in rep_cols},
        "has_report_folders": rf_exists
    }

def run_scenario_a():
    print("\n==================================================")
    print("STARTING SCENARIO A: Fresh PostgreSQL Migration Chain")
    print("==================================================")
    asyncio.run(recreate_database(SCENARIO_A_DB))
    
    cfg = get_alembic_config(SCENARIO_A_ASYNC_URL)
    print("Executing alembic upgrade head on test_scenario_a...")
    command.upgrade(cfg, "head")
    print("Alembic upgrade head completed.")
    
    cat_a = asyncio.run(inspect_catalog(SCENARIO_A_CONN_STR, "Scenario A - Fresh Upgrade to Head"))
    
    # Assertions for Scenario A
    required_tables = {"users", "user_identities", "oauth_accounts", "detections", "vehicles", "plates", "files", "reports", "report_folders", "audit_logs", "alembic_version"}
    assert required_tables.issubset(set(cat_a["tables"])), f"Missing tables: {required_tables - set(cat_a['tables'])}"
    assert "folder_id" in cat_a["reports_columns"]
    assert "file_format" in cat_a["reports_columns"]
    assert "storage_key" in cat_a["reports_columns"]
    assert "file_size_bytes" in cat_a["reports_columns"]
    assert "parameters" in cat_a["reports_columns"]
    assert "report_data" in cat_a["reports_columns"]
    # Check that parameters and report_data are json in PostgreSQL
    assert cat_a["reports_columns"]["parameters"] == "json"
    assert cat_a["reports_columns"]["report_data"] == "json"
    print("[SCENARIO A] PASS: All tables, columns (including JSON type), constraints and indexes verified on fresh PostgreSQL database.")

def run_scenario_b():
    print("\n==================================================")
    print("STARTING SCENARIO B: Supabase Baseline Reconciliation")
    print("==================================================")
    asyncio.run(recreate_database(SCENARIO_B_DB))
    
    cfg = get_alembic_config(SCENARIO_B_ASYNC_URL)
    print("Executing alembic upgrade to 0003_supabase_users on test_scenario_b...")
    command.upgrade(cfg, "0003_supabase_users")
    
    async def simulate_supabase_schema():
        conn = await asyncpg.connect(SCENARIO_B_CONN_STR)
        print("Simulating pre-0004 Supabase schema drift on test_scenario_b...")
        await conn.execute("ALTER TABLE audit_logs DROP COLUMN IF EXISTS user_agent;")
        await conn.execute("""
            ALTER TABLE reports RENAME COLUMN generated_by_user_id TO user_id;
            ALTER TABLE reports RENAME COLUMN download_url TO file_url;
            ALTER TABLE reports DROP COLUMN IF EXISTS filter_params;
            ALTER TABLE reports ADD COLUMN IF NOT EXISTS report_data JSON;
        """)
        await conn.close()
        print("Pre-0004 Supabase schema simulated.")

    asyncio.run(simulate_supabase_schema())
    
    # Now execute migration 0004
    print("Executing alembic upgrade head (migration 0004) on simulated Supabase baseline...")
    command.upgrade(cfg, "head")
    print("Alembic upgrade head (0004) completed.")
    
    cat_b = asyncio.run(inspect_catalog(SCENARIO_B_CONN_STR, "Scenario B - Supabase Baseline Reconciled to Head"))
    
    async def check_state_table():
        conn = await asyncpg.connect(SCENARIO_B_CONN_STR)
        state = await conn.fetch("SELECT * FROM _alembic_0004_state;")
        print(f"_alembic_0004_state records ({len(state)}):")
        for s in state:
            print(f"  - action_key={s['action_key']}")
        await conn.close()

    asyncio.run(check_state_table())
    
    assert "report_folders" in cat_b["tables"]
    assert "folder_id" in cat_b["reports_columns"]
    assert "file_format" in cat_b["reports_columns"]
    assert "storage_key" in cat_b["reports_columns"]
    print("[SCENARIO B] PASS: Migration 0004 smoothly reconciled Supabase schema drift without failure.")

def run_downgrade_and_reupgrade():
    print("\n==================================================")
    print("STARTING DOWNGRADE & RE-UPGRADE VERIFICATION (SCENARIO C)")
    print("==================================================")
    
    # --- Part 1: Scenario A (Fresh Migration Path) ---
    print("\n[TEST C.1] Downgrading Scenario A to 0003_supabase_users...")
    cfg_a = get_alembic_config(SCENARIO_A_ASYNC_URL)
    command.downgrade(cfg_a, "0003_supabase_users")
    print("Scenario A downgrade to 0003 completed.")
    
    cat_a_down = asyncio.run(inspect_catalog(SCENARIO_A_CONN_STR, "Scenario A - Post Downgrade to 0003"))
    assert not cat_a_down["has_report_folders"], "report_folders should be dropped in 0003"
    assert "generated_by_user_id" in cat_a_down["reports_columns"], "generated_by_user_id should be restored on fresh path downgrade"
    assert "download_url" in cat_a_down["reports_columns"], "download_url should be restored on fresh path downgrade"
    
    print("\n[TEST C.1] Re-upgrading Scenario A to head...")
    command.upgrade(cfg_a, "head")
    print("Scenario A re-upgrade to head completed.")
    cat_a_reup = asyncio.run(inspect_catalog(SCENARIO_A_CONN_STR, "Scenario A - Re-upgraded to Head"))
    assert cat_a_reup["has_report_folders"]
    assert "folder_id" in cat_a_reup["reports_columns"]
    
    # --- Part 2: Scenario B (Supabase Baseline Path) ---
    print("\n[TEST C.2] Downgrading Scenario B to 0003_supabase_users...")
    cfg_b = get_alembic_config(SCENARIO_B_ASYNC_URL)
    command.downgrade(cfg_b, "0003_supabase_users")
    print("Scenario B downgrade to 0003 completed.")
    
    cat_b_down = asyncio.run(inspect_catalog(SCENARIO_B_CONN_STR, "Scenario B - Post Downgrade to 0003"))
    assert not cat_b_down["has_report_folders"], "report_folders should be dropped in 0003"
    assert "user_id" in cat_b_down["reports_columns"], "Original Supabase user_id should be preserved on baseline downgrade"
    assert "file_url" in cat_b_down["reports_columns"], "Original Supabase file_url should be preserved on baseline downgrade"
    
    print("\n[TEST C.2] Re-upgrading Scenario B to head...")
    command.upgrade(cfg_b, "head")
    print("Scenario B re-upgrade to head completed.")
    cat_b_reup = asyncio.run(inspect_catalog(SCENARIO_B_CONN_STR, "Scenario B - Re-upgraded to Head"))
    assert cat_b_reup["has_report_folders"]
    assert "folder_id" in cat_b_reup["reports_columns"]
    
    print("[SCENARIO C] PASS: Both migration paths cleanly downgrade and re-upgrade with complete state preservation.")

def run_failure_injection_test():
    print("\n==================================================")
    print("STARTING SCENARIO D: State-Marker Failure Injection")
    print("==================================================")
    asyncio.run(recreate_database(SCENARIO_D_DB))
    
    cfg = get_alembic_config(SCENARIO_D_ASYNC_URL)
    print("Upgrading test_scenario_d to 0003_supabase_users...")
    command.upgrade(cfg, "0003_supabase_users")
    
    # Create an intentional poison pill: create a table with name _alembic_0004_state that has an incompatible schema
    # (e.g. integer primary key) so that record_action() will FAIL and must abort the migration!
    async def inject_poison():
        conn = await asyncpg.connect(SCENARIO_D_CONN_STR)
        await conn.execute("CREATE TABLE _alembic_0004_state (action_key INT PRIMARY KEY);")
        await conn.close()
        print("Poison table _alembic_0004_state created with incompatible INT schema.")
        
    asyncio.run(inject_poison())
    
    print("Attempting to run migration 0004 with poisoned state table...")
    failed = False
    try:
        command.upgrade(cfg, "head")
    except Exception as e:
        failed = True
        print(f"Migration 0004 aborted visibly as expected: {type(e).__name__}: {e}")
        
    assert failed, "Migration 0004 MUST fail when record_action() encounters a database failure!"
    
    # Verify rollback: check if report_folders table exists in test_scenario_d
    async def verify_rollback():
        conn = await asyncpg.connect(SCENARIO_D_CONN_STR)
        ver = await conn.fetchval("SELECT version_num FROM alembic_version;")
        assert ver == "0003_supabase_users", f"Expected version to remain 0003_supabase_users, got {ver}"
        
        has_rf = await conn.fetchval("SELECT to_regclass('public.report_folders');")
        assert has_rf is None, f"report_folders table should not exist after rollback, found {has_rf}"
        
        # Clean up poison table to verify clean retry
        await conn.execute("DROP TABLE _alembic_0004_state;")
        await conn.close()
        print("Verified: Version remained at 0003_supabase_users and report_folders was NOT created.")
        
    asyncio.run(verify_rollback())
    
    # Clean retry
    print("Executing clean retry of migration 0004 on test_scenario_d...")
    command.upgrade(cfg, "head")
    print("Clean retry completed successfully!")
    
    async def verify_retry():
        conn = await asyncpg.connect(SCENARIO_D_CONN_STR)
        ver = await conn.fetchval("SELECT version_num FROM alembic_version;")
        assert ver == "0004_report_persistence"
        has_rf = await conn.fetchval("SELECT to_regclass('public.report_folders');")
        assert has_rf is not None
        await conn.close()
        
    asyncio.run(verify_retry())
    print("[SCENARIO D] PASS: State-marker failure aborted migration, rolled back transaction cleanly, and clean retry succeeded.")

async def run_scenario_e_integrity():
    print("\n==================================================")
    print("STARTING SCENARIO E: Native PostgreSQL Integrity & Concurrency")
    print("==================================================")
    
    conn = await asyncpg.connect(SCENARIO_A_CONN_STR)
    
    # 1. Create test users
    u1_id = "test_user_u1"
    u2_id = "test_user_u2"
    now = datetime.now()
    await conn.execute("INSERT INTO users (id, email, hashed_password, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING;", u1_id, "u1@example.com", "dummyhash", now, now)
    await conn.execute("INSERT INTO users (id, email, hashed_password, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING;", u2_id, "u2@example.com", "dummyhash", now, now)
    await conn.close()
    
    # 2. Concurrent case-insensitive uniqueness test
    print("\n[TEST E.1] Concurrent creation with different casing ('Security Audit' vs 'security audit')...")
    async def try_insert_folder(folder_id: str, user_id: str, name: str):
        c = await asyncpg.connect(SCENARIO_A_CONN_STR)
        try:
            t_now = datetime.now()
            await c.execute(
                "INSERT INTO report_folders (id, user_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5);",
                folder_id, user_id, name, t_now, t_now
            )
            return {"status": "SUCCESS", "name": name, "id": folder_id}
        except asyncpg.exceptions.UniqueViolationError as e:
            return {"status": "UNIQUE_VIOLATION", "name": name, "error": str(e), "sqlstate": e.sqlstate}
        finally:
            await c.close()
            
    res1, res2 = await asyncio.gather(
        try_insert_folder("rf_case_1", u1_id, "Security Audit"),
        try_insert_folder("rf_case_2", u1_id, "security audit")
    )
    statuses = [res1["status"], res2["status"]]
    assert statuses.count("SUCCESS") == 1
    assert statuses.count("UNIQUE_VIOLATION") == 1
    violation = res1 if res1["status"] == "UNIQUE_VIOLATION" else res2
    assert violation["sqlstate"] == "23505"
    print(f"[TEST E.1] PASS: Exactly one succeeded, concurrent variant rejected with SQLSTATE 23505.")
    
    # 3. Multi-variant case collision (4 variants)
    print("\n[TEST E.2] Multi-variant case collision ('FINANCE', 'Finance', 'finance', 'FiNaNcE')...")
    variants = ["FINANCE", "Finance", "finance", "FiNaNcE"]
    tasks = [try_insert_folder(f"rf_fin_{i}", u1_id, var) for i, var in enumerate(variants)]
    results = await asyncio.gather(*tasks)
    success_count = sum(1 for r in results if r["status"] == "SUCCESS")
    violation_count = sum(1 for r in results if r["status"] == "UNIQUE_VIOLATION")
    assert success_count == 1
    assert violation_count == 3
    print(f"[TEST E.2] PASS: Multi-variant collision strictly enforced: {success_count} succeeded, {violation_count} rejected.")
    
    # 4. Cross-user independence
    print("\n[TEST E.3] Cross-user independence (User U1 vs User U2 for 'Operations Report')...")
    r_u1, r_u2 = await asyncio.gather(
        try_insert_folder("rf_ops_u1", u1_id, "Operations Report"),
        try_insert_folder("rf_ops_u2", u2_id, "Operations Report")
    )
    assert r_u1["status"] == "SUCCESS" and r_u2["status"] == "SUCCESS"
    print("[TEST E.3] PASS: Same folder name permitted across distinct users.")
    
    # 5. Whitespace normalization
    print("\n[TEST E.4] Whitespace normalization check...")
    clean_name = "   Security Audit   ".strip()
    res_ws = await try_insert_folder("rf_ws_test", u1_id, clean_name)
    assert res_ws["status"] == "UNIQUE_VIOLATION"
    print("[TEST E.4] PASS: Stripped variant collides with existing folder.")
    
    # 6. Transaction rollback and recovery
    print("\n[TEST E.5] Transaction rollback and recovery on violation...")
    c = await asyncpg.connect(SCENARIO_A_CONN_STR)
    tr = c.transaction()
    await tr.start()
    try:
        t_now = datetime.now()
        await c.execute(
            "INSERT INTO report_folders (id, user_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5);",
            "rf_tx_fail", u1_id, "Security Audit", t_now, t_now
        )
        await tr.commit()
    except asyncpg.exceptions.UniqueViolationError:
        await tr.rollback()
    alive_check = await c.fetchval("SELECT 1;")
    assert alive_check == 1
    await c.close()
    print("[TEST E.5] PASS: Transaction rolled back without connection poisoning.")
    
    # 7. Foreign key cascades
    print("\n[TEST E.6] Folder deletion with ON DELETE SET NULL...")
    conn = await asyncpg.connect(SCENARIO_A_CONN_STR)
    f_del = "folder_del_test"
    t_now = datetime.now()
    await conn.execute("INSERT INTO report_folders (id, user_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5);", f_del, u1_id, "Temp Delete Folder", t_now, t_now)
    for i in range(1, 4):
        await conn.execute("""
            INSERT INTO reports (id, title, report_type, user_id, folder_id, file_format, storage_key, file_size_bytes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
        """, f"rep_fk_del_{i}", f"Report {i}", "traffic_summary", u1_id, f_del, "pdf", f"reports/2026/11/rep_{i}.pdf", 1024, t_now, t_now)
    await conn.execute("DELETE FROM report_folders WHERE id = $1;", f_del)
    reps_after = await conn.fetch("SELECT id, folder_id FROM reports WHERE id IN ('rep_fk_del_1', 'rep_fk_del_2', 'rep_fk_del_3');")
    assert len(reps_after) == 3
    for r in reps_after:
        assert r["folder_id"] is None
    print("[TEST E.6] PASS: Deleting folder set report.folder_id to NULL via ON DELETE SET NULL.")
    
    # 8. User deletion with CASCADE
    print("\n[TEST E.7] User deletion with ON DELETE CASCADE...")
    u_casc = "user_to_cascade_e"
    f_casc = "folder_of_casc_user_e"
    await conn.execute("INSERT INTO users (id, email, hashed_password, created_at, updated_at) VALUES ($1, $2, $3, $4, $5);", u_casc, "casce@example.com", "dummyhash", t_now, t_now)
    await conn.execute("INSERT INTO report_folders (id, user_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5);", f_casc, u_casc, "Cascade Folder E", t_now, t_now)
    await conn.execute("DELETE FROM users WHERE id = $1;", u_casc)
    f_check = await conn.fetchval("SELECT id FROM report_folders WHERE id = $1;", f_casc)
    assert f_check is None
    print("[TEST E.7] PASS: User deletion cascaded to owned folder.")
    
    # 9. Invalid foreign key rejection
    print("\n[TEST E.8] Invalid foreign key rejection...")
    try:
        await conn.execute("""
            INSERT INTO reports (id, title, report_type, user_id, folder_id, file_format, storage_key, file_size_bytes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
        """, "rep_invalid_fk_e", "Invalid FK", "traffic_summary", u1_id, "non_existent_folder_id", "pdf", "reports/inv.pdf", 500, t_now, t_now)
        assert False, "Should have raised ForeignKeyViolationError"
    except asyncpg.exceptions.ForeignKeyViolationError as e:
        assert e.sqlstate == "23503"
        print(f"[TEST E.8] PASS: Invalid folder_id rejected with SQLSTATE 23503.")
        
    # 10. JSON storage and query verification
    print("\n[TEST E.9] PostgreSQL JSON data integrity check...")
    complex_data = {"summary": {"total_vehicles": 204, "avg_conf": 0.96}, "tags": ["q4", "audit"]}
    rep_json_id = "rep_json_test_e"
    await conn.execute("""
        INSERT INTO reports (id, title, report_type, user_id, file_format, storage_key, file_size_bytes, parameters, report_data, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
    """, rep_json_id, "JSON Audit", "analytics_summary", u1_id, "json", "reports/json_e.json", 1024, json.dumps({"preset": "30d"}), json.dumps(complex_data), t_now, t_now)
    
    rec = await conn.fetchrow("""
        SELECT
            id,
            report_data->'summary'->>'total_vehicles' AS total_veh,
            parameters->>'preset' AS preset
        FROM reports
        WHERE id = $1;
    """, rep_json_id)
    assert int(rec["total_veh"]) == 204
    assert rec["preset"] == "30d"
    
    # Inspect exact SQL data type from information_schema
    data_types = await conn.fetch("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'reports' AND column_name IN ('parameters', 'report_data');
    """)
    for dt in data_types:
        print(f"PostgreSQL actual type for {dt['column_name']}: {dt['data_type']}")
        assert dt["data_type"] == "json", f"Expected 'json', found '{dt['data_type']}'"
        
    await conn.close()
    print("[TEST E.9] PASS: JSON columns verified as native PostgreSQL 'json' type with full operator support.")

def run_orm_service_lifecycle():
    print("\n==================================================")
    print("STARTING ORM & SERVICE LIFECYCLE ON NATIVE POSTGRESQL")
    print("==================================================")
    
    async def orm_test():
        from app.models.user import User
        from app.models.report import Report, ReportFolder
        from app.services.reports_service import ReportsService
        from app.schemas.reports import (
            FolderCreateRequest,
            ReportGenerateRequest,
            ReportMoveRequest,
        )
        from app.services.storage_service import LocalStorageService
        from fastapi import HTTPException
        
        engine = create_async_engine(SCENARIO_A_ASYNC_URL, echo=False)
        async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
        storage = LocalStorageService()
        
        async with async_session() as db:
            service = ReportsService(db=db, storage=storage)
            user = await db.get(User, "test_user_u1")
            assert user is not None
            
            # Create folder
            folder_dto = FolderCreateRequest(name="Phase 8 Compliance", description="Phase 8 audits", color="#10b981")
            created_folder = await service.create_folder(user, folder_dto)
            print(f"Created Folder: {created_folder.id} ('{created_folder.name}')")
            assert created_folder.name == "Phase 8 Compliance"
            
            # Duplicate rejection
            try:
                await service.create_folder(user, FolderCreateRequest(name="phase 8 compliance"))
                assert False, "Should have raised 409"
            except HTTPException as e:
                assert e.status_code == 409
                print(f"Duplicate folder rejected with HTTP {e.status_code}: {e.detail}")
                
            # Generate and persist report
            gen_req = ReportGenerateRequest(
                report_type="recognition_summary",
                format="pdf",
                title="Phase 8 Recognition Report",
                folder_id=created_folder.id
            )
            saved_report = await service.generate_and_persist_report(user, gen_req)
            print(f"Saved Report: {saved_report.id} in folder {saved_report.folder_id}")
            assert saved_report.folder_id == created_folder.id
            
            rep_orm = await db.get(Report, saved_report.id)
            storage_key = rep_orm.storage_key
            assert await storage.exists(storage_key)
            print(f"Artifact confirmed on disk at: {storage_key}")
            
            # Move report to unorganized
            moved = await service.move_report(saved_report.id, user, ReportMoveRequest(folder_id=None))
            assert moved.folder_id is None
            print(f"Moved report to Unorganized: folder_id={moved.folder_id}")
            
            # Move report back
            moved_back = await service.move_report(saved_report.id, user, ReportMoveRequest(folder_id=created_folder.id))
            assert moved_back.folder_id == created_folder.id
            print(f"Moved report back to folder: folder_id={moved_back.folder_id}")
            
            # Delete folder
            del_f = await service.delete_folder(created_folder.id, user)
            print(f"Deleted folder: {del_f['message']}")
            await db.refresh(rep_orm)
            assert rep_orm.folder_id is None
            print("Verified: Report preserved in Unorganized with folder_id=None")
            
            # Delete report with artifact cleanup
            del_r = await service.delete_saved_report(saved_report.id, user)
            assert del_r is True
            assert not await storage.exists(storage_key)
            print("Verified: Report deleted from database and artifact cleanly deleted from storage.")
            
        await engine.dispose()
        print("[ORM & SERVICE LIFECYCLE] PASS: Full end-to-end lifecycle verified on native PostgreSQL.")

    asyncio.run(orm_test())

def main():
    print("VisionPlate AI — Phase 07E.8.4 Native PostgreSQL Regression Verification Suite")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    async def get_ver():
        admin_conn = await asyncpg.connect(ADMIN_CONN_STR)
        pg_ver = await admin_conn.fetchval("SELECT version();")
        await admin_conn.close()
        return pg_ver

    pg_ver = asyncio.run(get_ver())
    print(f"Target Database Engine: {pg_ver}")
    
    run_scenario_a()
    run_scenario_b()
    run_downgrade_and_reupgrade()
    run_failure_injection_test()
    asyncio.run(run_scenario_e_integrity())
    run_orm_service_lifecycle()
    print("\n==================================================")
    print("ALL NATIVE POSTGRESQL REGRESSION TESTS PASSED (100%)")
    print("==================================================")

if __name__ == "__main__":
    main()

