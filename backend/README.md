# VisionPlate AI - Backend Foundation

The backend is a modular FastAPI service providing a clean API layer for VisionPlate AI. API routes are versioned and mounted under `/api/v1`; process liveness is available at `GET /api/v1/health`.

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

### 3. Configure environment
Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```
Then configure local values in `.env` as required.

### 4. Start backend
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
│   │   ├── exceptions.py
│   │   └── logging.py
│   ├── models/
│   ├── schemas/
│   ├── services/
│   ├── repositories/
│   ├── workers/
│   └── main.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_foundation.py
│   ├── test_health.py
│   └── test_schemas.py
├── .env.example
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

Wildcard CORS origins (`*`) are strictly rejected in production. In development and testing, an ephemeral signing key is generated automatically if `SECRET_KEY` is omitted. Never commit secrets to version control.

---

## Error Handling Foundation

Centralized exception handling is implemented in `app.core.exceptions`:
- `AppException` / `ALPRPlatformException`: Base application exception returning machine-readable JSON:
  ```json
  {
      "error": {
          "code": "BAD_REQUEST",
          "message": "Error description"
      }
  }
  ```
- `StarletteHTTPException`: Normalizes standard HTTP errors.
- `RequestValidationError`: Formats schema validation failures.
- `global_exception_handler`: Intercepts unhandled internal server errors, logs tracebacks internally, and returns a safe HTTP 500 response without leaking internal server details.

---

## Tests

From the `backend` directory, run:

```powershell
python -m pytest tests/ -v
```

Test coverage includes:
- Health check endpoint (`GET /api/v1/health`)
- API versioning routing validation
- Basic application startup and import checks
- Dynamic environment configuration and CORS parsing
- Production security rules and ephemeral key generation
- Centralized exception handling
