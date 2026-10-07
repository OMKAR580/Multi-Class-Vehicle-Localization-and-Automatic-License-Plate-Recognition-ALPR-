"""Initial Alembic Migration Foundation for Users, Detections, Vehicles, Plates, Files, Reports, AuditLogs

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-10-07 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, index=True, nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=True),
        sa.Column('full_name', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_superuser', sa.Boolean(), default=False),
        sa.Column('role', sa.String(50), default='user'),
        sa.Column('avatar_url', sa.String(512), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )

    # OAuth Accounts table
    op.create_table(
        'oauth_accounts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('provider_user_id', sa.String(255), index=True, nullable=False),
        sa.Column('access_token', sa.String(1024), nullable=True),
        sa.Column('refresh_token', sa.String(1024), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )

    # Detections table
    op.create_table(
        'detections',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status', sa.String(50), default='PENDING', index=True),
        sa.Column('media_type', sa.String(50), default='image'),
        sa.Column('media_url', sa.String(512), nullable=False),
        sa.Column('processing_time_ms', sa.Float(), nullable=True),
        sa.Column('error_message', sa.String(1024), nullable=True),
        sa.Column('raw_result', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )

    # Vehicles table
    op.create_table(
        'vehicles',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('detection_job_id', sa.String(36), sa.ForeignKey('detections.id', ondelete='CASCADE'), nullable=False),
        sa.Column('vehicle_type', sa.String(50), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('bbox', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )

    # Plates table
    op.create_table(
        'plates',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('vehicle_id', sa.String(36), sa.ForeignKey('vehicles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('plate_text', sa.String(50), index=True, nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('bbox', sa.JSON(), nullable=False),
        sa.Column('crop_url', sa.String(512), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )

    # Files table
    op.create_table(
        'files',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('file_path', sa.String(512), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=False),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=False),
        sa.Column('uploaded_by_user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )

    # Reports table
    op.create_table(
        'reports',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('report_type', sa.String(50), nullable=False),
        sa.Column('generated_by_user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('download_url', sa.String(512), nullable=True),
        sa.Column('filter_params', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )

    # Audit Logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), index=True, nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('user_agent', sa.String(255), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )

def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('reports')
    op.drop_table('files')
    op.drop_table('plates')
    op.drop_table('vehicles')
    op.drop_table('detections')
    op.drop_table('oauth_accounts')
    op.drop_table('users')
