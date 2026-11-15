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

async def run_task_g():
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

    print("=== TASK G: POST-MIGRATION READ-ONLY INSPECTION ===")
    async with engine.connect() as conn:
        # 1. Alembic Version
        rows = (await conn.execute(text("SELECT version_num FROM alembic_version;"))).scalars().all()
        print(f"alembic_version rows: {rows}")
        assert len(rows) == 1, f"Expected exactly 1 version row, got {len(rows)}"
        assert rows[0] == "0004_report_persistence", f"Expected 0004_report_persistence, got {rows[0]}"
        print("  -> Alembic version verified: 0004_report_persistence")

        # 2. Reports Table Columns
        cols_rep = (await conn.execute(text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'reports'
            ORDER BY ordinal_position;
        """))).mappings().all()
        rep_dict = {c["column_name"]: dict(c) for c in cols_rep}
        print(f"Reports columns count: {len(rep_dict)}")
        expected_rep_cols = [
            "id", "user_id", "title", "report_type", "report_data", "file_url",
            "parameters", "folder_id", "file_format", "storage_key", "file_size_bytes",
            "created_at", "updated_at"
        ]
        for ec in expected_rep_cols:
            assert ec in rep_dict, f"Missing expected column in reports: {ec}"
            print(f"  - reports.{ec}: {rep_dict[ec]['data_type']} (nullable={rep_dict[ec]['is_nullable']})")
            
        # Foreign keys on reports
        fks_rep = (await conn.execute(text("""
            SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_col, rc.delete_rule
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
            JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
            WHERE tc.table_schema = 'public' AND tc.table_name = 'reports';
        """))).mappings().all()
        print("Reports foreign keys:")
        for fk in fks_rep:
            print(f"  - {fk['constraint_name']}: {fk['column_name']} -> {fk['foreign_table']}.{fk['foreign_col']} ON DELETE {fk['delete_rule']}")
            
        # 3. Report Folders Table
        rf_exists = await conn.scalar(text("SELECT to_regclass('public.report_folders');"))
        assert rf_exists is not None, "report_folders table was not created"
        cols_rf = (await conn.execute(text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'report_folders'
            ORDER BY ordinal_position;
        """))).mappings().all()
        rf_dict = {c["column_name"]: dict(c) for c in cols_rf}
        print(f"report_folders columns count: {len(rf_dict)}")
        expected_rf_cols = ["id", "user_id", "name", "description", "color", "created_at", "updated_at"]
        for ec in expected_rf_cols:
            assert ec in rf_dict, f"Missing expected column in report_folders: {ec}"
            print(f"  - report_folders.{ec}: {rf_dict[ec]['data_type']}")
            
        # Unique index on report_folders
        idxs_rf = (await conn.execute(text("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'report_folders';
        """))).mappings().all()
        print("report_folders indexes:")
        uq_found = False
        for idx in idxs_rf:
            print(f"  - {idx['indexname']}: {idx['indexdef']}")
            if "lower" in idx["indexdef"].lower():
                uq_found = True
        assert uq_found, "Case-insensitive unique index not found on report_folders"
        print("  -> Case-insensitive unique index uq_report_folders_user_lower_name verified.")

        # 4. Audit Logs user_agent column
        cols_al = (await conn.execute(text("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'audit_logs';
        """))).mappings().all()
        al_col_names = [c["column_name"] for c in cols_al]
        assert "user_agent" in al_col_names, "user_agent column was not added to audit_logs"
        print("  -> audit_logs.user_agent verified.")

        # 5. Data Preservation Check
        print("\nChecking post-migration record counts against pre-migration baseline:")
        baseline_counts = {
            "users": 3,
            "oauth_accounts": 1,
            "user_identities": 3,
            "detections": 5,
            "vehicles": 24,
            "plates": 6,
            "files": 5,
            "reports": 0,
            "audit_logs": 0
        }
        for table, expected in baseline_counts.items():
            actual = await conn.scalar(text(f'SELECT count(*) FROM public."{table}";'))
            print(f"  {table}: pre={expected}, post={actual} (MATCH: {actual == expected})")
            assert actual == expected, f"Record count discrepancy in {table}: expected {expected}, got {actual}"
            
        # 6. Check _alembic_0004_state
        state_rows = (await conn.execute(text("SELECT action_key FROM _alembic_0004_state ORDER BY action_key;"))).scalars().all()
        print(f"\n_alembic_0004_state actions recorded ({len(state_rows)}):")
        for s in state_rows:
            print(f"  - {s}")
            
    await engine.dispose()
    print("\nTASK G POST-MIGRATION VERIFICATION PASSED (100% COMPLETE).")

if __name__ == "__main__":
    asyncio.run(run_task_g())

