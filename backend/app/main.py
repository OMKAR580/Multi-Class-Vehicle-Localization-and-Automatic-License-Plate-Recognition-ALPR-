import sys
from pathlib import Path

# Ensure project root is present in sys.path before loading sub-routers & AI modules
_PROJECT_ROOT = str(Path(__file__).resolve().parent.parent.parent)
_BACKEND_DIR = str(Path(__file__).resolve().parent.parent)
for _p in [_PROJECT_ROOT, _BACKEND_DIR]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.router import api_router
from app.core.config import settings
from app.core.exceptions import (
    AppException,
    app_exception_handler,
    global_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.core.logging import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Starting up %s (v%s) in %s mode...",
        settings.APP_NAME,
        settings.APP_VERSION,
        settings.ENVIRONMENT,
    )
    if settings.ENVIRONMENT != "testing":
        try:
            from ai.pipeline.alpr_pipeline import ALPRPipeline
            app.state.alpr_pipeline = ALPRPipeline()
            logger.info("ALPRPipeline initialized in application state.")
        except Exception as exc:
            logger.warning("ALPRPipeline startup initialization deferred: %s", exc)
    yield
    logger.info("Shutting down API server...")


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for Multi-Class Vehicle Localization & ALPR Platform",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS Configuration
origins = settings.CORS_ORIGINS
allow_origin_regex = (
    r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$"
    if settings.ENVIRONMENT == "development"
    else None
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials="*" not in origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Centralized Exception Handlers
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)

# Include Centralized API Router
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
