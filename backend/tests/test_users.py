from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token, create_refresh_token
from app.main import app
from app.models.user import User
from app.repositories.user_repository import UserRepository

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_session():
    """Async session backed by an in-memory SQLite database for user endpoint testing."""
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
    """TestClient that overrides get_db dependency to use in-memory SQLite session."""

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ==============================================================================
# 1. Authentication & Token Extraction Tests
# ==============================================================================


def test_get_me_missing_token_returns_401(client_with_db: TestClient):
    """GET /users/me without Authorization header or cookie returns 401 Unauthorized."""
    response = client_with_db.get("/api/v1/users/me")
    assert response.status_code == 401
    assert "token missing" in response.json()["detail"].lower()


def test_get_me_malformed_bearer_returns_401(client_with_db: TestClient):
    """GET /users/me with malformed Bearer token header returns 401 Unauthorized."""
    response = client_with_db.get(
        "/api/v1/users/me", headers={"Authorization": "Bearer malformed.invalid.token"}
    )
    assert response.status_code == 401
    assert "Could not validate credentials" in response.json()["detail"]


def test_get_me_invalid_signature_returns_401(client_with_db: TestClient):
    """JWT signed with untrusted secret key returns 401 Unauthorized."""
    forged_token = jwt.encode(
        {"sub": "usr_123", "type": "access"},
        "wrong_secret_key_12345678901234567890",
        algorithm="HS256",
    )
    response = client_with_db.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {forged_token}"}
    )
    assert response.status_code == 401


def test_get_me_expired_token_returns_401(client_with_db: TestClient):
    """Expired access token returns 401 Unauthorized."""
    past_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    expired_token = jwt.encode(
        {"sub": "usr_123", "type": "access", "exp": past_time},
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    response = client_with_db.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401


def test_get_me_refresh_token_rejected(client_with_db: TestClient):
    """Passing a refresh token to protected endpoint returns 401 Unauthorized."""
    refresh_tok = create_refresh_token(subject="usr_123")
    response = client_with_db.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {refresh_tok}"}
    )
    assert response.status_code == 401
    assert "Invalid token type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_me_nonexistent_user_returns_401(
    db_session: AsyncSession, client_with_db: TestClient
):
    """Valid JWT pointing to non-existent database user ID returns 401 Unauthorized."""
    valid_token = create_access_token(subject="usr_nonexistent_999")
    response = client_with_db.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {valid_token}"}
    )
    assert response.status_code == 401
    assert "User not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_me_inactive_user_returns_401(
    db_session: AsyncSession, client_with_db: TestClient
):
    """Deactivated/inactive user account returns 401 Unauthorized."""
    user_repo = UserRepository(db_session)
    inactive_user = User(
        email="inactive@vehiclevision.ai",
        full_name="Disabled User",
        is_active=False,
    )
    await user_repo.create(inactive_user)

    token = create_access_token(subject=inactive_user.id)
    response = client_with_db.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401
    assert "account is inactive" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_me_cookie_authentication_fallback(
    db_session: AsyncSession, client_with_db: TestClient
):
    """Cookie-based access_token authentication fallback succeeds when header is omitted."""
    user_repo = UserRepository(db_session)
    user = User(
        email="cookie.user@vehiclevision.ai",
        full_name="Cookie User",
        is_active=True,
    )
    await user_repo.create(user)

    token = create_access_token(subject=user.id)
    response = client_with_db.get("/api/v1/users/me", cookies={"access_token": token})
    assert response.status_code == 200
    assert response.json()["email"] == "cookie.user@vehiclevision.ai"


