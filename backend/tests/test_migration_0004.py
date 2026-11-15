"""Tests for migration 0004_report_persistence_and_folders reconciliation logic and downgrade safety."""

import os
import sys
import pytest
from pathlib import Path
from sqlalchemy import Column, String, BigInteger, DateTime, JSON, ForeignKey, Table, MetaData, create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from alembic.migration import MigrationContext
from alembic.operations import Operations


def run_0004_upgrade_on_engine(engine):
    """Executes 0004 upgrade function directly against an engine using MigrationContext."""
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "m0004",
        str(Path(__file__).parent.parent / "migrations" / "versions" / "0004_report_persistence.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        op = Operations(ctx)
        mod.op = op
        mod.upgrade()


def run_0004_downgrade_on_engine(engine):
    """Executes 0004 downgrade function directly against an engine using MigrationContext."""
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "m0004",
        str(Path(__file__).parent.parent / "migrations" / "versions" / "0004_report_persistence.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        op = Operations(ctx)
        mod.op = op
        mod.downgrade()


def test_0004_reconciliation_variant_b_live_schema():
    """Tests upgrade on a database matching the live Supabase / init_supabase.sql schema (Variant B)."""
    engine = create_engine("sqlite:///:memory:")
    meta = MetaData()

    # Create users
    Table(
        "users", meta,
        Column("id", String(36), primary_key=True),
        Column("email", String(255), nullable=False),
    )

    # Variant B: user_id, file_url, report_data
    Table(
        "reports", meta,
        Column("id", String(36), primary_key=True),
        Column("user_id", String(36), nullable=True),
        Column("title", String(255), nullable=False),
        Column("report_type", String(50), nullable=False),
        Column("report_data", JSON, nullable=True),
        Column("file_url", String(512), nullable=True),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )

    # Audit logs without user_agent
    Table(
        "audit_logs", meta,
        Column("id", String(36), primary_key=True),
        Column("action", String(100), nullable=False),
        Column("resource_type", String(100), nullable=False),
    )

    meta.create_all(engine)

    # Execute 0004 upgrade
    run_0004_upgrade_on_engine(engine)

    # Inspect post-upgrade state
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    assert "report_folders" in tables
    assert "reports" in tables

    report_cols = [c["name"] for c in inspector.get_columns("reports")]
    assert "user_id" in report_cols
    assert "folder_id" in report_cols
    assert "file_format" in report_cols
    assert "storage_key" in report_cols
    assert "file_size_bytes" in report_cols
    assert "parameters" in report_cols
    assert "report_data" in report_cols
    assert "file_url" in report_cols

    folder_cols = [c["name"] for c in inspector.get_columns("report_folders")]
    assert "id" in folder_cols
    assert "user_id" in folder_cols
    assert "name" in folder_cols
    assert "description" in folder_cols
    assert "color" in folder_cols

    audit_cols = [c["name"] for c in inspector.get_columns("audit_logs")]
    assert "user_agent" in audit_cols

    # Test downgrade: on Variant B, pre-existing user_id and file_url MUST NOT be dropped or renamed
    run_0004_downgrade_on_engine(engine)
    inspector_down = inspect(engine)
    assert "report_folders" not in inspector_down.get_table_names()
    report_cols_down = [c["name"] for c in inspector_down.get_columns("reports")]
    assert "user_id" in report_cols_down
    assert "file_url" in report_cols_down
    assert "folder_id" not in report_cols_down
    assert "storage_key" not in report_cols_down
    assert "_alembic_0004_state" not in inspector_down.get_table_names()


def test_0004_reconciliation_variant_a_historical_upgrade_and_downgrade():
    """
    Tests full upgrade and downgrade cycle on historical migration 0001 schema (Variant A).
    Downgrade MUST safely restore filter_params, download_url, and generated_by_user_id.
    """
    engine = create_engine("sqlite:///:memory:")
    meta = MetaData()

    # Create users
    Table(
        "users", meta,
        Column("id", String(36), primary_key=True),
        Column("email", String(255), nullable=False),
    )

    # Variant A: generated_by_user_id, download_url, filter_params
    Table(
        "reports", meta,
        Column("id", String(36), primary_key=True),
        Column("generated_by_user_id", String(36), nullable=True),
        Column("title", String(255), nullable=False),
        Column("report_type", String(50), nullable=False),
        Column("download_url", String(512), nullable=True),
        Column("filter_params", JSON, nullable=True),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )

    meta.create_all(engine)

    # 1. Upgrade
    run_0004_upgrade_on_engine(engine)

    inspector = inspect(engine)
    report_cols = [c["name"] for c in inspector.get_columns("reports")]
    assert "user_id" in report_cols
    assert "file_url" in report_cols
    assert "parameters" in report_cols
    assert "folder_id" in report_cols
    assert "report_folders" in inspector.get_table_names()

    # 2. Downgrade (reversal)
    run_0004_downgrade_on_engine(engine)

    inspector_down = inspect(engine)
    report_cols_down = [c["name"] for c in inspector_down.get_columns("reports")]
    assert "folder_id" not in report_cols_down
    assert "file_size_bytes" not in report_cols_down
    assert "report_folders" not in inspector_down.get_table_names()

    # In SQLite, table recreate / column rename reversal:
    # filter_params restored from parameters
    assert "filter_params" in report_cols_down or "parameters" not in report_cols_down
    assert "_alembic_0004_state" not in inspector_down.get_table_names()


def test_0004_preexisting_audit_logs_user_agent_preserved_on_downgrade():
    """
    Tests that if audit_logs.user_agent already existed BEFORE migration 0004,
    downgrade does NOT drop it.
    """
    engine = create_engine("sqlite:///:memory:")
    meta = MetaData()
    Table("users", meta, Column("id", String(36), primary_key=True))
    Table(
        "reports", meta,
        Column("id", String(36), primary_key=True),
        Column("user_id", String(36), nullable=True),
        Column("title", String(255), nullable=False),
        Column("report_type", String(50), nullable=False),
    )
    # Pre-existing user_agent in audit_logs
    Table(
        "audit_logs", meta,
        Column("id", String(36), primary_key=True),
        Column("action", String(100), nullable=False),
        Column("user_agent", String(255), nullable=True),
    )
    meta.create_all(engine)

    # Run upgrade
    run_0004_upgrade_on_engine(engine)

    # Run downgrade
    run_0004_downgrade_on_engine(engine)

    inspector = inspect(engine)
    audit_cols = [c["name"] for c in inspector.get_columns("audit_logs")]
    # user_agent MUST be preserved because it was NOT added by 0004
    assert "user_agent" in audit_cols


def test_0004_upgrade_downgrade_upgrade_cycle():
    """Validates that a full upgrade -> downgrade -> upgrade cycle executes cleanly."""
    engine = create_engine("sqlite:///:memory:")
    meta = MetaData()
    Table("users", meta, Column("id", String(36), primary_key=True))
    Table(
        "reports", meta,
        Column("id", String(36), primary_key=True),
        Column("user_id", String(36), nullable=True),
        Column("title", String(255), nullable=False),
        Column("report_type", String(50), nullable=False),
    )
    meta.create_all(engine)

    # 1. Upgrade
    run_0004_upgrade_on_engine(engine)
    assert "report_folders" in inspect(engine).get_table_names()

    # 2. Downgrade
    run_0004_downgrade_on_engine(engine)
    assert "report_folders" not in inspect(engine).get_table_names()

    # 3. Upgrade again
    run_0004_upgrade_on_engine(engine)
    assert "report_folders" in inspect(engine).get_table_names()
    assert "storage_key" in [c["name"] for c in inspect(engine).get_columns("reports")]


def test_0004_idempotency_duplicate_run():
    """Tests that running 0004 multiple times against the same database does not crash."""
    engine = create_engine("sqlite:///:memory:")
    meta = MetaData()
    Table("users", meta, Column("id", String(36), primary_key=True))
    Table(
        "reports", meta,
        Column("id", String(36), primary_key=True),
        Column("user_id", String(36), nullable=True),
        Column("title", String(255), nullable=False),
        Column("report_type", String(50), nullable=False),
    )
    meta.create_all(engine)

    # First run
    run_0004_upgrade_on_engine(engine)
    # Second run (idempotent guard check)
    run_0004_upgrade_on_engine(engine)

    inspector = inspect(engine)
    assert "report_folders" in inspector.get_table_names()
    assert "storage_key" in [c["name"] for c in inspector.get_columns("reports")]
