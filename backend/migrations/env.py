import asyncio
import os
import sys
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.core.database import is_remote_postgres, build_postgres_ssl_context
from app.models.base import Base
import app.models  # Import all models to register with Base.metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url") or settings.get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    db_url = config.get_main_option("sqlalchemy.url") or settings.get_database_url()
    configuration["sqlalchemy.url"] = db_url

    extra_kwargs = {}
    if is_remote_postgres:
        ca_path = settings.POSTGRES_CA_CERT_PATH
        if not ca_path:
            potential_ca = os.path.join(backend_dir, "prod-ca-2021.crt")
            if os.path.isfile(potential_ca):
                ca_path = potential_ca
        ssl_ctx = build_postgres_ssl_context(
            ca_cert_path=ca_path,
            verify=settings.POSTGRES_SSL_VERIFY,
        )
        extra_kwargs["connect_args"] = {
            "ssl": ssl_ctx,
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        }

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        **extra_kwargs,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()

def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
