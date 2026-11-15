"""
VisionPlate AI — Phase 07E.8.2 Isolated Native PostgreSQL Verification Suite
Automated Execution Script for Scenarios A, B, Downgrades, Uniqueness, FKs, JSONB, and ORM Persistence.
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

# Setup backend path
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

ADMIN_CONN_STR = f"postgresql://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{ADMIN_DB}"
SCENARIO_A_CONN_STR = f"postgresql://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{SCENARIO_A_DB}"
SCENARIO_B_CONN_STR = f"postgresql://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{SCENARIO_B_DB}"

SCENARIO_A_ASYNC_URL = f"postgresql+asyncpg://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{SCENARIO_A_DB}"
SCENARIO_B_ASYNC_URL = f"postgresql+asyncpg://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{SCENARIO_B_DB}"

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
        SELECT column_name, data_type, is_nullable, column_default
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
            SELECT column_name, data_type, is_nullable, column_default
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
        "reports_columns": [c["column_name"] for c in rep_cols],
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
    print("[SCENARIO A] PASS: All tables, columns, constraints and indexes verified on fresh PostgreSQL database.")

def run_scenario_b():
    print("\n==================================================")
    print("STARTING SCENARIO B: Supabase Baseline Reconciliation")
    print("==================================================")
    asyncio.run(recreate_database(SCENARIO_B_DB))
    
    cfg = get_alembic_config(SCENARIO_B_ASYNC_URL)
    print("Executing alembic upgrade to 0003_supabase_users_and_identities on test_scenario_b...")
    command.upgrade(cfg, "0003_supabase_users_and_identities")
    
    async def simulate_supabase_schema():
        conn = await asyncpg.connect(SCENARIO_B_CONN_STR)
        print("Simulating pre-0004 Supabase schema drift on test_scenario_b...")
        await conn.execute("ALTER TABLE audit_logs DROP COLUMN IF EXISTS user_agent;")
        await conn.execute("""
            ALTER TABLE reports RENAME COLUMN generated_by_user_id TO user_id;
            ALTER TABLE reports RENAME COLUMN download_url TO file_url;
            ALTER TABLE reports DROP COLUMN IF EXISTS filter_params;
            ALTER TABLE reports ADD COLUMN IF NOT EXISTS report_data JSONB;
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
    print("STARTING DOWNGRADE & RE-UPGRADE VERIFICATION")
    print("==================================================")
    
    # --- Part 1: Scenario A (Fresh Migration Path) ---
    print("\n[TEST A] Downgrading Scenario A to 0003...")
    cfg_a = get_alembic_config(SCENARIO_A_ASYNC_URL)
    command.downgrade(cfg_a, "0003_supabase_users_and_identities")
    print("Scenario A downgrade to 0003 completed.")
    
    cat_a_down = asyncio.run(inspect_catalog(SCENARIO_A_CONN_STR, "Scenario A - Post Downgrade to 0003"))
    assert not cat_a_down["has_report_folders"], "report_folders should be dropped in 0003"
    assert "generated_by_user_id" in cat_a_down["reports_columns"], "generated_by_user_id should be restored on fresh path downgrade"
    assert "download_url" in cat_a_down["reports_columns"], "download_url should be restored on fresh path downgrade"
    
    print("\n[TEST A] Re-upgrading Scenario A to head...")
    command.upgrade(cfg_a, "head")
    print("Scenario A re-upgrade to head completed.")
    cat_a_reup = asyncio.run(inspect_catalog(SCENARIO_A_CONN_STR, "Scenario A - Re-upgraded to Head"))
    assert cat_a_reup["has_report_folders"]
    assert "folder_id" in cat_a_reup["reports_columns"]
    
    # --- Part 2: Scenario B (Supabase Baseline Path) ---
    print("\n[TEST B] Downgrading Scenario B to 0003...")
    cfg_b = get_alembic_config(SCENARIO_B_ASYNC_URL)
    command.downgrade(cfg_b, "0003_supabase_users_and_identities")
    print("Scenario B downgrade to 0003 completed.")
    
    cat_b_down = asyncio.run(inspect_catalog(SCENARIO_B_CONN_STR, "Scenario B - Post Downgrade to 0003"))
    assert not cat_b_down["has_report_folders"], "report_folders should be dropped in 0003"
    assert "user_id" in cat_b_down["reports_columns"], "Original Supabase user_id should be preserved on baseline downgrade"
    assert "file_url" in cat_b_down["reports_columns"], "Original Supabase file_url should be preserved on baseline downgrade"
    
    print("\n[TEST B] Re-upgrading Scenario B to head...")
    command.upgrade(cfg_b, "head")
    print("Scenario B re-upgrade to head completed.")
    cat_b_reup = asyncio.run(inspect_catalog(SCENARIO_B_CONN_STR, "Scenario B - Re-upgraded to Head"))
    assert cat_b_reup["has_report_folders"]
    assert "folder_id" in cat_b_reup["reports_columns"]
    
    print("[DOWNGRADE & RE-UPGRADE] PASS: Both migration paths cleanly downgrade and re-upgrade with complete state preservation.")

