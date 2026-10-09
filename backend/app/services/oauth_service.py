import time
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAuthException, ProviderNotConfiguredException
from app.core.oauth import (
    GitHubOAuthProvider,
    GoogleOAuthProvider,
    OAuthStateManager,
)
from app.core.security import create_access_token, create_refresh_token
from app.repositories.user_repository import UserRepository
from app.schemas.auth import Token


class OAuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)

    def get_login_url(
        self, provider: str, redirect_url: Optional[str] = None
    ) -> Tuple[str, str, Optional[str]]:
        """
        Generates provider authorization URL and signed state/nonce cookies.
        Returns: (authorization_url, signed_state_cookie, signed_nonce_cookie_or_none)
        """
        provider_lower = provider.lower().strip()
        if provider_lower not in ["google", "github"]:
            raise OAuthException(f"Unsupported OAuth provider '{provider}'")

        raw_state, signed_state = OAuthStateManager.create_state(
            provider=provider_lower, redirect_url=redirect_url
        )

        if provider_lower == "google":
            nonce, signed_nonce = OAuthStateManager.create_nonce()
            auth_url = GoogleOAuthProvider.get_authorization_url(
                state=raw_state, nonce=nonce
            )
            return auth_url, signed_state, signed_nonce
        else:
            auth_url = GitHubOAuthProvider.get_authorization_url(state=raw_state)
            return auth_url, signed_state, None

    async def authenticate_oauth(
        self,
        provider: str,
        code: str,
        state_param: str,
        state_cookie: str,
        nonce_cookie: Optional[str] = None,
    ) -> Tuple[Token, Optional[str]]:
        """
        Validates state, exchanges auth code for user info from provider,
        upserts user + oauth account, and generates access/refresh JWT tokens.
        Returns: (Token, redirect_url_if_any)
        """
        provider_lower = provider.lower().strip()
        if provider_lower not in ["google", "github"]:
            raise OAuthException(f"Unsupported OAuth provider '{provider}'")

        # Verify CSRF state
        target_redirect_url = OAuthStateManager.verify_state(
            state_param=state_param,
            cookie_state=state_cookie,
            expected_provider=provider_lower,
        )

        # Exchange authorization code for user profile
        if provider_lower == "google":
            if not nonce_cookie:
                raise OAuthException("Google OIDC authentication requires a valid nonce cookie")

            try:
                from jose import jwt
                from app.core.config import settings

                payload = jwt.decode(
                    nonce_cookie,
                    settings.SECRET_KEY,
                    algorithms=[settings.JWT_ALGORITHM],
                )
            except Exception:
                raise OAuthException("Invalid OIDC nonce cookie")

            if payload.get("exp", 0) < int(time.time()):
                raise OAuthException("OIDC nonce cookie has expired")

            expected_nonce = payload.get("nonce")
            if not expected_nonce:
                raise OAuthException("OIDC nonce token missing nonce value")

            profile = await GoogleOAuthProvider.exchange_code(
                code=code, expected_nonce=expected_nonce
            )
        else:
            profile = await GitHubOAuthProvider.exchange_code(code=code)

        # Upsert user & oauth account transactionally (provider access tokens are not stored in DB)
        user = await self.user_repo.get_or_create_oauth_user(
            provider=provider_lower,
            provider_user_id=profile["provider_user_id"],
            email=profile["email"],
            full_name=profile.get("full_name"),
            avatar_url=profile.get("avatar_url"),
            access_token=None,
            refresh_token=None,
        )


        if not user.is_active:
            raise OAuthException(
                "User account is deactivated. Please contact support."
            )

        # Issue JWT application tokens
        access_token = create_access_token(subject=user.id)
        refresh_token = create_refresh_token(subject=user.id)

        token = Token(
            access_token=access_token,
            token_type="bearer",
            refresh_token=refresh_token,
        )
        return token, target_redirect_url
