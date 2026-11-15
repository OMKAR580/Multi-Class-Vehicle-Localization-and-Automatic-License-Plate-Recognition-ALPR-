from typing import Optional
from pydantic import BaseModel, EmailStr, HttpUrl
from app.schemas.user import UserResponse


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: str
    user: Optional[UserResponse] = None


class TokenPayload(BaseModel):
    sub: str
    type: str
    exp: Optional[int] = None


class LoginRequest(BaseModel):
    email: str  # Accepts either email or username
    password: str


class OAuthSyncRequest(BaseModel):
    provider: str  # 'google' or 'github'
    provider_user_id: str
    email: EmailStr
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


class OAuthLoginRequest(BaseModel):
    provider: str  # 'google' or 'github'
    code: str
    redirect_uri: str


class OAuthRedirectResponse(BaseModel):
    authorization_url: str
    provider: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str
