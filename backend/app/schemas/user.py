from datetime import datetime
from typing import Optional
from urllib.parse import urlparse
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserBase(BaseModel):
    email: EmailStr
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserCreate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None


class UserIdentityResponse(BaseModel):
    provider: str
    provider_email: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    full_name: Optional[str] = Field(default=None, max_length=255)
    avatar_url: Optional[str] = Field(default=None, max_length=512)

    model_config = ConfigDict(extra="forbid")

    @field_validator("username", mode="before")
    @classmethod
    def validate_username(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip().lower()
            if len(stripped) < 3:
                raise ValueError("username must be at least 3 characters long")
            if not stripped.replace("_", "").replace("-", "").isalnum():
                raise ValueError("username can only contain alphanumeric characters, underscores, and hyphens")
            return stripped
        return value

    @field_validator("full_name", mode="before")
    @classmethod
    def validate_full_name(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            if len(stripped) == 0:
                raise ValueError("full_name cannot be an empty or whitespace-only string")
            return stripped
        return value

    @field_validator("avatar_url", mode="before")
    @classmethod
    def validate_avatar_url(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            if len(stripped) == 0:
                return None
            try:
                parsed = urlparse(stripped)
            except Exception:
                raise ValueError("Invalid avatar_url format")
            if parsed.scheme not in ["http", "https"] or not parsed.netloc:
                raise ValueError("avatar_url must be a valid HTTP or HTTPS URL")
            return stripped
        return value


class UserResponse(BaseModel):
    id: str
    username: Optional[str] = None
    email: EmailStr
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool = True
    email_verified: bool = False
    role: str = "operator"
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("email_verified", mode="before")
    @classmethod
    def set_email_verified(cls, v: object) -> bool:
        return bool(v) if v is not None else False

    @field_validator("is_active", mode="before")
    @classmethod
    def set_is_active(cls, v: object) -> bool:
        return bool(v) if v is not None else True

    @field_validator("role", mode="before")
    @classmethod
    def set_role(cls, v: object) -> str:
        return str(v) if v is not None else "operator"


class UserProfileResponse(UserResponse):
    identities: list[UserIdentityResponse] = Field(default_factory=list)


class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str = Field(..., min_length=6, max_length=128)
