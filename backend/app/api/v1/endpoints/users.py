from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.user import ChangePasswordRequest, UserProfileResponse, UserUpdate
from app.services.user_service import UserService

router = APIRouter()


@router.get("/users/me", response_model=UserProfileResponse, tags=["Users"])
async def read_current_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get Currently Authenticated User Profile Endpoint.
    Retrieves full user profile with linked identities.
    """
    user_service = UserService(db)
    return await user_service.get_profile(current_user)


@router.patch("/users/me", response_model=UserProfileResponse, tags=["Users"])
async def update_current_user_profile(
    update_dto: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update Currently Authenticated User Profile Endpoint.
    Allows updating display attributes ('full_name', 'username', 'avatar_url').
    Protected attributes (id, email, role, is_active, is_superuser, password) are forbidden.
    """
    user_service = UserService(db)
    return await user_service.update_profile(current_user, update_dto)


@router.post("/users/me/password", tags=["Users"])
async def change_current_user_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Change Password Endpoint.
    Verifies current password and updates password hash.
    """
    user_service = UserService(db)
    await user_service.change_password(current_user, data.current_password, data.new_password)
    return {"message": "Password updated successfully."}
