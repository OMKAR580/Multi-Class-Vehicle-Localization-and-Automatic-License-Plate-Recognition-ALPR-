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
    Token,
    OAuthSyncRequest,
)
from app.schemas.user import UserCreate, UserResponse
from app.services.auth_service import AuthService
from app.services.oauth_service import OAuthService

router = APIRouter()


@router.post("/auth/login", response_model=Token, tags=["Authentication"])
async def login(
    request: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Standard Email/Password Login Endpoint with HttpOnly Session Cookie."""
    auth_service = AuthService(db)
    token_data = await auth_service.authenticate_user(request.email, request.password)
    
    is_production = settings.ENVIRONMENT == "production"
    response.set_cookie(
        key="access_token",
        value=token_data["access_token"],
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    user_model = token_data.get("user")
    user_resp = UserResponse.model_validate(user_model) if user_model else None
    return Token(
        access_token=token_data["access_token"],
        refresh_token=token_data["refresh_token"],
        token_type=token_data["token_type"],
        user=user_resp,
    )


@router.post(
    "/auth/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    tags=["Authentication"],
)
async def register(
    request: UserCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Standard Email/Password Registration Endpoint with HttpOnly Session Cookie."""
    auth_service = AuthService(db)
    token_data = await auth_service.register_user(
        email=request.email,
        password=request.password,
        username=request.username,
        full_name=request.full_name,
    )

    is_production = settings.ENVIRONMENT == "production"
    response.set_cookie(
        key="access_token",
        value=token_data["access_token"],
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    user_model = token_data.get("user")
    user_resp = UserResponse.model_validate(user_model) if user_model else None
    return Token(
        access_token=token_data["access_token"],
        refresh_token=token_data["refresh_token"],
        token_type=token_data["token_type"],
        user=user_resp,
    )


@router.post("/auth/oauth/sync", tags=["Authentication"])
async def oauth_sync(
    data: OAuthSyncRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Synchronizes OAuth provider identity with Supabase PostgreSQL.
    - If user exists: links OAuth identity and issues real cryptographically signed JWT.
    - If user is new and password provided: creates full account in Supabase and issues real JWT.
    - If user is new and no password: returns needs_setup status for username & password completion.
    """
    auth_service = AuthService(db)
    result = await auth_service.sync_oauth_user(data)

    if result.get("status") == "authenticated":
        access_token = result["access_token"]
        is_production = settings.ENVIRONMENT == "production"
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=is_production,
            samesite="lax",
            max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            path="/",
        )
        user_model = result.get("user")
        user_resp = UserResponse.model_validate(user_model) if user_model else None
        return {
            "status": "authenticated",
            "access_token": access_token,
            "refresh_token": result["refresh_token"],
            "token_type": "bearer",
            "user": user_resp.model_dump() if user_resp else None,
        }
    return result


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
    request: Request,
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
    - For API / SPA clients: Returns Token schema payload.
    - For Web Browser clients with redirect_url: Sets HttpOnly session cookie and 302 redirects safely.
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

    is_production = settings.ENVIRONMENT == "production"
    accept_header = request.headers.get("accept", "")

    if redirect_url and "text/html" in accept_header:
        redirect_resp = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
        redirect_resp.delete_cookie("oauth_state", path="/api/v1/auth")
        redirect_resp.delete_cookie("oauth_nonce", path="/api/v1/auth")
        redirect_resp.set_cookie(
            key="access_token",
            value=token.access_token,
            httponly=True,
            secure=is_production,
            samesite="lax",
            max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            path="/",
        )
        return redirect_resp

    response.delete_cookie("oauth_state", path="/api/v1/auth")
    response.delete_cookie("oauth_nonce", path="/api/v1/auth")
    return token


@router.get("/auth/me", response_model=UserResponse, tags=["Authentication"])
async def get_auth_me(current_user: User = Depends(get_current_user)):
    """Retrieves profile of currently authenticated user."""
    return UserResponse.model_validate(current_user)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT, tags=["Authentication"])
async def logout(response: Response):
    """
    Logout endpoint. Clears session access token, OAuth state and nonce cookies.
    Client should discard stored JWT access/refresh tokens.
    """
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("oauth_state", path="/api/v1/auth")
    response.delete_cookie("oauth_nonce", path="/api/v1/auth")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
