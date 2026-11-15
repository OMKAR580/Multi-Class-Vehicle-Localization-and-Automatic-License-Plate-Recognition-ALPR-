from typing import Any, Dict, Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UsernameAlreadyExistsException
from app.core.security import verify_password, get_password_hash
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserIdentityResponse, UserProfileResponse, UserUpdate


class UserService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)

    async def get_profile(self, user: User) -> UserProfileResponse:
        """
        Retrieves the profile of the currently authenticated user including linked identities.
        Explicitly loads identities to prevent MissingGreenlet in async SQLAlchemy.
        """
        identities = await self.user_repo.get_user_identities(user.id)
        id_dtos = [
            UserIdentityResponse(
                provider=i.provider,
                provider_email=i.provider_email,
                created_at=i.created_at,
            )
            for i in identities
        ]
        return UserProfileResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
            is_active=user.is_active,
            email_verified=user.email_verified,
            role=user.role,
            created_at=user.created_at,
            identities=id_dtos,
        )

    async def update_profile(self, user: User, update_dto: UserUpdate) -> UserProfileResponse:
        """
        Updates the profile of the currently authenticated user.
        Excludes unset fields to preserve omitted properties during partial updates.
        Validates username uniqueness if username is being changed.
        """
        update_data = update_dto.model_dump(exclude_unset=True)
        if not update_data:
            return await self.get_profile(user)

        # Validate username uniqueness
        if "username" in update_data and update_data["username"]:
            new_username = update_data["username"].lower().strip()
            if new_username != (user.username or "").lower():
                existing = await self.user_repo.get_by_username(new_username)
                if existing and existing.id != user.id:
                    raise UsernameAlreadyExistsException(
                        f"Username '{new_username}' is already taken by another account."
                    )
            update_data["username"] = new_username

        updated_user = await self.user_repo.update(user, update_data)
        return await self.get_profile(updated_user)

    async def change_password(
        self, user: User, current_password: Optional[str], new_password: str
    ) -> None:
        """
        Updates user password. Verifies current password if user has one set.
        """
        if user.hashed_password:
            if not current_password or not verify_password(current_password, user.hashed_password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password does not match.",
                )
        
        hashed = get_password_hash(new_password)
        await self.user_repo.update(user, {"hashed_password": hashed})
