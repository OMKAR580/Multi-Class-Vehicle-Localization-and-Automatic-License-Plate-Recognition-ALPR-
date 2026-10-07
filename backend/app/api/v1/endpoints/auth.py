from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.auth import Token, LoginRequest, OAuthLoginRequest
from app.services.auth_service import AuthService

router = APIRouter()

@router.post("/auth/login", response_model=Token, tags=["Authentication"])
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Standard Email/Password Login Endpoint.
    """
    auth_service = AuthService(db)
    return await auth_service.authenticate_user(request.email, request.password)

@router.post("/auth/oauth", response_model=Token, tags=["Authentication"])
async def oauth_login(request: OAuthLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Google & GitHub OAuth Login Endpoint Boundary.
    """
    if request.provider not in ["google", "github"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported OAuth provider")
    
    # Placeholder OAuth exchange contract
    return Token(
        access_token=f"oauth_placeholder_token_for_{request.provider}",
        token_type="bearer",
        refresh_token=f"oauth_placeholder_refresh_token_for_{request.provider}"
    )
