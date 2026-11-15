"""Add username and email_verified to users, and create user_identities table

Revision ID: 0003_supabase_users
Revises: 0002_oauth_unique_constraints
Create Date: 2026-11-13 22:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision: str = '0003_supabase_users'
down_revision: Union[str, None] = '0002_oauth_unique_constraints'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = inspector.get_table_names()

    # 1. Update 'users' table columns if 'users' exists
    if 'users' in tables:
        columns = [c['name'] for c in inspector.get_columns('users')]
        if 'username' not in columns:
            op.add_column('users', sa.Column('username', sa.String(100), nullable=True))
            try:
                op.create_index('ix_users_username', 'users', ['username'], unique=True)
            except Exception:
                pass

        if 'email_verified' not in columns:
            op.add_column('users', sa.Column('email_verified', sa.Boolean(), server_default='false', nullable=False))

    # 2. Create 'user_identities' table if not exists
    if 'user_identities' not in tables:
        op.create_table(
            'user_identities',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('provider', sa.String(50), nullable=False),
            sa.Column('provider_user_id', sa.String(255), index=True, nullable=False),
            sa.Column('provider_email', sa.String(255), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint('provider', 'provider_user_id', name='uq_user_identity_provider_user_id')
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = inspector.get_table_names()

    if 'user_identities' in tables:
        op.drop_table('user_identities')

    if 'users' in tables:
        columns = [c['name'] for c in inspector.get_columns('users')]
        if 'email_verified' in columns:
            op.drop_column('users', 'email_verified')
        if 'username' in columns:
            try:
                op.drop_index('ix_users_username', table_name='users')
            except Exception:
                pass
            op.drop_column('users', 'username')

