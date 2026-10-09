# VisionPlate AI - Backend Foundation & Database Layer

The backend is a modular FastAPI service providing a clean API layer and PostgreSQL database foundation for VisionPlate AI. API routes are versioned and mounted under `/api/v1`; process liveness is available at `GET /api/v1/health`.

## Backend Setup

### 1. Create environment
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```
Or if using Conda:
```powershell
conda activate visionplate-ai
```

### 2. Install dependencies
```powershell
pip install -r requirements.txt
```

### 3. PostgreSQL Database Prerequisites & Configuration
Ensure PostgreSQL is installed locally or via Docker Compose.
Start database services via Docker:
```powershell
docker-compose up -d postgres
```

Configure local environment variables in `.env`:
```powershell
Copy-Item .env.example .env
```

Required database environment variables:
- `POSTGRES_SERVER`: Hostname (default: `localhost`)
- `POSTGRES_PORT`: Port (default: `5432`)
- `POSTGRES_DB`: Database name (default: `vehicle_alpr`)
- `POSTGRES_USER`: Database user (default: `alpr_admin`)
- `POSTGRES_PASSWORD`: Database user password
- `DATABASE_URL`: (Optional) Explicit connection URL, e.g. `postgresql+asyncpg://alpr_admin:secret@localhost:5432/vehicle_alpr`

### 4. Database Migrations (Alembic)
Run migrations to apply the initial schema to a clean development database:
```powershell
alembic upgrade head
```

To roll back a migration step:
```powershell
alembic downgrade -1
```

To create new auto-generated migration scripts for model schema changes:
```powershell
alembic revision --autogenerate -m "describe_changes"
```

### 5. Start backend
Run the API from the `backend` directory:
```powershell
python -m uvicorn app.main:app --reload
```

### Available URLs
- Base URL: `http://127.0.0.1:8000`
- Health check: `http://127.0.0.1:8000/api/v1/health`
- Swagger documentation: `http://127.0.0.1:8000/docs`
- ReDoc documentation: `http://127.0.0.1:8000/redoc`

---

## Architecture and Directory Structure

```text
backend/
├── app/
│   ├── api/
│   │   ├── __init__.py
│   │   ├── router.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── health.py
│   │       └── router.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── exceptions.py
│   │   └── logging.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── user.py
│   │   ├── detection.py
│   │   ├── file.py
│   │   ├── report.py
│   │   └── audit.py
│   ├── schemas/
│   ├── services/
│   ├── repositories/
│   ├── workers/
│   └── main.py
├── migrations/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── 0001_initial_schema.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_database.py
│   ├── test_foundation.py
│   ├── test_health.py
│   └── test_schemas.py
├── .env.example
├── alembic.ini
├── requirements.txt
└── README.md
```

---

## Configuration and Security

The application reads settings using Pydantic `BaseSettings` from environment variables or `.env`.
Supported core settings:
- `APP_NAME`: Application name (default: `"VisionPlate AI Backend"`)
- `APP_VERSION`: Current version (default: `"0.1.0"`)
- `ENVIRONMENT`: Runtime environment (`development`, `testing`, `production`)
- `DEBUG`: Boolean debug flag
- `API_V1_PREFIX`: API route prefix (default: `"/api/v1"`)
- `CORS_ORIGINS`: Comma-separated or list of allowed CORS origins
- `LOG_LEVEL`: Configurable logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`)
- `POSTGRES_*`: PostgreSQL connection credentials and parameters

Wildcard CORS origins (`*`) are strictly rejected in production. In development and testing, an ephemeral signing key is generated automatically if `SECRET_KEY` is omitted. Never commit secrets to version control.

---

## Error Handling & Session Management

Centralized exception handling is implemented in `app.core.exceptions`:
- `AppException` / `ALPRPlatformException`: Base application exception returning formatted JSON.
- `StarletteHTTPException`: Normalizes standard HTTP errors.
- `RequestValidationError`: Formats schema validation failures.
- `global_exception_handler`: Intercepts unhandled internal server errors safely.

Database session management is provided via `app.core.database.get_db`:
- Uses SQLAlchemy 2.0 `create_async_engine` and `AsyncSessionLocal`.
- Manages connection lifecycle with automatic transaction rollback on error and resource cleanup upon completion.

---

## Tests

From the `backend` directory, run:

```powershell
python -m pytest tests/ -v
```

To run database-specific tests only:
```powershell
python -m pytest tests/test_database.py -v
```

Test coverage includes:
- Process health check endpoint (`GET /api/v1/health`)
- API versioning routing validation
- Dynamic environment configuration and CORS parsing
- Production security rules and ephemeral key generation
- Centralized exception handling
- Database configuration validation & driver URL building
- AsyncSession dependency creation, yield, rollback, and cleanup
- ORM persistence, retrieval, relationships, and cascading deletes
- Database connection failure handling without credential leakage
- Alembic initial migration schema metadata integrity
