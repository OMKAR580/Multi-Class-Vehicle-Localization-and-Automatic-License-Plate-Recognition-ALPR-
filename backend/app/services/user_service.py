from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserUpdate


class UserService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)

    async def update_profile(self, user: User, update_dto: UserUpdate) -> User:
        """
        Updates the profile of the currently authenticated user.
        Excludes unset fields to preserve omitted properties during partial updates.
        """
        update_data = update_dto.model_dump(exclude_unset=True)
        if not update_data:
            return user

        return await self.user_repo.update(user, update_data)
