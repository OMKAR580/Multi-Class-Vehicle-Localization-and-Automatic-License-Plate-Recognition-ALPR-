import re
import secrets
import time
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.user_repository import UserRepository
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.core.exceptions import (
    AccountNotFoundException,
    AccountDisabledException,
    InvalidCredentialsException,
    EmailAlreadyExistsException,
    UsernameAlreadyExistsException,
    InvalidEmailException,
    WeakPasswordException,
    AppException,
)
from app.models.user import User
from app.schemas.auth import OAuthSyncRequest

class AuthService:
    def __init__(self, session: AsyncSession):
        self.repo = UserRepository(session)

    async def authenticate_user(self, identifier: str, password: str) -> dict:
        clean_id = identifier.strip().lower()
        # Look up by email first, then fallback to username
        user = await self.repo.get_by_email(clean_id)
        if not user:
            user = await self.repo.get_by_username(clean_id)
        
        # 1. Check if user account exists
        if not user:
            raise AccountNotFoundException(
                "No account found with this email or username. Please create an account."
            )
        
        # 2. Check if account is active
        if not user.is_active:
            raise AccountDisabledException(
                "This account has been deactivated. Please contact an administrator."
            )
        
        # 3. Check if password exists (social-only accounts)
        if not user.hashed_password:
            raise InvalidCredentialsException(
                "This account was created via social login (Google/GitHub). Please sign in with your social provider."
            )
        
        # 4. Verify password
        if not verify_password(password, user.hashed_password):
            raise InvalidCredentialsException(
                "Incorrect password. Please try again."
            )
        
        access_token = create_access_token(subject=user.id)
        refresh_token = create_refresh_token(subject=user.id)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": user,
        }

    async def sync_oauth_user(self, data: OAuthSyncRequest) -> dict:
        normalized_email = data.email.lower().strip()
        user = await self.repo.get_by_oauth(data.provider, data.provider_user_id)
        if not user:
            user = await self.repo.get_by_email(normalized_email)

        if user:
            # User already exists in database (e.g. created via email/password or prior OAuth)
            if data.password and not user.hashed_password:
                user.hashed_password = get_password_hash(data.password)
            if data.username and not user.username:
                clean_u = data.username.lower().strip()
                exist_u = await self.repo.get_by_username(clean_u)
                if not exist_u or exist_u.id == user.id:
                    user.username = clean_u
            if data.full_name and not user.full_name:
                user.full_name = data.full_name
            if data.avatar_url and not user.avatar_url:
                user.avatar_url = data.avatar_url

            user = await self.repo.get_or_create_oauth_user(
                provider=data.provider,
                provider_user_id=data.provider_user_id,
                email=normalized_email,
                full_name=data.full_name,
                avatar_url=data.avatar_url,
            )

            access_token = create_access_token(subject=user.id)
            refresh_token = create_refresh_token(subject=user.id)
            return {
                "status": "authenticated",
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "user": user,
            }

        # User does not exist yet
        # If user has not yet entered password/username, instruct frontend to request it
        if not data.password:
            base_u = normalized_email.split("@")[0].replace(".", "_")
            return {
                "status": "needs_setup",
                "email": normalized_email,
                "full_name": data.full_name or normalized_email.split("@")[0],
                "provider": data.provider,
                "provider_user_id": data.provider_user_id,
                "avatar_url": data.avatar_url,
                "suggested_username": base_u,
            }

        # Password provided -> create new full account with OAuth identity linked
        desired_u = (data.username or normalized_email.split("@")[0]).lower().strip().replace(".", "_")
        existing_u = await self.repo.get_by_username(desired_u)
        final_username = desired_u if not existing_u else f"{desired_u}_{secrets.token_hex(2)}"

        new_user = User(
            username=final_username,
            email=normalized_email,
            hashed_password=get_password_hash(data.password),
            full_name=data.full_name or final_username,
            avatar_url=data.avatar_url,
            is_active=True,
            email_verified=True,
            role="operator",
        )
        created_user = await self.repo.create_with_identity(
            user=new_user,
            provider=data.provider,
            provider_user_id=data.provider_user_id,
            provider_email=normalized_email,
        )

        await self.repo.get_or_create_oauth_user(
            provider=data.provider,
            provider_user_id=data.provider_user_id,
            email=normalized_email,
            full_name=data.full_name,
            avatar_url=data.avatar_url,
        )

        access_token = create_access_token(subject=created_user.id)
        refresh_token = create_refresh_token(subject=created_user.id)
        return {
            "status": "authenticated",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": created_user,
        }

    async def register_user(
        self,
        email: str,
        password: str,
        username: Optional[str] = None,
        full_name: Optional[str] = None,
    ) -> dict:
        normalized_email = email.lower().strip()
        
        # 1. Email format check
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", normalized_email):
            raise InvalidEmailException("Please enter a valid email address.")

        # 2. Password length check
        if len(password) < 6:
            raise WeakPasswordException("Password must be at least 6 characters long.")

        # 3. Username generation / validation
        if username:
            normalized_username = username.lower().strip()
            if not re.match(r"^[a-zA-Z0-9_-]{3,30}$", normalized_username):
                raise AppException(
                    "Username must be 3-30 characters and contain only letters, numbers, underscores, or hyphens.",
                    code="INVALID_USERNAME",
                    status_code=400,
                )
        else:
            base_user = normalized_email.split("@")[0].replace(".", "_")
            normalized_username = re.sub(r"[^a-zA-Z0-9_-]", "", base_user)[:30] or f"user_{int(time.time())}"

        # 4. Uniqueness checks
        existing_email = await self.repo.get_by_email(normalized_email)
        if existing_email:
            raise EmailAlreadyExistsException("An account with this email already exists.")

        existing_user = await self.repo.get_by_username(normalized_username)
        if existing_user:
            raise UsernameAlreadyExistsException("An account with this username already exists.")

        hashed = get_password_hash(password)
        new_user = User(
            username=normalized_username,
            email=normalized_email,
            hashed_password=hashed,
            full_name=full_name.strip() if full_name else normalized_username,
            role="operator",
            is_active=True,
            email_verified=False,
        )

        created_user = await self.repo.create_with_identity(
            user=new_user,
            provider="email",
            provider_user_id=new_user.id,
            provider_email=normalized_email,
        )

        access_token = create_access_token(subject=created_user.id)
        refresh_token = create_refresh_token(subject=created_user.id)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": created_user,
        }
