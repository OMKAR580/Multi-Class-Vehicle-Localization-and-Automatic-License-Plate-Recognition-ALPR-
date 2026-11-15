"""
Unit tests for VisionPlate AI Authentication Flow, Error Contracts, and User Management.
"""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base
from app.core.exceptions import (
    AccountNotFoundException,
    AccountDisabledException,
    InvalidCredentialsException,
    EmailAlreadyExistsException,
    UsernameAlreadyExistsException,
    InvalidEmailException,
    WeakPasswordException,
)
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import User, UserIdentity
from app.services.auth_service import AuthService

TEST_SQLITE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def async_session():
    """Provides an isolated in-memory SQLite session for testing."""
    engine = create_async_engine(TEST_SQLITE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_maker() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.mark.asyncio
async def test_password_hash_and_verify():
    """Tests that password hashing generates unique hashes and verifies correctly."""
    pwd = "SecureRoadwayOperator2026!"
    hashed = get_password_hash(pwd)
    assert hashed != pwd
    assert ":" in hashed
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword123!", hashed) is False


@pytest.mark.asyncio
async def test_register_user_success(async_session: AsyncSession):
    """Tests successful user registration with username, email, and password."""
    service = AuthService(async_session)
    result = await service.register_user(
        username="road_operator",
        email="operator.one@visionplate.ai",
        password="SuperPassword2026!",
        full_name="Highway Operator",
    )

    assert result["access_token"] is not None
    assert result["refresh_token"] is not None
    assert result["token_type"] == "bearer"
    user = result["user"]
    assert user.email == "operator.one@visionplate.ai"
    assert user.username == "road_operator"
    assert user.is_active is True
    assert user.hashed_password != "SuperPassword2026!"


@pytest.mark.asyncio
async def test_authenticate_user_account_not_found(async_session: AsyncSession):
    """Tests that signing in with an unregistered email raises AccountNotFoundException (404)."""
    service = AuthService(async_session)
    with pytest.raises(AccountNotFoundException) as exc_info:
        await service.authenticate_user("nonexistent@visionplate.ai", "AnyPassword123!")

    assert exc_info.value.code == "ACCOUNT_NOT_FOUND"
    assert "No account found with this email" in exc_info.value.message


@pytest.mark.asyncio
async def test_authenticate_user_wrong_password(async_session: AsyncSession):
    """Tests that signing in with an existing email but wrong password raises InvalidCredentialsException (401)."""
    service = AuthService(async_session)
    await service.register_user(
        username="active_user",
        email="active@visionplate.ai",
        password="CorrectPassword123!",
    )

    with pytest.raises(InvalidCredentialsException) as exc_info:
        await service.authenticate_user("active@visionplate.ai", "WrongPassword123!")

    assert exc_info.value.code == "INVALID_CREDENTIALS"
    assert "Incorrect password" in exc_info.value.message


@pytest.mark.asyncio
async def test_authenticate_user_success(async_session: AsyncSession):
    """Tests successful login with correct email and password."""
    service = AuthService(async_session)
    await service.register_user(
        username="speed_scanner",
        email="speed.scanner@visionplate.ai",
        password="PlateScanner2026!",
    )

    auth_res = await service.authenticate_user("speed.scanner@visionplate.ai", "PlateScanner2026!")
    assert auth_res["access_token"] is not None
    assert auth_res["user"].username == "speed_scanner"


@pytest.mark.asyncio
async def test_register_duplicate_email_raises_conflict(async_session: AsyncSession):
    """Tests that registering with an existing email raises EmailAlreadyExistsException (409)."""
    service = AuthService(async_session)
    await service.register_user(
        username="unique_user_1",
        email="duplicate.test@visionplate.ai",
        password="Password123!",
    )

    with pytest.raises(EmailAlreadyExistsException) as exc_info:
        await service.register_user(
            username="unique_user_2",
            email="duplicate.test@visionplate.ai",
            password="Password456!",
        )

    assert exc_info.value.code == "EMAIL_ALREADY_EXISTS"


@pytest.mark.asyncio
async def test_register_duplicate_username_raises_conflict(async_session: AsyncSession):
    """Tests that registering with an existing username raises UsernameAlreadyExistsException (409)."""
    service = AuthService(async_session)
    await service.register_user(
        username="unique_handle",
        email="handle1@visionplate.ai",
        password="Password123!",
    )

    with pytest.raises(UsernameAlreadyExistsException) as exc_info:
        await service.register_user(
            username="unique_handle",
            email="handle2@visionplate.ai",
            password="Password456!",
        )

    assert exc_info.value.code == "USERNAME_ALREADY_EXISTS"


@pytest.mark.asyncio
async def test_register_weak_password_raises_error(async_session: AsyncSession):
    """Tests that password under 6 characters raises WeakPasswordException (400)."""
    service = AuthService(async_session)
    with pytest.raises(WeakPasswordException):
        await service.register_user(
            username="short_pwd_user",
            email="short@visionplate.ai",
            password="123",
        )

