import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from jose import jwk, jwt
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.exceptions import OAuthException
from app.core.oauth import (
    GitHubOAuthProvider,
    GoogleOAuthProvider,
    OAuthStateManager,
    validate_redirect_url,
)
from app.core.security import create_access_token, create_refresh_token
from app.main import app
from app.models.user import OAuthAccount, User
from app.repositories.user_repository import UserRepository
from app.services.oauth_service import OAuthService

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="module")
def rsa_test_keys():
    """Generates a test RSA key pair and JWKS dict for OIDC token signing verification."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem_private = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    pem_public = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    jwk_dict = jwk.construct(pem_public, algorithm="RS256").to_dict()
    jwk_dict["kid"] = "test_google_kid_1"
    jwk_dict["use"] = "sig"
    jwk_dict["alg"] = "RS256"
    return {
        "private_pem": pem_private,
        "public_pem": pem_public,
        "kid": "test_google_kid_1",
        "jwks": {"keys": [jwk_dict]},
    }


@pytest_asyncio.fixture
async def db_session():
    """Async session backed by an in-memory SQLite database for OAuth testing."""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )
    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
def client_with_db(db_session: AsyncSession):
    """TestClient that overrides the get_db dependency to use the in-memory SQLite session."""

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ==============================================================================
# 1. Redirect Allowlist Enforcement Tests
# ==============================================================================


def test_validate_redirect_url_allowed():
    """Approved redirect URLs pass validation."""
    with patch.object(
        settings,
        "ALLOWED_REDIRECT_URLS",
        ["http://localhost:3000/dashboard", "http://localhost:3000/auth/callback"],
    ):
        assert (
            validate_redirect_url("http://localhost:3000/dashboard")
            == "http://localhost:3000/dashboard"
        )
        assert (
            validate_redirect_url("http://localhost:3000/auth/callback")
            == "http://localhost:3000/auth/callback"
        )


def test_validate_redirect_url_missing_defaults():
    """Missing or empty redirect URL defaults to ALLOWED_REDIRECT_URLS[0]."""
    with patch.object(
        settings, "ALLOWED_REDIRECT_URLS", ["http://localhost:3000/dashboard"]
    ):
        assert validate_redirect_url(None) == "http://localhost:3000/dashboard"
        assert validate_redirect_url("") == "http://localhost:3000/dashboard"


def test_validate_redirect_url_hostile_cases():
    """Hostile, protocol-relative, scheme-confused, and unallowlisted URLs are rejected."""
    with patch.object(
        settings, "ALLOWED_REDIRECT_URLS", ["http://localhost:3000/dashboard"]
    ):
        hostile_urls = [
            "https://attacker.com",
            "http://localhost:3000.attacker.com",
            "//attacker.com",
            "\\\\attacker.com",
            "javascript:alert(1)",
            "data:text/html,evil",
            "http://localhost:3000/evil_path",
            "http://localhost:9999/dashboard",
        ]
        for url in hostile_urls:
            with pytest.raises(OAuthException, match="not allowlisted"):
                validate_redirect_url(url)


# ==============================================================================
# 2. State & Nonce CSRF Security Tests
# ==============================================================================


def test_oauth_state_manager_create_and_verify():
    """Verify OAuth state manager creates signed, timestamped state tokens."""
    with patch.object(
        settings, "ALLOWED_REDIRECT_URLS", ["http://localhost:3000/dashboard"]
    ):
        raw_state, signed_cookie = OAuthStateManager.create_state(
            "google", redirect_url="http://localhost:3000/dashboard"
        )
        assert raw_state is not None
        assert signed_cookie is not None

        target_url = OAuthStateManager.verify_state(
            raw_state, signed_cookie, "google"
        )
        assert target_url == "http://localhost:3000/dashboard"

        with pytest.raises(OAuthException, match="provider mismatch"):
            OAuthStateManager.verify_state(raw_state, signed_cookie, "github")

        with pytest.raises(OAuthException, match="CSRF mismatch"):
            OAuthStateManager.verify_state(
                "invalid_state_token", signed_cookie, "google"
            )


def test_oauth_state_manager_nonce():
    """Verify OIDC nonce creation and validation."""
    nonce, signed_nonce = OAuthStateManager.create_nonce()
    assert nonce is not None

    OAuthStateManager.verify_nonce(nonce, signed_nonce)

    with pytest.raises(OAuthException, match="nonce verification failed"):
        OAuthStateManager.verify_nonce("wrong_nonce", signed_nonce)


# ==============================================================================
# 3. Google OIDC Cryptographic Signature & Claims Verification Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_google_id_token_valid_rsa_signature(rsa_test_keys):
    """Google ID token signed with test RSA private key passes cryptographic JWKS verification."""
    nonce, signed_nonce = OAuthStateManager.create_nonce()

    claims = {
        "iss": "https://accounts.google.com",
        "aud": "test_google_client_id",
        "sub": "google_usr_99999",
        "email": "verified_google@gmail.com",
        "email_verified": True,
        "name": "Google User",
        "picture": "https://google.com/pic.jpg",
        "exp": int(time.time()) + 3600,
        "nonce": nonce,
    }

    id_token = jwt.encode(
        claims,
        rsa_test_keys["private_pem"],
        algorithm="RS256",
        headers={"kid": rsa_test_keys["kid"], "alg": "RS256"},
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "access_token": "at_google_123",
        "id_token": id_token,
    }

    with patch.object(settings, "GOOGLE_CLIENT_ID", "test_google_client_id"), patch.object(
        settings, "GOOGLE_CLIENT_SECRET", "test_google_secret"
    ), patch.object(
        GoogleOAuthProvider, "jwks_override", rsa_test_keys["jwks"]
    ), patch(
        "httpx.AsyncClient.post", return_value=mock_resp
    ):
        result = await GoogleOAuthProvider.exchange_code(
            code="code123", expected_nonce=nonce
        )
        assert result["provider_user_id"] == "google_usr_99999"
        assert result["email"] == "verified_google@gmail.com"


@pytest.mark.asyncio
async def test_google_id_token_invalid_signature(rsa_test_keys):
    """Google ID token signed with a different RSA key fails cryptographic verification."""
    other_key = rsa.generate_private_key(65537, 2048)
    other_pem = other_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )

    claims = {
        "iss": "https://accounts.google.com",
        "aud": "test_google_client_id",
        "sub": "google_usr_99999",
        "email": "forged@gmail.com",
        "email_verified": True,
        "exp": int(time.time()) + 3600,
    }

    # Signed with other_pem but referencing rsa_test_keys kid
    forged_token = jwt.encode(
        claims,
        other_pem,
        algorithm="RS256",
        headers={"kid": rsa_test_keys["kid"], "alg": "RS256"},
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"id_token": forged_token}

    with patch.object(settings, "GOOGLE_CLIENT_ID", "test_google_client_id"), patch.object(
        settings, "GOOGLE_CLIENT_SECRET", "test_google_secret"
    ), patch.object(
        GoogleOAuthProvider, "jwks_override", rsa_test_keys["jwks"]
    ), patch(
        "httpx.AsyncClient.post", return_value=mock_resp
    ):
        with pytest.raises(OAuthException, match="signature or claim validation failed"):
            await GoogleOAuthProvider.exchange_code(code="code123")


@pytest.mark.asyncio
async def test_google_id_token_wrong_issuer(rsa_test_keys):
    """Google ID token with untrusted issuer is rejected."""
    claims = {
        "iss": "https://untrusted-issuer.com",
        "aud": "test_google_client_id",
        "sub": "google_usr_99999",
        "email": "user@gmail.com",
        "email_verified": True,
        "exp": int(time.time()) + 3600,
    }

    id_token = jwt.encode(
        claims,
        rsa_test_keys["private_pem"],
        algorithm="RS256",
        headers={"kid": rsa_test_keys["kid"]},
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"id_token": id_token}

    with patch.object(settings, "GOOGLE_CLIENT_ID", "test_google_client_id"), patch.object(
        settings, "GOOGLE_CLIENT_SECRET", "test_google_secret"
    ), patch.object(
        GoogleOAuthProvider, "jwks_override", rsa_test_keys["jwks"]
    ), patch(
        "httpx.AsyncClient.post", return_value=mock_resp
    ):
        with pytest.raises(OAuthException, match="Invalid Google ID token issuer"):
            await GoogleOAuthProvider.exchange_code(code="code123")


@pytest.mark.asyncio
async def test_google_id_token_unknown_kid(rsa_test_keys):
    """Google ID token referencing unknown kid fails closed."""
    claims = {
        "iss": "https://accounts.google.com",
        "aud": "test_google_client_id",
        "sub": "google_usr_99999",
        "email": "user@gmail.com",
        "email_verified": True,
        "exp": int(time.time()) + 3600,
    }

    id_token = jwt.encode(
        claims,
        rsa_test_keys["private_pem"],
        algorithm="RS256",
        headers={"kid": "unknown_kid_999"},
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"id_token": id_token}

    with patch.object(settings, "GOOGLE_CLIENT_ID", "test_google_client_id"), patch.object(
        settings, "GOOGLE_CLIENT_SECRET", "test_google_secret"
    ), patch.object(
        GoogleOAuthProvider, "jwks_override", rsa_test_keys["jwks"]
    ), patch(
        "httpx.AsyncClient.post", return_value=mock_resp
    ):
        with pytest.raises(OAuthException, match="kid.*not found in trusted JWKS"):
            await GoogleOAuthProvider.exchange_code(code="code123")


@pytest.mark.asyncio
async def test_google_id_token_unsupported_alg(rsa_test_keys):
    """Google ID token header with non-RS256 algorithm is rejected."""
    id_token = jwt.encode(
        {"iss": "https://accounts.google.com"},
        "secret",
        algorithm="HS256",
        headers={"kid": rsa_test_keys["kid"], "alg": "HS256"},
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"id_token": id_token}

    with patch.object(settings, "GOOGLE_CLIENT_ID", "test_google_client_id"), patch.object(
        settings, "GOOGLE_CLIENT_SECRET", "test_google_secret"
    ), patch.object(
        GoogleOAuthProvider, "jwks_override", rsa_test_keys["jwks"]
    ), patch(
        "httpx.AsyncClient.post", return_value=mock_resp
    ):
        with pytest.raises(
            OAuthException, match="Unsupported Google ID token signing algorithm"
        ):
            await GoogleOAuthProvider.exchange_code(code="code123")


# ==============================================================================
# 4. Prevent Automatic Account Linking Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_no_implicit_account_linking(db_session: AsyncSession):
    """Existing password account cannot be implicitly taken over by email-matching OAuth identity."""
    user_repo = UserRepository(db_session)
    existing_user = User(
        email="victim@company.com",
        hashed_password="some_hashed_password",
        full_name="Existing User",
        is_active=True,
    )
    await user_repo.create(existing_user)

    # Attempt OAuth lookup for a new provider_user_id but matching victim@company.com email
    with pytest.raises(
        OAuthException, match="Implicit account linking is disabled"
    ):
        await user_repo.get_or_create_oauth_user(
            provider="github",
            provider_user_id="attacker_gh_123",
            email="victim@company.com",
            full_name="Attacker",
        )

    # Confirm existing user has no linked OAuthAccount records
    result = await db_session.execute(
        select(OAuthAccount).where(OAuthAccount.user_id == existing_user.id)
    )
    linked_accounts = result.scalars().all()
    assert len(linked_accounts) == 0



@pytest.mark.asyncio
async def test_authoritative_provider_identity_login(db_session: AsyncSession):
    """Existing OAuth identity logs in successfully by provider + provider_user_id."""
    user_repo = UserRepository(db_session)

    # 1. Create first time
    user1 = await user_repo.get_or_create_oauth_user(
        provider="github",
        provider_user_id="gh_user_777",
        email="octo@github.com",
        full_name="Octocat",
    )
    assert user1.id is not None

    # 2. Login second time with same provider identity
    user2 = await user_repo.get_or_create_oauth_user(
        provider="github",
        provider_user_id="gh_user_777",
        email="octo@github.com",
    )
    assert user2.id == user1.id


# ==============================================================================
# 5. Database Uniqueness & IntegrityError Conflict Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_oauth_account_unique_constraint(db_session: AsyncSession):
    """Database level unique constraints prevent duplicate provider identities."""
    user_repo = UserRepository(db_session)
    u1 = User(email="u1@example.com")
    u2 = User(email="u2@example.com")
    db_session.add(u1)
    db_session.add(u2)
    await db_session.commit()

    acc1 = OAuthAccount(
        user_id=u1.id, provider="google", provider_user_id="same_google_id"
    )
    db_session.add(acc1)
    await db_session.commit()

    # Inserting second record with same provider & provider_user_id must fail
    acc2 = OAuthAccount(
        user_id=u2.id, provider="google", provider_user_id="same_google_id"
    )
    db_session.add(acc2)
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


# ==============================================================================
# 6. Cookie Security & Endpoint Integration Tests
# ==============================================================================


def test_cookie_security_attributes_in_production_vs_development(
    client_with_db: TestClient,
):
    """Cookies use Secure=True in production and Secure=False in development with narrow path."""
    with patch.object(
        settings, "GOOGLE_CLIENT_ID", "test_id"
    ), patch.object(
        settings, "GOOGLE_CLIENT_SECRET", "test_secret"
    ), patch.object(
        settings, "ALLOWED_REDIRECT_URLS", ["http://localhost:3000/dashboard"]
    ):

        # Test Development Mode
        with patch.object(settings, "ENVIRONMENT", "development"):
            resp_dev = client_with_db.get(
                "/api/v1/auth/google/login", follow_redirects=False
            )
            assert resp_dev.status_code == 302
            cookie_header = resp_dev.headers.get("set-cookie", "")
            assert "HttpOnly" in cookie_header
            assert "Path=/api/v1/auth" in cookie_header
            assert "Secure" not in cookie_header

        # Test Production Mode
        with patch.object(settings, "ENVIRONMENT", "production"):
            resp_prod = client_with_db.get(
                "/api/v1/auth/google/login", follow_redirects=False
            )
            assert resp_prod.status_code == 302
            cookie_header_prod = resp_prod.headers.get("set-cookie", "")
            assert "HttpOnly" in cookie_header_prod
            assert "Path=/api/v1/auth" in cookie_header_prod
            assert "Secure" in cookie_header_prod


def test_refresh_token_rejected_as_access_token(
    db_session: AsyncSession, client_with_db: TestClient
):
    """Passing a refresh token to a Bearer access token protected endpoint returns 401 Unauthorized."""
    refresh_tok = create_refresh_token(subject="user_123")
    headers = {"Authorization": f"Bearer {refresh_tok}"}

    resp = client_with_db.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 401
    assert "Invalid token type" in resp.json()["detail"]


def test_logout_endpoint(client_with_db: TestClient):
    """POST /auth/logout clears cookies and returns HTTP 204 No Content."""
    resp = client_with_db.post("/api/v1/auth/logout")
    assert resp.status_code == 204
    assert resp.headers.get("set-cookie") is not None
