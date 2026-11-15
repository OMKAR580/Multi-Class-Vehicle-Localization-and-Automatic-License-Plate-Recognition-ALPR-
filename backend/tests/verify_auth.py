"""Standalone test runner for auth flow to verify directly."""
import asyncio
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
import app.models  # Register all models for metadata foreign keys
from app.core.database import Base
from app.core.exceptions import (
    AccountNotFoundException,
    InvalidCredentialsException,
    EmailAlreadyExistsException,
    UsernameAlreadyExistsException,
    WeakPasswordException,
)
from app.core.security import get_password_hash, verify_password, create_access_token
from app.services.auth_service import AuthService

async def main():
    print("Testing password hashing...")
    pwd = "SecureRoadwayOperator2026!"
    hashed = get_password_hash(pwd)
    assert hashed != pwd
    assert ":" in hashed
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword123!", hashed) is False
    print("✓ Password hashing & verification passed!")

    print("Setting up in-memory database...")
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_maker() as session:
        service = AuthService(session)

        # 1. Register new user
        print("Testing register_user...")
        reg_res = await service.register_user(
            username="road_operator",
            email="operator.one@visionplate.ai",
            password="SuperPassword2026!",
            full_name="Highway Operator",
        )
        assert reg_res["access_token"] is not None
        assert reg_res["user"].username == "road_operator"
        assert reg_res["user"].email == "operator.one@visionplate.ai"
        print("✓ Registration successful!")

        # 2. Login with non-existent email -> ACCOUNT_NOT_FOUND (404)
        print("Testing login with non-existent user...")
        try:
            await service.authenticate_user("notfound@visionplate.ai", "AnyPassword123!")
            assert False, "Should have raised AccountNotFoundException"
        except AccountNotFoundException as e:
            assert e.code == "ACCOUNT_NOT_FOUND"
            assert "No account found with this email" in e.message
            print("✓ AccountNotFoundException correctly raised on missing user!")

        # 3. Login with incorrect password -> INVALID_CREDENTIALS (401)
        print("Testing login with incorrect password...")
        try:
            await service.authenticate_user("operator.one@visionplate.ai", "WrongPassword!")
            assert False, "Should have raised InvalidCredentialsException"
        except InvalidCredentialsException as e:
            assert e.code == "INVALID_CREDENTIALS"
            assert "Incorrect password" in e.message
            print("✓ InvalidCredentialsException correctly raised on wrong password!")

        # 4. Login with correct credentials -> Success (200)
        print("Testing login with correct credentials...")
        auth_res = await service.authenticate_user("operator.one@visionplate.ai", "SuperPassword2026!")
        assert auth_res["access_token"] is not None
        assert auth_res["user"].username == "road_operator"
        print("✓ Authentication successful with tokens generated!")

        # 5. Duplicate email -> EMAIL_ALREADY_EXISTS (409)
        print("Testing duplicate email check...")
        try:
            await service.register_user(
                username="another_user",
                email="operator.one@visionplate.ai",
                password="AnotherPassword123!",
            )
            assert False, "Should have raised EmailAlreadyExistsException"
        except EmailAlreadyExistsException as e:
            assert e.code == "EMAIL_ALREADY_EXISTS"
            print("✓ EmailAlreadyExistsException correctly raised on duplicate email!")

        # 6. Duplicate username -> USERNAME_ALREADY_EXISTS (409)
        print("Testing duplicate username check...")
        try:
            await service.register_user(
                username="road_operator",
                email="different@visionplate.ai",
                password="AnotherPassword123!",
            )
            assert False, "Should have raised UsernameAlreadyExistsException"
        except UsernameAlreadyExistsException as e:
            assert e.code == "USERNAME_ALREADY_EXISTS"
            print("✓ UsernameAlreadyExistsException correctly raised on duplicate username!")

        # 7. Weak password (< 6 chars) -> WEAK_PASSWORD (400)
        print("Testing weak password check...")
        try:
            await service.register_user(
                username="weak_pwd_user",
                email="weak@visionplate.ai",
                password="123",
            )
            assert False, "Should have raised WeakPasswordException"
        except WeakPasswordException as e:
            assert e.code == "WEAK_PASSWORD"
            print("✓ WeakPasswordException correctly raised on short password!")

    await engine.dispose()
    print("\nALL BACKEND AUTH TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    asyncio.run(main())
