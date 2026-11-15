
import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath('backend'))

from app.core.database import AsyncSessionLocal
from app.services.auth_service import AuthService
from app.schemas.auth import LoginRequest, OAuthSyncRequest

async def run_tests():
    async with AsyncSessionLocal() as session:
        auth = AuthService(session)
        # Pre-cleanup if prior run failed during delete
        leftover = await auth.repo.get_by_email('brandnewuser_test_2026@gmail.com')
        if leftover:
            await session.delete(leftover)
            await session.commit()
            print("Cleaned up leftover user from previous run.")

        print("=== TEST 1: Lookup existing user 'jai599857@gmail.com' ===")
        user = await auth.repo.get_by_email('jai599857@gmail.com')
        if not user:
            print("FAILED: User not found")
            return
        print(f"SUCCESS: Found user id={user.id}, username={user.username}, email={user.email}")

        print("\n=== TEST 2: Sync existing user with Google OAuth ===")
        sync_result = await auth.sync_oauth_user(OAuthSyncRequest(
            provider='google',
            provider_user_id='109876543210987654321',
            email='jai599857@gmail.com',
            full_name='Jai Singh',
            avatar_url='https://lh3.googleusercontent.com/a/test'
        ))
        print("Status:", sync_result.get("status"))
        print("Has Access Token:", bool(sync_result.get("access_token")))
        print("Has Refresh Token:", bool(sync_result.get("refresh_token")))
        print("User:", sync_result.get("user").email)
        assert sync_result.get("status") == "authenticated", "Existing user must be authenticated"
        assert sync_result.get("access_token"), "Must have access token"

        print("\n=== TEST 3: New user without password (needs setup) ===")
        new_sync_result = await auth.sync_oauth_user(OAuthSyncRequest(
            provider='google',
            provider_user_id='987654321987654321000',
            email='brandnewuser_test_2026@gmail.com',
            full_name='Brand New User'
        ))
        print("Status:", new_sync_result.get("status"))
        print("Suggested Username:", new_sync_result.get("suggested_username"))
        assert new_sync_result.get("status") == "needs_setup", "New user must require username & password setup"

        print("\n=== TEST 4: New user completing setup with username & password ===")
        complete_result = await auth.sync_oauth_user(OAuthSyncRequest(
            provider='google',
            provider_user_id='987654321987654321000',
            email='brandnewuser_test_2026@gmail.com',
            full_name='Brand New User',
            username='brandnewuser_2026',
            password='TestPassword123!'
        ))
        print("Status:", complete_result.get("status"))
        print("Created User ID:", complete_result.get("user").id)
        assert complete_result.get("status") == "authenticated"

        print("\n=== TEST 5: Verify new user can now log in normally by email or username ===")
        login_by_email = await auth.authenticate_user('brandnewuser_test_2026@gmail.com', 'TestPassword123!')
        print("Login by email SUCCESS, token:", bool(login_by_email.get("access_token")))
        
        login_by_username = await auth.authenticate_user('brandnewuser_2026', 'TestPassword123!')
        print("Login by username SUCCESS, token:", bool(login_by_username.get("access_token")))

        # Clean up test user
        del_user = complete_result.get("user")
        await session.delete(del_user)
        await session.commit()
        print("\nCleanup completed cleanly.")
        print("\nALL 5 END-TO-END TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    asyncio.run(run_tests())

