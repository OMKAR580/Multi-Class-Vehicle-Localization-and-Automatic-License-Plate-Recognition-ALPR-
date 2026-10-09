from typing import Optional
from urllib.parse import urlparse
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=255)
    avatar_url: Optional[str] = Field(default=None, max_length=512)

    model_config = ConfigDict(extra="forbid")

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


class UserResponse(UserBase):
    id: str
    is_active: bool
    role: str

    model_config = ConfigDict(from_attributes=True)
