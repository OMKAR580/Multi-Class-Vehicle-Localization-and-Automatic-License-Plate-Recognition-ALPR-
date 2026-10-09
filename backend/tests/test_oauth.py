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
# 1. Obsolete Endpoint Removal Tests
# ==============================================================================


def test_obsolete_oauth_endpoint_removed(client_with_db: TestClient):
    """POST /api/v1/auth/oauth has been removed and returns 404 Not Found."""
    resp = client_with_db.post(
        "/api/v1/auth/oauth",
        json={
            "provider": "google",
            "code": "test_code",
            "redirect_uri": "http://localhost:3000",
        },
    )
    assert resp.status_code == 404


# ==============================================================================
# 2. Redirect Allowlist Enforcement Tests
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
# 3. Mandatory Google Nonce Validation Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_google_oauth_missing_nonce_cookie_fails(db_session: AsyncSession):
    """Google OAuth callback fails if nonce cookie is missing."""
    raw_state, signed_state = OAuthStateManager.create_state("google")
    service = OAuthService(db_session)
    with pytest.raises(
        OAuthException, match="requires a valid nonce cookie"
    ):
        await service.authenticate_oauth(
            provider="google",
            code="test_code",
            state_param=raw_state,
            state_cookie=signed_state,
            nonce_cookie=None,
        )


@pytest.mark.asyncio
async def test_google_oauth_malformed_nonce_cookie_fails(db_session: AsyncSession):
    """Google OAuth callback fails if nonce cookie is malformed."""
    raw_state, signed_state = OAuthStateManager.create_state("google")
    service = OAuthService(db_session)
    with pytest.raises(OAuthException, match="Invalid OIDC nonce cookie"):
        await service.authenticate_oauth(
            provider="google",
            code="test_code",
            state_param=raw_state,
            state_cookie=signed_state,
            nonce_cookie="malformed_nonce_cookie_value",
        )


@pytest.mark.asyncio
async def test_google_oauth_nonce_mismatch_fails(db_session: AsyncSession, rsa_test_keys):
    """Google OAuth callback fails if nonce cookie does not match ID token nonce claim."""
    raw_state, signed_state = OAuthStateManager.create_state("google")
    _, signed_nonce = OAuthStateManager.create_nonce()

    # ID token with different nonce
    claims = {
        "iss": "https://accounts.google.com",
        "aud": "test_google_client_id",
        "sub": "google_usr_123",
        "email": "user@gmail.com",
        "email_verified": True,
        "exp": int(time.time()) + 3600,
        "nonce": "mismatched_nonce_value",
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
        settings, "GOOGLE_CLIENT_SECRET", "test_secret"
    ), patch.object(
        GoogleOAuthProvider, "jwks_override", rsa_test_keys["jwks"]
    ), patch(
        "httpx.AsyncClient.post", return_value=mock_resp
    ):
        service = OAuthService(db_session)
        with pytest.raises(OAuthException, match="Google ID token nonce mismatch"):
            await service.authenticate_oauth(
                provider="google",
                code="code",
                state_param=raw_state,
                state_cookie=signed_state,
                nonce_cookie=signed_nonce,
            )


# ==============================================================================
# 4. Google OIDC Cryptographic Signature & Claims Verification Tests
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


# ==============================================================================
# 5. GitHub Verified Email & API Error Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_github_emails_api_error_fails(db_session: AsyncSession):
    """GitHub code exchange fails if /user/emails API returns a non-200 error status."""
    raw_state, signed_state = OAuthStateManager.create_state("github")

    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {"access_token": "gho_test_token"}

    mock_user_resp = MagicMock()
    mock_user_resp.status_code = 200
    mock_user_resp.json.return_value = {"id": 12345, "login": "gh_user"}

    mock_emails_resp = MagicMock()
    mock_emails_resp.status_code = 403
    mock_emails_resp.json.return_value = {"message": "API rate limit exceeded"}

    async def mock_async_client_get(url, headers=None):
        if "user/emails" in url:
            return mock_emails_resp
        return mock_user_resp

    with patch.object(settings, "GITHUB_CLIENT_ID", "test_github_client_id"), patch.object(
        settings, "GITHUB_CLIENT_SECRET", "test_github_secret"
    ), patch(
        "httpx.AsyncClient.post", return_value=mock_token_resp
    ), patch(
        "httpx.AsyncClient.get", side_effect=mock_async_client_get
    ):

        service = OAuthService(db_session)
        with pytest.raises(OAuthException, match="Emails API fetch failed"):
            await service.authenticate_oauth(
                provider="github",
                code="test_gh_code",
                state_param=raw_state,
                state_cookie=signed_state,
            )


