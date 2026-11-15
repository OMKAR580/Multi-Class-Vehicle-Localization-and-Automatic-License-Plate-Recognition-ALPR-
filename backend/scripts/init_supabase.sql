-- ==============================================================================
-- VisionPlate AI — Supabase PostgreSQL Complete Schema Initialization
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ==============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255),
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE NOT NULL,
    is_superuser BOOLEAN DEFAULT FALSE NOT NULL,
    role VARCHAR(50) DEFAULT 'operator' NOT NULL,
    avatar_url VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
CREATE INDEX IF NOT EXISTS ix_users_username ON users(username);

-- 2. User Identities Table (Supports email, Google, GitHub identities)
CREATE TABLE IF NOT EXISTS user_identities (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_user_identity_provider_user_id UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS ix_user_identities_provider_user_id ON user_identities(provider_user_id);
CREATE INDEX IF NOT EXISTS ix_user_identities_user_id ON user_identities(user_id);

-- 3. OAuth Accounts Table (Backwards compatibility)
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    access_token VARCHAR(1024),
    refresh_token VARCHAR(1024),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_oauth_provider_user_id UNIQUE (provider, provider_user_id),
    CONSTRAINT uq_user_provider UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS ix_oauth_accounts_provider_user_id ON oauth_accounts(provider_user_id);

-- 4. Files Metadata Table
CREATE TABLE IF NOT EXISTS files (
    id VARCHAR(36) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    uploaded_by_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    original_filename VARCHAR(255),
    stored_path VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Detections Table
CREATE TABLE IF NOT EXISTS detections (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
    media_type VARCHAR(50) DEFAULT 'image' NOT NULL,
    media_url VARCHAR(512) NOT NULL,
    processing_time_ms FLOAT,
    error_message VARCHAR(1024),
    raw_result JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_detections_status ON detections(status);
CREATE INDEX IF NOT EXISTS ix_detections_user_id ON detections(user_id);

-- 6. Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
    id VARCHAR(36) PRIMARY KEY,
    detection_job_id VARCHAR(36) REFERENCES detections(id) ON DELETE CASCADE,
    detection_id VARCHAR(36) REFERENCES detections(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(50) NOT NULL,
    confidence FLOAT NOT NULL,
    bbox JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. Plates Table
CREATE TABLE IF NOT EXISTS plates (
    id VARCHAR(36) PRIMARY KEY,
    vehicle_id VARCHAR(36) NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    plate_text VARCHAR(50) NOT NULL,
    confidence FLOAT NOT NULL,
    bbox JSONB NOT NULL,
    crop_url VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_plates_plate_text ON plates(plate_text);

-- 8. Reports Table
CREATE TABLE IF NOT EXISTS reports (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) DEFAULT 'summary' NOT NULL,
    report_data JSONB,
    file_url VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 10. Seed Default Operator Account (Optional convenience)
-- Email: operator@visionplate.ai | Password: VisionPlate2026!
INSERT INTO users (
    id,
    username,
    email,
    hashed_password,
    full_name,
    is_active,
    email_verified,
    role,
    created_at,
    updated_at
) VALUES (
    'usr_operator_seed_001',
    'operator',
    'operator@visionplate.ai',
    '8198f1a1d95325c7e1898748ff56a7db:83f990a424e84b80267c71d64387d81a9f0fe67ee974f2603893c52a35368a3e',
    'VisionPlate Operator',
    TRUE,
    TRUE,
    'operator',
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

