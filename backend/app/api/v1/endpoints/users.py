from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate
from app.services.user_service import UserService

router = APIRouter()


@router.get("/users/me", response_model=UserResponse, tags=["Users"])
async def read_current_user(current_user: User = Depends(get_current_user)):
    """
    Get Currently Authenticated User Profile Endpoint.
    """
    return UserResponse.model_validate(current_user)


@router.patch("/users/me", response_model=UserResponse, tags=["Users"])
async def update_current_user_profile(
    update_dto: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update Currently Authenticated User Profile Endpoint.
    Allows updating display attributes ('full_name', 'avatar_url').
    Protected attributes (id, email, role, is_active, is_superuser, password) are forbidden.
    """
    user_service = UserService(db)
    updated_user = await user_service.update_profile(current_user, update_dto)
    return UserResponse.model_validate(updated_user)
