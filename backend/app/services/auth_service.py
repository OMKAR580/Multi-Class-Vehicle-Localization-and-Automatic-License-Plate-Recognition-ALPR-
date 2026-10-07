from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.user_repository import UserRepository
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.core.exceptions import InvalidCredentialsException
from app.models.user import User

class AuthService:
    def __init__(self, session: AsyncSession):
        self.repo = UserRepository(session)

    async def authenticate_user(self, email: str, password: str) -> dict:
        user = await self.repo.get_by_email(email)
        if not user or not user.hashed_password:
            raise InvalidCredentialsException()
        if not verify_password(password, user.hashed_password):
            raise InvalidCredentialsException()
        
        access_token = create_access_token(subject=user.id)
        refresh_token = create_refresh_token(subject=user.id)
        return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}
