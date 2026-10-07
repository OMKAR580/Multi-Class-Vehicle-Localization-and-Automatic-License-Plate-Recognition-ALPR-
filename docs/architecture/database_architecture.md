# Database Architecture & Entity Relationships

Database Engine: PostgreSQL 16
ORM: SQLAlchemy 2.0 (Async) + Alembic Migrations

## Core Entity Tables
- `users`: Account identities, bcrypt password hashes, roles
- `oauth_accounts`: Google & GitHub provider IDs linked to users
- `detections`: Asynchronous detection jobs, media URLs, status, raw JSON result
- `vehicles`: Localized vehicle records, class type, confidence, bounding boxes
- `plates`: License plate text extractions, OCR confidence, crop URLs
- `files`: Uploaded image/video metadata and file size constraints
- `reports`: Generated summary report metadata
- `audit_logs`: Security audit logs for actions, IPs, and user agents