# ==============================================================================
# 2. Profile Retrieval & Patch Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_get_current_user_profile_success(
    db_session: AsyncSession, client_with_db: TestClient
):
    """GET /users/me returns authenticated user's profile and hides sensitive credentials."""
    user_repo = UserRepository(db_session)
    user = User(
        email="operator@vehiclevision.ai",
        hashed_password="secret_pbkdf2_hash_value",
        full_name="Operator Alex",
        avatar_url="https://vehiclevision.ai/avatars/alex.png",
        role="operator",
        is_active=True,
    )
    await user_repo.create(user)

    token = create_access_token(subject=user.id)
    response = client_with_db.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == user.id
    assert data["email"] == "operator@vehiclevision.ai"
    assert data["full_name"] == "Operator Alex"
    assert data["avatar_url"] == "https://vehiclevision.ai/avatars/alex.png"
    assert data["role"] == "operator"
    assert data["is_active"] is True
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_patch_user_profile_allowed_fields(
    db_session: AsyncSession, client_with_db: TestClient
):
    """PATCH /users/me updates full_name and avatar_url and persists changes in DB."""
    user_repo = UserRepository(db_session)
    user = User(
        email="operator2@vehiclevision.ai",
        full_name="Old Name",
        avatar_url="http://old.avatar.com/pic.png",
        is_active=True,
    )
    await user_repo.create(user)

    token = create_access_token(subject=user.id)
    payload = {
        "full_name": "New Updated Name",
        "avatar_url": "https://cdn.vehiclevision.ai/avatars/new.png",
    }
    response = client_with_db.patch(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "New Updated Name"
    assert data["avatar_url"] == "https://cdn.vehiclevision.ai/avatars/new.png"

    # Confirm persistence in DB
    reloaded_user = await user_repo.get_by_id(user.id)
    assert reloaded_user.full_name == "New Updated Name"
    assert reloaded_user.avatar_url == "https://cdn.vehiclevision.ai/avatars/new.png"


@pytest.mark.asyncio
async def test_patch_user_profile_partial_update(
    db_session: AsyncSession, client_with_db: TestClient
):
    """PATCH /users/me with partial fields updates specified property and preserves omitted properties."""
    user_repo = UserRepository(db_session)
    user = User(
        email="operator3@vehiclevision.ai",
        full_name="Original Name",
        avatar_url="https://cdn.vehiclevision.ai/avatars/original.png",
        is_active=True,
    )
    await user_repo.create(user)

    token = create_access_token(subject=user.id)
    # Update only full_name, omit avatar_url
    response = client_with_db.patch(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"full_name": "Partially Updated Name"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Partially Updated Name"
    assert data["avatar_url"] == "https://cdn.vehiclevision.ai/avatars/original.png"


@pytest.mark.asyncio
async def test_patch_user_profile_empty_body(
    db_session: AsyncSession, client_with_db: TestClient
):
    """PATCH /users/me with empty JSON body {} returns current user profile without modifying DB."""
    user_repo = UserRepository(db_session)
    user = User(
        email="operator4@vehiclevision.ai",
        full_name="Static Name",
        is_active=True,
    )
    await user_repo.create(user)

    token = create_access_token(subject=user.id)
    response = client_with_db.patch(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Static Name"


# ==============================================================================
# 3. Validation & Protected Fields Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_patch_user_profile_whitespace_only_name_rejected(
    db_session: AsyncSession, client_with_db: TestClient
):
    """PATCH /users/me with whitespace-only full_name returns 422 Unprocessable Entity."""
    user_repo = UserRepository(db_session)
    user = User(email="test_val1@vehiclevision.ai", is_active=True)
    await user_repo.create(user)

    token = create_access_token(subject=user.id)
    response = client_with_db.patch(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"full_name": "   "},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_patch_user_profile_invalid_avatar_url_rejected(
    db_session: AsyncSession, client_with_db: TestClient
):
    """PATCH /users/me with invalid avatar_url scheme or string returns 422 Unprocessable Entity."""
    user_repo = UserRepository(db_session)
    user = User(email="test_val2@vehiclevision.ai", is_active=True)
    await user_repo.create(user)

    token = create_access_token(subject=user.id)
    invalid_urls = [
        "ftp://invalid.com/pic.png",
        "javascript:alert(1)",
        "file:///etc/passwd",
        "not_a_valid_url",
    ]
    for invalid_url in invalid_urls:
        resp = client_with_db.patch(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"avatar_url": invalid_url},
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_patch_user_profile_forbidden_fields_rejected(
    db_session: AsyncSession, client_with_db: TestClient
):
    """Attempting to update protected fields (role, is_superuser, id, email, hashed_password, is_active) returns 422."""
    user_repo = UserRepository(db_session)
    user = User(email="user_priv@vehiclevision.ai", role="user", is_active=True)
    await user_repo.create(user)

    token = create_access_token(subject=user.id)
    forbidden_payloads = [
        {"role": "admin"},
        {"is_superuser": True},
        {"email": "hacked@vehiclevision.ai"},
        {"id": "usr_hacked_id"},
        {"is_active": False},
        {"hashed_password": "new_password"},
    ]

    for payload in forbidden_payloads:
        resp = client_with_db.patch(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )
        assert resp.status_code == 422

    # Confirm role remains unchanged as 'user'
    reloaded_user = await user_repo.get_by_id(user.id)
    assert reloaded_user.role == "user"


# ==============================================================================
# 4. Authorization Boundaries & IDOR Prevention Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_idor_prevention_user_a_cannot_modify_user_b(
    db_session: AsyncSession, client_with_db: TestClient
):
    """User A's token cannot modify User B's profile, even if User B's ID is passed in query/body."""
    user_repo = UserRepository(db_session)
    user_a = User(email="user_a@vehiclevision.ai", full_name="User A Original", is_active=True)
    user_b = User(email="user_b@vehiclevision.ai", full_name="User B Original", is_active=True)
    await user_repo.create(user_a)
    await user_repo.create(user_b)

    token_a = create_access_token(subject=user_a.id)

    # Attempt to modify User B by injecting id/email or parameters
    response = client_with_db.patch(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"full_name": "Hacked Name", "id": user_b.id},
    )
    # Extra field 'id' is forbidden -> 422
    assert response.status_code == 422

    # Verify User B's profile is completely unchanged
    reloaded_b = await user_repo.get_by_id(user_b.id)
    assert reloaded_b.full_name == "User B Original"

    # Verify User A's standard patch only updates User A
    valid_resp = client_with_db.patch(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"full_name": "User A Legitimate Update"},
    )
    assert valid_resp.status_code == 200
    assert valid_resp.json()["id"] == user_a.id
    assert valid_resp.json()["full_name"] == "User A Legitimate Update"
