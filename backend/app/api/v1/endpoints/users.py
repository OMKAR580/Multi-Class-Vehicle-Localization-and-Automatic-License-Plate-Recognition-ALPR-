from fastapi import APIRouter, Depends
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()


@router.get("/users/me", response_model=UserResponse, tags=["Users"])
async def read_current_user(current_user: User = Depends(get_current_user)):
    """
    Get Currently Authenticated User Profile Endpoint.
    """
    return UserResponse.model_validate(current_user)
