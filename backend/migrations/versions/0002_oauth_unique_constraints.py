"""Add unique constraints for (provider, provider_user_id) and (user_id, provider) to oauth_accounts table

Revision ID: 0002_oauth_unique_constraints
Revises: 0001_initial_schema
Create Date: 2026-10-09 18:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0002_oauth_unique_constraints'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        'uq_oauth_provider_user_id',
        'oauth_accounts',
        ['provider', 'provider_user_id']
    )
    op.create_unique_constraint(
        'uq_user_provider',
        'oauth_accounts',
        ['user_id', 'provider']
    )


def downgrade() -> None:
    op.drop_constraint('uq_user_provider', 'oauth_accounts', type_='unique')
    op.drop_constraint('uq_oauth_provider_user_id', 'oauth_accounts', type_='unique')
