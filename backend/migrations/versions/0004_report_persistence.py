"""Add persistent report storage fields, report_folders table, and reconcile schema drift

Revision ID: 0004_report_persistence
Revises: 0003_supabase_users
Create Date: 2026-11-15 03:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision: str = '0004_report_persistence'
down_revision: Union[str, None] = '0003_supabase_users'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = inspector.get_table_names()

    # 0. Initialize reconciliation state marker table for deterministic, safe downgrade
    if '_alembic_0004_state' not in tables:
        op.create_table(
            '_alembic_0004_state',
            sa.Column('action_key', sa.String(100), primary_key=True),
        )

    def record_action(key: str) -> None:
        # State-marker recording failure must abort the migration without silent suppression
        op.execute(sa.text(f"INSERT INTO _alembic_0004_state (action_key) VALUES ('{key}') ON CONFLICT (action_key) DO NOTHING"))

    # 1. Create 'report_folders' table if absent with database-enforced case-insensitive uniqueness
    if 'report_folders' not in tables:
        op.create_table(
            'report_folders',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('description', sa.String(512), nullable=True),
            sa.Column('color', sa.String(50), server_default='orange', nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        )
        try:
            op.create_index('ix_report_folders_user_id', 'report_folders', ['user_id'])
        except Exception:
            pass
        try:
            op.create_index(
                'uq_report_folders_user_lower_name',
                'report_folders',
                ['user_id', sa.text('lower(name)')],
                unique=True,
            )
        except Exception:
            pass
        record_action('created_report_folders_table')

    # 2. Reconcile and extend 'reports' table if it exists
    if 'reports' in tables:
        report_cols = {c['name']: c for c in inspector.get_columns('reports')}

        # Handle schema variant: generated_by_user_id vs user_id
        if 'generated_by_user_id' in report_cols and 'user_id' not in report_cols:
            try:
                op.alter_column('reports', 'generated_by_user_id', new_column_name='user_id')
                record_action('renamed_generated_by_user_id')
            except Exception:
                op.add_column('reports', sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
                record_action('added_reports_user_id')
        elif 'user_id' not in report_cols:
            op.add_column('reports', sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
            record_action('added_reports_user_id')

        # Handle schema variant: download_url vs file_url
        if 'download_url' in report_cols and 'file_url' not in report_cols:
            try:
                op.alter_column('reports', 'download_url', new_column_name='file_url')
                record_action('renamed_download_url')
            except Exception:
                op.add_column('reports', sa.Column('file_url', sa.String(512), nullable=True))
                record_action('added_reports_file_url')
        elif 'file_url' not in report_cols:
            op.add_column('reports', sa.Column('file_url', sa.String(512), nullable=True))
            record_action('added_reports_file_url')

        # Handle schema variant: filter_params vs parameters
        if 'filter_params' in report_cols and 'parameters' not in report_cols:
            try:
                op.alter_column('reports', 'filter_params', new_column_name='parameters')
                record_action('renamed_filter_params')
            except Exception:
                op.add_column('reports', sa.Column('parameters', sa.JSON(), nullable=True))
                record_action('added_reports_parameters')
        elif 'parameters' not in report_cols:
            op.add_column('reports', sa.Column('parameters', sa.JSON(), nullable=True))
            record_action('added_reports_parameters')

        # Ensure report_data column exists
        if 'report_data' not in report_cols:
            op.add_column('reports', sa.Column('report_data', sa.JSON(), nullable=True))
            record_action('added_reports_report_data')

        # Add new persistent reporting fields
        if 'folder_id' not in report_cols:
            op.add_column('reports', sa.Column('folder_id', sa.String(36), nullable=True))
            try:
                op.create_foreign_key(
                    'fk_reports_folder_id',
                    'reports',
                    'report_folders',
                    ['folder_id'],
                    ['id'],
                    ondelete='SET NULL'
                )
            except Exception:
                pass
            record_action('added_reports_folder_id')

        if 'file_format' not in report_cols:
            op.add_column('reports', sa.Column('file_format', sa.String(10), server_default='pdf', nullable=False))
            record_action('added_reports_file_format')

        if 'storage_key' not in report_cols:
            op.add_column('reports', sa.Column('storage_key', sa.String(512), nullable=True))
            record_action('added_reports_storage_key')

        if 'file_size_bytes' not in report_cols:
            op.add_column('reports', sa.Column('file_size_bytes', sa.BigInteger(), server_default='0', nullable=False))
            record_action('added_reports_file_size_bytes')

        # Refresh index inspection
        existing_indexes = [idx['name'] for idx in inspector.get_indexes('reports')]
        if 'ix_reports_user_id' not in existing_indexes:
            try:
                op.create_index('ix_reports_user_id', 'reports', ['user_id'])
            except Exception:
                pass

        if 'ix_reports_folder_id' not in existing_indexes:
            try:
                op.create_index('ix_reports_folder_id', 'reports', ['folder_id'])
            except Exception:
                pass

        if 'ix_reports_user_id_created_at' not in existing_indexes:
            try:
                op.create_index('ix_reports_user_id_created_at', 'reports', ['user_id', 'created_at'])
            except Exception:
                pass

    # 3. Additive reconciliation for audit_logs.user_agent if missing
    if 'audit_logs' in tables:
        audit_cols = [c['name'] for c in inspector.get_columns('audit_logs')]
        if 'user_agent' not in audit_cols:
            op.add_column('audit_logs', sa.Column('user_agent', sa.String(255), nullable=True))
            record_action('added_audit_logs_user_agent')


def downgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = inspector.get_table_names()

    # Query reconciliation state markers to ensure non-destructive downgrade
    actions = set()
    if '_alembic_0004_state' in tables:
        res = bind.execute(sa.text("SELECT action_key FROM _alembic_0004_state"))
        actions = {row[0] for row in res.fetchall()}

    if 'reports' in tables:
        report_indexes = [idx['name'] for idx in inspector.get_indexes('reports')]
        if 'ix_reports_user_id_created_at' in report_indexes:
            op.drop_index('ix_reports_user_id_created_at', table_name='reports')
        if 'ix_reports_folder_id' in report_indexes:
            op.drop_index('ix_reports_folder_id', table_name='reports')
        if 'ix_reports_user_id' in report_indexes:
            op.drop_index('ix_reports_user_id', table_name='reports')

        report_fks = [fk['name'] for fk in inspector.get_foreign_keys('reports')]
        if 'fk_reports_folder_id' in report_fks:
            op.drop_constraint('fk_reports_folder_id', 'reports', type_='foreignkey')

        report_cols = [c['name'] for c in inspector.get_columns('reports')]

        # Drop newly introduced persistent reporting columns
        for col in ['file_size_bytes', 'storage_key', 'file_format', 'folder_id']:
            if col in report_cols and (not actions or f'added_reports_{col}' in actions):
                op.drop_column('reports', col)

        if 'added_reports_report_data' in actions and 'report_data' in report_cols:
            op.drop_column('reports', 'report_data')

        # Reverse column renames or drops based on tracked state
        if 'renamed_filter_params' in actions:
            if 'parameters' in report_cols and 'filter_params' not in report_cols:
                try:
                    op.alter_column('reports', 'parameters', new_column_name='filter_params')
                except Exception:
                    pass
        elif 'added_reports_parameters' in actions and 'parameters' in report_cols:
            op.drop_column('reports', 'parameters')

        if 'renamed_download_url' in actions:
            if 'file_url' in report_cols and 'download_url' not in report_cols:
                try:
                    op.alter_column('reports', 'file_url', new_column_name='download_url')
                except Exception:
                    pass
        elif 'added_reports_file_url' in actions and 'file_url' in report_cols:
            op.drop_column('reports', 'file_url')

        if 'renamed_generated_by_user_id' in actions:
            if 'user_id' in report_cols and 'generated_by_user_id' not in report_cols:
                try:
                    op.alter_column('reports', 'user_id', new_column_name='generated_by_user_id')
                except Exception:
                    pass
        elif 'added_reports_user_id' in actions and 'user_id' in report_cols:
            op.drop_column('reports', 'user_id')

    if 'report_folders' in tables:
        try:
            op.drop_index('uq_report_folders_user_lower_name', table_name='report_folders')
        except Exception:
            pass
        try:
            op.drop_index('ix_report_folders_user_id', table_name='report_folders')
        except Exception:
            pass
        op.drop_table('report_folders')

    if 'audit_logs' in tables:
        audit_cols = [c['name'] for c in inspector.get_columns('audit_logs')]
        # Drop user_agent ONLY IF 0004 actually added it (or fallback if no state tracking exists)
        if 'user_agent' in audit_cols and ('added_audit_logs_user_agent' in actions or not actions):
            if 'added_audit_logs_user_agent' in actions:
                op.drop_column('audit_logs', 'user_agent')

    if '_alembic_0004_state' in tables:
        op.drop_table('_alembic_0004_state')

