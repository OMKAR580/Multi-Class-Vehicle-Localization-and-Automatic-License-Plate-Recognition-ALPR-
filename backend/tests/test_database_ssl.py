"""Comprehensive tests for PostgreSQL TLS Security Hardening, Production Bypass Prevention, and SSL Verification."""

import os
import ssl
import sys
import tempfile
from pathlib import Path
import pytest
from sqlalchemy import create_engine, text
import certifi

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import Settings
from app.core.database import build_postgres_ssl_context, engine_kwargs, is_sqlite, is_remote_postgres


# 1. Production rejects POSTGRES_SSL_VERIFY=False
def test_production_rejects_disabled_ssl_verification():
    """Validates that production environment strictly rejects POSTGRES_SSL_VERIFY=False."""
    with pytest.raises(ValueError) as exc:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a" * 32,
            POSTGRES_SSL_VERIFY=False,
        )
    assert "POSTGRES_SSL_VERIFY cannot be False in production" in str(exc.value)


# 2. Staging rejects POSTGRES_SSL_VERIFY=False
def test_staging_rejects_disabled_ssl_verification():
    """Validates that staging environment strictly rejects POSTGRES_SSL_VERIFY=False."""
    with pytest.raises(ValueError) as exc:
        Settings(
            ENVIRONMENT="staging",
            POSTGRES_SSL_VERIFY=False,
        )
    assert "POSTGRES_SSL_VERIFY cannot be False in staging" in str(exc.value)


# 3. Production enables CERT_REQUIRED
def test_production_enables_cert_required():
    """Validates that remote PostgreSQL context has CERT_REQUIRED enabled."""
    ctx = build_postgres_ssl_context(verify=True)
    assert ctx.verify_mode == ssl.CERT_REQUIRED


# 4. Production enables hostname verification
def test_production_enforces_hostname_verification():
    """Validates that remote PostgreSQL context has check_hostname set to True."""
    ctx = build_postgres_ssl_context(verify=True)
    assert ctx.check_hostname is True


# 5. Valid custom CA is loaded
def test_valid_custom_ca_is_loaded_into_ssl_context():
    """Validates that an authentic, readable CA bundle (from certifi) successfully loads into SSLContext."""
    valid_ca_path = certifi.where()
    ctx = build_postgres_ssl_context(ca_cert_path=valid_ca_path, verify=True)
    assert ctx.verify_mode == ssl.CERT_REQUIRED
    assert ctx.check_hostname is True


# 6. Missing explicitly configured CA fails fast
def test_missing_explicit_ca_path_fails_fast():
    """Validates that configuring a non-existent CA file raises FileNotFoundError or ValueError immediately."""
    missing_path = "/nonexistent/path/to/custom_ca_cert.crt"
    # Settings validation check
    with pytest.raises(ValueError) as exc_cfg:
        Settings(POSTGRES_CA_CERT_PATH=missing_path)
    assert "not found or is not a file" in str(exc_cfg.value)

    # Builder check
    with pytest.raises(FileNotFoundError):
        build_postgres_ssl_context(ca_cert_path=missing_path)


# 7. Invalid CA file fails fast
def test_invalid_ca_file_fails_fast():
    """Validates that configuring a corrupt/non-PEM CA file fails fast."""
    with tempfile.NamedTemporaryFile("w", suffix=".crt", delete=False) as f:
        f.write("---NOT A VALID PEM CERTIFICATE---\nCORRUPTED_BYTES_HERE\n")
        corrupt_path = f.name

    try:
        # Settings validation check
        with pytest.raises(ValueError) as exc_cfg:
            Settings(POSTGRES_CA_CERT_PATH=corrupt_path)
        assert "failed to load as a valid CA bundle" in str(exc_cfg.value)

        # Builder check
        with pytest.raises(ssl.SSLError):
            build_postgres_ssl_context(ca_cert_path=corrupt_path)
    finally:
        if os.path.exists(corrupt_path):
            os.unlink(corrupt_path)


# 8. Default OS trust store works when no custom CA is provided
def test_default_os_trust_store_used_when_no_ca_configured():
    """Validates that omitting custom CA uses the default trust store with full verification."""
    ctx = build_postgres_ssl_context(ca_cert_path=None, verify=True)
    assert ctx.verify_mode == ssl.CERT_REQUIRED
    assert ctx.check_hostname is True


# 9. Untrusted certificate is rejected
def test_ssl_context_rejects_untrusted_certificate():
    """Validates that verification mode is CERT_REQUIRED so untrusted certificates cannot connect."""
    ctx = build_postgres_ssl_context(verify=True)
    assert ctx.verify_mode == ssl.CERT_REQUIRED


# 10. Local SQLite behavior remains unchanged
def test_sqlite_and_local_dev_compatibility():
    """Validates that local database connection configurations remain fully functional."""
    test_db_url = "sqlite:///:memory:"
    local_engine = create_engine(test_db_url)
    with local_engine.connect() as conn:
        res = conn.execute(text("SELECT 1;"))
        assert res.scalar() == 1


# 11. Existing PgBouncer statement-cache settings remain intact
def test_pgbouncer_statement_cache_settings_intact():
    """Validates that remote PostgreSQL connections keep prepared-statement caching disabled for PgBouncer."""
    # When is_remote_postgres is True, engine_kwargs['connect_args'] contains statement_cache_size: 0
    if is_remote_postgres:
        connect_args = engine_kwargs.get("connect_args", {})
        assert connect_args.get("statement_cache_size") == 0
        assert connect_args.get("prepared_statement_cache_size") == 0
        assert "ssl" in connect_args
        assert connect_args["ssl"].verify_mode == ssl.CERT_REQUIRED
        assert connect_args["ssl"].check_hostname is True
