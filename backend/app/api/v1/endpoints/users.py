from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.user import UserResponse

router = APIRouter()

@router.get("/users/me", response_model=UserResponse, tags=["Users"])
async def get_current_user(db: AsyncSession = Depends(get_db)):
    """
    Get Currently Authenticated User Profile Endpoint.
    """
    return UserResponse(
        id="usr_demo_123",
        email="demo.user@vehiclevision.ai",
        full_name="Demo Operator",
        is_active=True,
        role="operator"
    )
