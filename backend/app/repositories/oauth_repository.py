from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.user import OAuthAccount


class OAuthRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_provider(
        self, provider: str, provider_user_id: str
    ) -> Optional[OAuthAccount]:
        result = await self.session.execute(
            select(OAuthAccount).where(
                OAuthAccount.provider == provider,
                OAuthAccount.provider_user_id == provider_user_id,
            )
        )
        return result.scalars().first()

    async def get_by_user_and_provider(
        self, user_id: str, provider: str
    ) -> Optional[OAuthAccount]:
        result = await self.session.execute(
            select(OAuthAccount).where(
                OAuthAccount.user_id == user_id,
                OAuthAccount.provider == provider,
            )
        )
        return result.scalars().first()

    async def create(self, account: OAuthAccount) -> OAuthAccount:
        self.session.add(account)
        await self.session.commit()
        await self.session.refresh(account)
        return account
