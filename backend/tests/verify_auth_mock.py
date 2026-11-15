"""Unit tests for AuthService business logic and error contracts using AsyncMock."""
import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.exceptions import (
    AccountNotFoundException,
    AccountDisabledException,
    InvalidCredentialsException,
    EmailAlreadyExistsException,
    UsernameAlreadyExistsException,
    WeakPasswordException,
    InvalidEmailException,
)
from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.services.auth_service import AuthService


async def run_tests():
    print("1. Testing password hashing...")
    pwd = "OperatorPassword2026!"
    hashed = get_password_hash(pwd)
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False
    print("   ✓ Password hashing & verification verified!")

    # Set up mock session and repository
    mock_session = AsyncMock()
    service = AuthService(mock_session)

    # In-memory store
    users_db = {}

    async def mock_get_by_email(email):
        return users_db.get(email.lower().strip())

    async def mock_get_by_username(username):
        for u in users_db.values():
            if u.username == username.lower().strip():
                return u
        return None

    async def mock_create_with_identity(user, provider, provider_user_id, provider_email):
        if not user.id:
            user.id = f"usr_{len(users_db) + 1}"
        users_db[user.email] = user
        return user

    service.repo.get_by_email = mock_get_by_email
    service.repo.get_by_username = mock_get_by_username
    service.repo.create_with_identity = mock_create_with_identity

    # 2. Test registration
    print("2. Testing registration with valid credentials...")
    res = await service.register_user(
        username="traffic_op_1",
        email="traffic.op@visionplate.ai",
        password="ValidPassword2026!",
        full_name="Traffic Operator",
    )
    assert res["access_token"] is not None
    assert res["refresh_token"] is not None
    assert res["user"].username == "traffic_op_1"
    print("   ✓ Registration generated valid tokens & user record!")

    # 3. Test duplicate email registration
    print("3. Testing duplicate email rejection (409 EMAIL_ALREADY_EXISTS)...")
    try:
        await service.register_user(
            username="another_op",
            email="traffic.op@visionplate.ai",
            password="AnotherPassword123!",
        )
        assert False, "Should raise EmailAlreadyExistsException"
    except EmailAlreadyExistsException as e:
        assert e.code == "EMAIL_ALREADY_EXISTS"
        assert e.status_code == 409
        print(f"   ✓ Correctly rejected: {e.code} (HTTP {e.status_code})")

    # 4. Test duplicate username registration
    print("4. Testing duplicate username rejection (409 USERNAME_ALREADY_EXISTS)...")
    try:
        await service.register_user(
            username="traffic_op_1",
            email="new.email@visionplate.ai",
            password="AnotherPassword123!",
        )
        assert False, "Should raise UsernameAlreadyExistsException"
    except UsernameAlreadyExistsException as e:
        assert e.code == "USERNAME_ALREADY_EXISTS"
        assert e.status_code == 409
        print(f"   ✓ Correctly rejected: {e.code} (HTTP {e.status_code})")

    # 5. Test weak password registration
    print("5. Testing weak password rejection (400 WEAK_PASSWORD)...")
    try:
        await service.register_user(
            username="weak_user",
            email="weak@visionplate.ai",
            password="123",
        )
        assert False, "Should raise WeakPasswordException"
    except WeakPasswordException as e:
        assert e.code == "WEAK_PASSWORD"
        assert e.status_code == 400
        print(f"   ✓ Correctly rejected: {e.code} (HTTP {e.status_code})")

    # 6. Test invalid email registration
    print("6. Testing invalid email rejection (400 INVALID_EMAIL)...")
    try:
        await service.register_user(
            username="bad_email_user",
            email="not-an-email",
            password="ValidPassword2026!",
        )
        assert False, "Should raise InvalidEmailException"
    except InvalidEmailException as e:
        assert e.code == "INVALID_EMAIL"
        assert e.status_code == 400
        print(f"   ✓ Correctly rejected: {e.code} (HTTP {e.status_code})")

    # 7. Test login with nonexistent account
    print("7. Testing login with nonexistent email (404 ACCOUNT_NOT_FOUND)...")
    try:
        await service.authenticate_user("ghost@visionplate.ai", "SomePassword123!")
        assert False, "Should raise AccountNotFoundException"
    except AccountNotFoundException as e:
        assert e.code == "ACCOUNT_NOT_FOUND"
        assert e.status_code == 404
        assert "No account found with this email" in e.message
        print(f"   ✓ Correctly rejected: {e.code} (HTTP {e.status_code}) - \"{e.message}\"")

    # 8. Test login with incorrect password
    print("8. Testing login with incorrect password (401 INVALID_CREDENTIALS)...")
    try:
        await service.authenticate_user("traffic.op@visionplate.ai", "WrongPassword!")
        assert False, "Should raise InvalidCredentialsException"
    except InvalidCredentialsException as e:
        assert e.code == "INVALID_CREDENTIALS"
        assert e.status_code == 401
        assert "Incorrect password" in e.message
        print(f"   ✓ Correctly rejected: {e.code} (HTTP {e.status_code}) - \"{e.message}\"")

    # 9. Test login with disabled account
    print("9. Testing login with disabled account (403 ACCOUNT_DISABLED)...")
    users_db["traffic.op@visionplate.ai"].is_active = False
    try:
        await service.authenticate_user("traffic.op@visionplate.ai", "ValidPassword2026!")
        assert False, "Should raise AccountDisabledException"
    except AccountDisabledException as e:
        assert e.code == "ACCOUNT_DISABLED"
        assert e.status_code == 403
        print(f"   ✓ Correctly rejected: {e.code} (HTTP {e.status_code})")
    users_db["traffic.op@visionplate.ai"].is_active = True

    # 10. Test login with correct credentials
    print("10. Testing login with correct credentials (200 OK)...")
    auth_success = await service.authenticate_user("traffic.op@visionplate.ai", "ValidPassword2026!")
    assert auth_success["access_token"] is not None
    assert auth_success["token_type"] == "bearer"
    assert auth_success["user"].username == "traffic_op_1"
    print(f"   ✓ Authentication successful! Access token generated for {auth_success['user'].username}")

    print("\n=======================================================")
    print(" ALL 10 AUTHENTICATION & ERROR CONTRACT TESTS PASSED!")
    print("=======================================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
