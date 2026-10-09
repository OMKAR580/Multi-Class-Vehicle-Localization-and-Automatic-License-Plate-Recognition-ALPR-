from typing import Optional
from fastapi import APIRouter, Cookie, Depends, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import OAuthException
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    OAuthLoginRequest,
    OAuthRedirectResponse,
    Token,
)
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService
from app.services.oauth_service import OAuthService

router = APIRouter()


@router.post("/auth/login", response_model=Token, tags=["Authentication"])
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Standard Email/Password Login Endpoint."""
    auth_service = AuthService(db)
    return await auth_service.authenticate_user(request.email, request.password)


@router.get("/auth/{provider}/login", tags=["Authentication"])
async def oauth_login_redirect(
    provider: str,
    response: Response,
    redirect_url: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Initiates OAuth authentication flow by redirecting the client to the provider's
    authorization URL and setting signed state/nonce security cookies.
    """
    oauth_service = OAuthService(db)
    auth_url, state_cookie, nonce_cookie = oauth_service.get_login_url(
        provider=provider, redirect_url=redirect_url
    )

    is_production = settings.ENVIRONMENT == "production"
    response = RedirectResponse(url=auth_url, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key="oauth_state",
        value=state_cookie,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=600,
        path="/api/v1/auth",
    )
    if nonce_cookie:
        response.set_cookie(
            key="oauth_nonce",
            value=nonce_cookie,
            httponly=True,
            secure=is_production,
            samesite="lax",
            max_age=600,
            path="/api/v1/auth",
        )
    return response


@router.get("/auth/{provider}/callback", response_model=Token, tags=["Authentication"])
async def oauth_callback(
    provider: str,
    response: Response,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    oauth_state: Optional[str] = Cookie(None),
    oauth_nonce: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Handles OAuth callback from Google or GitHub provider.
    Exchanges code for tokens, upserts user, and returns access/refresh JWT tokens.
    """
    if error:
        raise OAuthException(
            f"Provider returned error: {error_description or error}"
        )

    if not code:
        raise OAuthException("Authorization code parameter is missing")

    if not state or not oauth_state:
        raise OAuthException("OAuth state parameter or cookie is missing")

    oauth_service = OAuthService(db)
    token, redirect_url = await oauth_service.authenticate_oauth(
        provider=provider,
        code=code,
        state_param=state,
        state_cookie=oauth_state,
        nonce_cookie=oauth_nonce,
    )

    response.delete_cookie("oauth_state", path="/api/v1/auth")
    response.delete_cookie("oauth_nonce", path="/api/v1/auth")

    return token


@router.post("/auth/oauth", response_model=Token, tags=["Authentication"])
async def oauth_login_legacy(
    request: OAuthLoginRequest, db: AsyncSession = Depends(get_db)
):
    """
    Legacy/Direct OAuth token exchange API endpoint boundary.
    """
    if request.provider not in ["google", "github"]:
        raise OAuthException(f"Unsupported OAuth provider '{request.provider}'")

    return Token(
        access_token=f"oauth_placeholder_token_for_{request.provider}",
        token_type="bearer",
        refresh_token=f"oauth_placeholder_refresh_token_for_{request.provider}",
    )


@router.get("/auth/me", response_model=UserResponse, tags=["Authentication"])
async def get_auth_me(current_user: User = Depends(get_current_user)):
    """Retrieves profile of currently authenticated user."""
    return UserResponse.model_validate(current_user)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT, tags=["Authentication"])
async def logout(response: Response):
    """
    Logout endpoint. Clears OAuth state and nonce cookies.
    Client should discard stored JWT access/refresh tokens.
    """
    response.delete_cookie("oauth_state", path="/api/v1/auth")
    response.delete_cookie("oauth_nonce", path="/api/v1/auth")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
