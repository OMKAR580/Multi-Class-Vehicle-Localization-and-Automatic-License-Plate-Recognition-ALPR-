# Backend setup

The backend is a FastAPI service. Its versioned API routes are mounted under
`/api/v1`; the health check is available at `GET /api/v1/health`.

## Local setup

From the repository root, create a local environment file from the template and
set values for any services you intend to use:

```powershell
Copy-Item .env.example .env
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
```

Run the API from the `backend` directory:

```powershell
Set-Location backend
python -m uvicorn app.main:app --reload
```

The interactive API documentation is at `http://127.0.0.1:8000/docs`.
Verify the service with `http://127.0.0.1:8000/api/v1/health`.

## Configuration and security

The application reads settings from environment variables or the repository's
`.env` file. `CORS_ORIGINS` is a comma-separated list of allowed origins. The
application refuses wildcard CORS in production. Development and test runs use
an automatically generated JWT signing key; production must set a stable,
random `SECRET_KEY` of at least 32 characters. Database and OAuth credentials
must be provided through environment variables or `.env`; do not commit `.env`.

## Architecture and Directory Structure

```text
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   └── health.py
│   │       └── router.py
│   ├── core/
│   │   ├── config.py
│   │   ├── exceptions.py
│   │   ├── logging.py
│   │   └── middleware.py
│   ├── models/
│   ├── schemas/
│   ├── services/
│   ├── repositories/
│   ├── workers/
│   └── main.py
├── tests/
│   ├── test_foundation.py
│   ├── test_health.py
│   └── test_schemas.py
├── requirements.txt
└── README.md
```

## Error Handling

Centralized error handling is provided via `app.core.exceptions`:
- `ALPRPlatformException`: Base custom exception with HTTP status codes and custom detail payloads.
- `alpr_exception_handler`: Handles application-level exceptions and formats them as structured JSON responses (`{"detail": ..., "status_code": ...}`).
- `global_exception_handler`: Catches unexpected 500 exceptions, logs the error stack trace, and returns safe structured error responses without leaking internal server state.

## Tests

From the `backend` directory, run:

```powershell
python -m pytest tests/ -v
```

Tests cover:
- Dynamic settings and environment variable validation.
- Comma-separated and list CORS configuration (with production wildcard validation).
- Safe request logging middleware (omits sensitive parameters and query strings).
- Centralized exception handlers and custom exception hierarchy.
- Versioned health check endpoint (`/api/v1/health`).
- Pydantic schema validation contracts.