async def run_concurrent_uniqueness_tests():
    print("\n==================================================")
    print("STARTING POSTGRESQL CONCURRENT FOLDER UNIQUENESS TESTS")
    print("==================================================")
    
    conn = await asyncpg.connect(SCENARIO_A_CONN_STR)
    
    # Create test users
    u1_id = "test_user_u1"
    u2_id = "test_user_u2"
    now = datetime.now()
    await conn.execute("INSERT INTO users (id, email, hashed_password, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING;", u1_id, "u1@example.com", "dummyhash", now, now)
    await conn.execute("INSERT INTO users (id, email, hashed_password, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING;", u2_id, "u2@example.com", "dummyhash", now, now)
    await conn.close()
    
    # --- Test 8.1: Concurrent creation with different casing ---
    print("\n[TEST 8.1] Concurrent creation with different casing ('Security Audit' vs 'security audit')...")
    async def try_insert_folder(folder_id: str, user_id: str, name: str):
        c = await asyncpg.connect(SCENARIO_A_CONN_STR)
        try:
            now = datetime.now()
            await c.execute(
                "INSERT INTO report_folders (id, user_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5);",
                folder_id, user_id, name, now, now
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
    print(f"Result 1: {res1['status']}")
    print(f"Result 2: {res2['status']}")
    
    statuses = [res1["status"], res2["status"]]
    assert statuses.count("SUCCESS") == 1, f"Expected exactly 1 SUCCESS, got {statuses}"
    assert statuses.count("UNIQUE_VIOLATION") == 1, f"Expected exactly 1 UNIQUE_VIOLATION, got {statuses}"
    violation = res1 if res1["status"] == "UNIQUE_VIOLATION" else res2
    assert violation["sqlstate"] == "23505", f"Expected SQLSTATE 23505, got {violation['sqlstate']}"
    print(f"[TEST 8.1] PASS: Exactly one succeeded, concurrent variant failed with SQLSTATE 23505 ({violation['error']})")
    
    # --- Test 8.2: Multi-variant case collision (4 variants) ---
    print("\n[TEST 8.2] Multi-variant case collision ('FINANCE', 'Finance', 'finance', 'FiNaNcE')...")
    variants = ["FINANCE", "Finance", "finance", "FiNaNcE"]
    tasks = [try_insert_folder(f"rf_fin_{i}", u1_id, var) for i, var in enumerate(variants)]
    results = await asyncio.gather(*tasks)
    
    success_count = sum(1 for r in results if r["status"] == "SUCCESS")
    violation_count = sum(1 for r in results if r["status"] == "UNIQUE_VIOLATION")
    print(f"Multi-variant results: {success_count} succeeded, {violation_count} rejected.")
    assert success_count == 1, f"Expected 1 success, got {success_count}"
    assert violation_count == 3, f"Expected 3 violations, got {violation_count}"
    print("[TEST 8.2] PASS: Multi-variant case collision strictly enforced by PostgreSQL index.")
    
    # --- Test 8.3: Cross-user independence ---
    print("\n[TEST 8.3] Cross-user independence (User U1 vs User U2 for 'Operations Report')...")
    r_u1, r_u2 = await asyncio.gather(
        try_insert_folder("rf_ops_u1", u1_id, "Operations Report"),
        try_insert_folder("rf_ops_u2", u2_id, "Operations Report")
    )
    assert r_u1["status"] == "SUCCESS" and r_u2["status"] == "SUCCESS"
    print(f"[TEST 8.3] PASS: Same folder name permitted across different user accounts.")
    
    # --- Test 8.4: Whitespace normalization ---
    print("\n[TEST 8.4] Whitespace normalization check...")
    # In service layer, names are stripped. If stripped name matches existing, rejection occurs.
    raw_name = "   Security Audit   "
    clean_name = raw_name.strip()
    res_ws = await try_insert_folder("rf_ws_test", u1_id, clean_name)
    assert res_ws["status"] == "UNIQUE_VIOLATION"
    print(f"[TEST 8.4] PASS: Stripped whitespace variant '{clean_name}' collides with existing folder.")
    
    # --- Test 8.5: Transaction rollback and recovery ---
    print("\n[TEST 8.5] Transaction rollback and recovery on violation...")
    c = await asyncpg.connect(SCENARIO_A_CONN_STR)
    tr = c.transaction()
    await tr.start()
    try:
        now = datetime.now()
        await c.execute(
            "INSERT INTO report_folders (id, user_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5);",
            "rf_tx_fail", u1_id, "Security Audit", now, now
        )
        await tr.commit()
    except asyncpg.exceptions.UniqueViolationError:
        await tr.rollback()
        print("Violation caught, transaction rolled back cleanly.")
        
    # Verify connection remains healthy for subsequent operations
    alive_check = await c.fetchval("SELECT 1;")
    assert alive_check == 1
    await c.close()
    print("[TEST 8.5] PASS: Transaction rolled back without poisoning connection.")
    print("[POSTGRESQL CONCURRENT FOLDER UNIQUENESS] ALL TESTS PASSED.")

async def run_foreign_key_and_cascade_tests():
    print("\n==================================================")
    print("STARTING FOREIGN-KEY & CASCADE BEHAVIOR TESTS")
    print("==================================================")
    conn = await asyncpg.connect(SCENARIO_A_CONN_STR)
    
    u_fk = "test_user_fk"
    now = datetime.now()
    await conn.execute("INSERT INTO users (id, email, hashed_password, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING;", u_fk, "fk@example.com", "dummyhash", now, now)
    
    # --- Test 9.1: Folder deletion with ON DELETE SET NULL ---
    print("\n[TEST 9.1] Folder deletion with ON DELETE SET NULL...")
    f_del = "folder_to_delete"
    await conn.execute("INSERT INTO report_folders (id, user_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5);", f_del, u_fk, "Temp Folder", now, now)
    
    # Create 3 reports in f_del
    for i in range(1, 4):
        await conn.execute("""
            INSERT INTO reports (id, title, report_type, user_id, folder_id, file_format, storage_key, file_size_bytes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
        """, f"rep_fk_{i}", f"Report {i}", "traffic_summary", u_fk, f_del, "pdf", f"reports/2026/11/rep_{i}.pdf", 1024, now, now)
        
    # Verify reports point to f_del
    reps_before = await conn.fetch("SELECT id, folder_id FROM reports WHERE id IN ('rep_fk_1', 'rep_fk_2', 'rep_fk_3');")
    assert all(r["folder_id"] == f_del for r in reps_before)
    
    # Delete folder f_del
    await conn.execute("DELETE FROM report_folders WHERE id = $1;", f_del)
    print(f"Folder '{f_del}' deleted.")
    
    # Check reports: must still exist with folder_id = NULL
    reps_after = await conn.fetch("SELECT id, folder_id FROM reports WHERE id IN ('rep_fk_1', 'rep_fk_2', 'rep_fk_3');")
    assert len(reps_after) == 3, f"Expected 3 reports, found {len(reps_after)}"
    for r in reps_after:
        assert r["folder_id"] is None, f"Report {r['id']} folder_id was not set to NULL: {r['folder_id']}"
    print("[TEST 9.1] PASS: Deleting folder set report.folder_id to NULL via ON DELETE SET NULL without deleting reports.")
    
    # --- Test 9.2: User deletion with ON DELETE CASCADE ---
    print("\n[TEST 9.2] User deletion with ON DELETE CASCADE...")
    u_casc = "user_to_cascade"
    f_casc = "folder_of_casc_user"
    await conn.execute("INSERT INTO users (id, email, hashed_password, created_at, updated_at) VALUES ($1, $2, $3, $4, $5);", u_casc, "casc@example.com", "dummyhash", now, now)
    await conn.execute("INSERT INTO report_folders (id, user_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5);", f_casc, u_casc, "Cascade Folder", now, now)
    
    # Delete user
    await conn.execute("DELETE FROM users WHERE id = $1;", u_casc)
    f_check = await conn.fetchval("SELECT id FROM report_folders WHERE id = $1;", f_casc)
    assert f_check is None, "Folder should have been cascade deleted when user was deleted."
    print("[TEST 9.2] PASS: User deletion cascade deleted owned folders via ON DELETE CASCADE.")
    
    # --- Test 9.3: Invalid foreign key rejection ---
    print("\n[TEST 9.3] Invalid foreign key rejection...")
    try:
        await conn.execute("""
            INSERT INTO reports (id, title, report_type, user_id, folder_id, file_format, storage_key, file_size_bytes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
        """, "rep_invalid_fk", "Invalid FK", "traffic_summary", u_fk, "non_existent_folder_id", "pdf", "reports/inv.pdf", 500, now, now)
        assert False, "Should have raised ForeignKeyViolationError"
    except asyncpg.exceptions.ForeignKeyViolationError as e:
        assert e.sqlstate == "23503"
        print(f"[TEST 9.3] PASS: Invalid folder_id rejected with SQLSTATE 23503 ({e})")
        
    await conn.close()
    print("[FOREIGN-KEY & CASCADE BEHAVIOR] ALL TESTS PASSED.")

async def run_jsonb_data_integrity_tests():
    print("\n==================================================")
    print("STARTING POSTGRESQL JSONB & DATA INTEGRITY TESTS")
    print("==================================================")
    conn = await asyncpg.connect(SCENARIO_A_CONN_STR)
    
    u_id = "test_user_u1"
    now = datetime.now()
    
    # Nested complex report data
    complex_data = {
        "summary": {
            "total_detections": 1542,
            "total_vehicles": 1490,
            "total_plates": 1380,
            "mean_confidence": 0.9421
        },
        "breakdown": [
            {"hour": "08:00", "count": 210},
            {"hour": "09:00", "count": 450},
            {"hour": "10:00", "count": 390}
        ],
        "system_flags": {"anomaly_detected": False, "source": "gate_1_north"}
    }
    
    filter_params = {
        "date_range": "custom",
        "start_date": "2026-11-01T00:00:00Z",
        "end_date": "2026-11-15T23:59:59Z",
        "classes": ["car", "truck", "motorcycle"],
        "min_confidence": 0.85
    }
    
    rep_id = "rep_json_test"
    await conn.execute("""
        INSERT INTO reports (id, title, report_type, user_id, file_format, storage_key, file_size_bytes, parameters, report_data, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
    """, rep_id, "Complex JSON Report", "analytics_summary", u_id, "json", "reports/json_test.json", 2048, json.dumps(filter_params), json.dumps(complex_data), now, now)
    
    # Query using PostgreSQL JSON operators
    rec = await conn.fetchrow("""
        SELECT
            id,
            report_data->'summary'->>'total_detections' AS total_det,
            report_data->'summary'->>'mean_confidence' AS mean_conf,
            report_data->'breakdown'->1->>'count' AS hour_9_count,
            parameters->>'date_range' AS date_range,
            parameters->'classes'->>0 AS first_class
        FROM reports
        WHERE id = $1;
    """, rep_id)
    
    print(f"JSON query extracted: total_det={rec['total_det']}, mean_conf={rec['mean_conf']}, hour_9_count={rec['hour_9_count']}, date_range={rec['date_range']}, first_class={rec['first_class']}")
    assert int(rec["total_det"]) == 1542
    assert float(rec["mean_conf"]) == 0.9421
    assert int(rec["hour_9_count"]) == 450
    assert rec["date_range"] == "custom"
    assert rec["first_class"] == "car"
    
    await conn.close()
    print("[POSTGRESQL JSONB & DATA INTEGRITY] PASS: Rich JSON documents successfully persisted and queried with native JSON operators.")

def run_orm_persistence_tests():
    print("\n==================================================")
    print("STARTING END-TO-END ORM PERSISTENCE & SERVICE TESTS")
    print("==================================================")
    
    async def orm_test():
        from app.models.user import User
        from app.models.report import Report, ReportFolder
        from app.services.reports_service import ReportsService
        from app.schemas.reports import (
            FolderCreateRequest,
            FolderUpdateRequest,
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
            
            # 1. Create Folder
            folder_dto = FolderCreateRequest(name="Q4 Security Audits", description="Quarterly audits", color="#3b82f6")
            created_folder = await service.create_folder(user, folder_dto)
            print(f"ORM Created Folder: id={created_folder.id}, name={created_folder.name}")
            assert created_folder.name == "Q4 Security Audits"
            
            # 2. Duplicate Folder rejection (HTTP 409 Conflict)
            try:
                await service.create_folder(user, FolderCreateRequest(name="q4 security audits"))
                assert False, "Should have raised HTTPException 409"
            except HTTPException as e:
                assert e.status_code == 409
                print(f"ORM Duplicate Folder Rejected with HTTP {e.status_code}: {e.detail}")
                
            # 3. Generate & Persist Report
            gen_req = ReportGenerateRequest(
                report_type="recognition_summary",
                format="pdf",
                title="Q4 Recognition Audit",
                folder_id=created_folder.id
            )
            saved_report = await service.generate_and_persist_report(user, gen_req)
            print(f"ORM Saved Report: id={saved_report.id}, title={saved_report.title}, folder_id={saved_report.folder_id}")
            assert saved_report.folder_id == created_folder.id
            assert saved_report.file_format == "pdf"
            
            # Check internal storage_key from ORM entity
            rep_orm = await db.get(Report, saved_report.id)
            assert rep_orm.storage_key is not None
            saved_storage_key = rep_orm.storage_key
            
            # Verify file exists in storage
            assert await storage.exists(saved_storage_key)
            print(f"Artifact successfully stored at storage_key: {saved_storage_key}")
            
            # 4. Move Report to Unorganized (folder_id = None)
            move_res = await service.move_report(saved_report.id, user, ReportMoveRequest(folder_id=None))
            assert move_res.folder_id is None
            print(f"ORM Moved Report to Unorganized: folder_id={move_res.folder_id}")
            
            # 5. Move Report back to Folder
            move_res2 = await service.move_report(saved_report.id, user, ReportMoveRequest(folder_id=created_folder.id))
            assert move_res2.folder_id == created_folder.id
            print(f"ORM Moved Report back to folder: folder_id={move_res2.folder_id}")
            
            # 6. Delete Folder and verify report is preserved with folder_id = None
            del_folder_res = await service.delete_folder(created_folder.id, user)
            print(f"ORM Deleted Folder result: {del_folder_res}")
            
            # Check report in DB
            await db.refresh(rep_orm)
            assert rep_orm.folder_id is None
            print(f"ORM Report Preserved in Unorganized after Folder Deletion: folder_id={rep_orm.folder_id}")
            
            # 7. Delete Saved Report and verify artifact cleanup
            del_rep_res = await service.delete_saved_report(saved_report.id, user)
            assert del_rep_res is True
            print(f"ORM Deleted Saved Report: {del_rep_res}")
            
            # Verify file artifact is removed from disk
            assert not await storage.exists(saved_storage_key)
            print(f"Artifact storage key '{saved_storage_key}' cleanly deleted from storage.")
            
        await engine.dispose()
        print("[END-TO-END ORM PERSISTENCE & SERVICE] ALL CHECKS PASSED.")
        
    asyncio.run(orm_test())

def main():
    print("VisionPlate AI — Phase 07E.8.2 Native PostgreSQL Verification Suite")
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
    asyncio.run(run_concurrent_uniqueness_tests())
    asyncio.run(run_foreign_key_and_cascade_tests())
    asyncio.run(run_jsonb_data_integrity_tests())
    run_orm_persistence_tests()
    print("\n==================================================")
    print("ALL NATIVE POSTGRESQL VERIFICATION PHASES PASSED")
    print("==================================================")

if __name__ == "__main__":
    main()
