import ssl
from pathlib import Path
from typing import AsyncGenerator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.core.config import settings
from app.core.logging import logger

Base = declarative_base()


def build_postgres_ssl_context(
    ca_cert_path: str | None = None,
    verify: bool = True,
) -> ssl.SSLContext:
    """
    Constructs an SSLContext for PostgreSQL with certificate and hostname verification.
    Uses trusted operating system CA bundle, supplemented by ca_cert_path if provided.
    Does not silently fall back to unverified TLS or ignore invalid CA configurations.
    """
    if ca_cert_path:
        ca_file = Path(ca_cert_path)
        if not ca_file.is_file():
            raise FileNotFoundError(f"Configured PostgreSQL CA certificate file not found: {ca_cert_path}")
        try:
            ssl_ctx = ssl.create_default_context(cafile=str(ca_file))
        except Exception as exc:
            raise ssl.SSLError(f"Failed to load configured CA bundle at '{ca_cert_path}': {exc}") from exc
    else:
        ssl_ctx = ssl.create_default_context()

    if verify:
        ssl_ctx.verify_mode = ssl.CERT_REQUIRED
        ssl_ctx.check_hostname = True
    else:
        if settings.ENVIRONMENT in ("production", "staging"):
            raise ValueError(
                f"Disabling PostgreSQL TLS verification is strictly prohibited in {settings.ENVIRONMENT}."
            )
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE

    return ssl_ctx


db_url = settings.get_database_url()
is_sqlite = "sqlite" in db_url
is_remote_postgres = not is_sqlite and ("supabase" in db_url or ("localhost" not in db_url and "127.0.0.1" not in db_url))

engine_kwargs = {
    "echo": (settings.ENVIRONMENT == "development" and not is_remote_postgres),
    "future": True,
}

if not is_sqlite:
    # pool_pre_ping disabled: it costs a Supabase round-trip (~300ms) on every
    # connection checkout. pool_recycle handles stale connections instead.
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["pool_size"] = 5        # Supabase free tier: max 20 connections
    engine_kwargs["max_overflow"] = 10
    if is_remote_postgres:
        is_supabase_pooler = "pooler.supabase.com" in db_url or "supabase.co" in db_url
        if is_supabase_pooler and not settings.POSTGRES_CA_CERT_PATH:
            # Supabase Cloud poolers terminate TLS with Supabase internal CA certs
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
        else:
            ssl_ctx = build_postgres_ssl_context(
                ca_cert_path=settings.POSTGRES_CA_CERT_PATH,
                verify=settings.POSTGRES_SSL_VERIFY,
            )
        engine_kwargs["connect_args"] = {
            "ssl": ssl_ctx,
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        }

# Async Engine for FastAPI
engine = create_async_engine(db_url, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async database session with automatic cleanup and rollback on failure."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_db_connection() -> bool:
    """Check database connectivity cleanly without exposing sensitive details on failure."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.warning("Database connection check failed: %s", exc)
        return False

