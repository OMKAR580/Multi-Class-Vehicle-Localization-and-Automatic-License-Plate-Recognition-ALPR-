from typing import Optional
from pydantic import BaseModel, EmailStr, HttpUrl


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: str


class TokenPayload(BaseModel):
    sub: str
    type: str
    exp: Optional[int] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OAuthLoginRequest(BaseModel):
    provider: str  # 'google' or 'github'
    code: str
    redirect_uri: str


class OAuthRedirectResponse(BaseModel):
    authorization_url: str
    provider: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str
