from typing import Any, Optional
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.exceptions import OAuthException
from app.models.user import OAuthAccount, User


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: str) -> Optional[User]:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalars().first()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(
            select(User).where(User.email == email.lower().strip())
        )
        return result.scalars().first()

    async def get_by_oauth(
        self, provider: str, provider_user_id: str
    ) -> Optional[User]:
        result = await self.session.execute(
            select(User)
            .join(OAuthAccount, User.id == OAuthAccount.user_id)
            .where(
                OAuthAccount.provider == provider,
                OAuthAccount.provider_user_id == provider_user_id,
            )
        )
        return result.scalars().first()

    async def create(self, user: User) -> User:
        if user.email:
            user.email = user.email.lower().strip()
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update(self, user: User, update_data: dict[str, Any]) -> User:
        """Updates allowed attributes on an existing User record."""
        for key, value in update_data.items():
            if hasattr(user, key):
                setattr(user, key, value)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def get_or_create_oauth_user(
        self,
        provider: str,
        provider_user_id: str,
        email: str,
        full_name: Optional[str] = None,
        avatar_url: Optional[str] = None,
        access_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
    ) -> User:
        """
        Retrieves existing user strictly linked via provider + provider_user_id identity.
        If no link exists and email belongs to an existing account, implicit linking is rejected.
        Otherwise, creates new User and OAuthAccount transactionally with IntegrityError conflict handling.
        """
        normalized_email = email.lower().strip()

        # 1. Authoritative provider identity lookup
        user = await self.get_by_oauth(provider, provider_user_id)
        if user:
            if full_name and not user.full_name:
                user.full_name = full_name
            if avatar_url and not user.avatar_url:
                user.avatar_url = avatar_url

            result = await self.session.execute(
                select(OAuthAccount).where(
                    OAuthAccount.user_id == user.id,
                    OAuthAccount.provider == provider,
                )
            )
            oauth_acc = result.scalars().first()
            if oauth_acc:
                oauth_acc.access_token = None
                oauth_acc.refresh_token = None

            try:
                await self.session.commit()
                await self.session.refresh(user)
            except IntegrityError:
                await self.session.rollback()
                user = await self.get_by_oauth(provider, provider_user_id)
                if not user:
                    raise OAuthException("Database error updating OAuth user account")
            return user

        # 2. Reject implicit account linking if email matches existing account
        existing_user_by_email = await self.get_by_email(normalized_email)
        if existing_user_by_email:
            raise OAuthException(
                "An account with this email address already exists. Implicit account linking is disabled for security reasons."
            )

        # 3. Create new User and OAuthAccount in a single transaction
        new_user = User(
            email=normalized_email,
            full_name=full_name,
            avatar_url=avatar_url,
            is_active=True,
            role="user",
        )
        self.session.add(new_user)
        try:
            await self.session.flush()
            oauth_acc = OAuthAccount(
                user_id=new_user.id,
                provider=provider,
                provider_user_id=provider_user_id,
                access_token=None,
                refresh_token=None,
            )

            self.session.add(oauth_acc)
            await self.session.commit()
            await self.session.refresh(new_user)
            return new_user
        except IntegrityError:
            await self.session.rollback()
            existing_oauth_user = await self.get_by_oauth(provider, provider_user_id)
            if existing_oauth_user:
                return existing_oauth_user
            raise OAuthException(
                "OAuth account creation failed due to database constraint conflict."
            )