@pytest.mark.asyncio
async def test_github_empty_emails_list_fails(db_session: AsyncSession):
    """GitHub code exchange fails if /user/emails returns an empty list."""
    raw_state, signed_state = OAuthStateManager.create_state("github")

    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {"access_token": "gho_test_token"}

    mock_user_resp = MagicMock()
    mock_user_resp.status_code = 200
    mock_user_resp.json.return_value = {"id": 12345, "login": "gh_user", "email": "unverified@github.com"}

    mock_emails_resp = MagicMock()
    mock_emails_resp.status_code = 200
    mock_emails_resp.json.return_value = []

    async def mock_async_client_get(url, headers=None):
        if "user/emails" in url:
            return mock_emails_resp
        return mock_user_resp

    with patch.object(settings, "GITHUB_CLIENT_ID", "test_github_client_id"), patch.object(
        settings, "GITHUB_CLIENT_SECRET", "test_github_secret"
    ), patch(
        "httpx.AsyncClient.post", return_value=mock_token_resp
    ), patch(
        "httpx.AsyncClient.get", side_effect=mock_async_client_get
    ):

        service = OAuthService(db_session)
        with pytest.raises(OAuthException, match="verified primary email address"):
            await service.authenticate_oauth(
                provider="github",
                code="test_gh_code",
                state_param=raw_state,
                state_cookie=signed_state,
            )


# ==============================================================================
# 6. Prevent Automatic Account Linking & Non-Persistence Tests
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

    with pytest.raises(
        OAuthException, match="Implicit account linking is disabled"
    ):
        await user_repo.get_or_create_oauth_user(
            provider="github",
            provider_user_id="attacker_gh_123",
            email="victim@company.com",
            full_name="Attacker",
        )

    result = await db_session.execute(
        select(OAuthAccount).where(OAuthAccount.user_id == existing_user.id)
    )
    linked_accounts = result.scalars().all()
    assert len(linked_accounts) == 0


@pytest.mark.asyncio
async def test_provider_tokens_are_not_persisted(db_session: AsyncSession):
    """Third-party provider access and refresh tokens are not stored in database records."""
    user_repo = UserRepository(db_session)
    user = await user_repo.get_or_create_oauth_user(
        provider="github",
        provider_user_id="gh_user_888",
        email="user888@github.com",
        full_name="User 888",
        access_token="secret_gh_access_token",
        refresh_token="secret_gh_refresh_token",
    )

    result = await db_session.execute(
        select(OAuthAccount).where(OAuthAccount.user_id == user.id)
    )
    oauth_acc = result.scalars().first()
    assert oauth_acc is not None
    assert oauth_acc.access_token is None
    assert oauth_acc.refresh_token is None


# ==============================================================================
# 7. Cookie & Handoff Contract Integration Tests
# ==============================================================================


def test_web_callback_handoff_browser_vs_api(client_with_db: TestClient, rsa_test_keys):
    """Callback with Accept: text/html sets HttpOnly cookie and 302 redirects; API request returns JSON."""
    with patch.object(
        settings, "ALLOWED_REDIRECT_URLS", ["http://localhost:3000/dashboard"]
    ):
        raw_state, signed_state = OAuthStateManager.create_state(
            "github", redirect_url="http://localhost:3000/dashboard"
        )

    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {"access_token": "gho_test"}

    mock_user_resp = MagicMock()
    mock_user_resp.status_code = 200
    mock_user_resp.json.return_value = {"id": 5555, "login": "webuser", "name": "Web User"}

    mock_emails_resp = MagicMock()
    mock_emails_resp.status_code = 200
    mock_emails_resp.json.return_value = [
        {"email": "webuser@github.com", "primary": True, "verified": True}
    ]

    async def mock_async_client_get(url, headers=None):
        if "user/emails" in url:
            return mock_emails_resp
        return mock_user_resp

    with patch.object(settings, "GITHUB_CLIENT_ID", "test_id"), patch.object(
        settings, "GITHUB_CLIENT_SECRET", "test_secret"
    ), patch(
        "httpx.AsyncClient.post", return_value=mock_token_resp
    ), patch(
        "httpx.AsyncClient.get", side_effect=mock_async_client_get
    ):

        # 1. Web Browser navigation request -> 302 redirect & HttpOnly cookie
        headers_html = {"Accept": "text/html,application/xhtml+xml"}
        cookies = {"oauth_state": signed_state}
        resp_browser = client_with_db.get(
            f"/api/v1/auth/github/callback?code=gh_code&state={raw_state}",
            headers=headers_html,
            cookies=cookies,
            follow_redirects=False,
        )
        assert resp_browser.status_code == 302
        assert resp_browser.headers["location"] == "http://localhost:3000/dashboard"
        cookie_header = resp_browser.headers.get("set-cookie", "")
        assert "access_token=" in cookie_header
        assert "HttpOnly" in cookie_header

        # 2. Programmatic API request -> 200 OK with JSON Token payload
        headers_json = {"Accept": "application/json"}
        resp_api = client_with_db.get(
            f"/api/v1/auth/github/callback?code=gh_code&state={raw_state}",
            headers=headers_json,
            cookies=cookies,
        )
        assert resp_api.status_code == 200
        assert "access_token" in resp_api.json()
        assert resp_api.json()["token_type"] == "bearer"


def test_logout_endpoint(client_with_db: TestClient):
    """POST /auth/logout clears cookies and returns HTTP 204 No Content."""
    resp = client_with_db.post("/api/v1/auth/logout")
    assert resp.status_code == 204
    assert resp.headers.get("set-cookie") is not None
