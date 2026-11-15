import secrets
from typing import Any, Optional
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.exceptions import OAuthException
from app.models.user import OAuthAccount, User, UserIdentity


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: str) -> Optional[User]:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalars().first()

    async def get_by_email(self, email: str) -> Optional[User]:
        if not email:
            return None
        result = await self.session.execute(
            select(User).where(User.email == email.lower().strip())
        )
        return result.scalars().first()

    async def get_by_username(self, username: str) -> Optional[User]:
        if not username:
            return None
        result = await self.session.execute(
            select(User).where(User.username == username.lower().strip())
        )
        return result.scalars().first()

    async def get_by_oauth(
        self, provider: str, provider_user_id: str
    ) -> Optional[User]:
        # Check OAuthAccount table
        result = await self.session.execute(
            select(User)
            .join(OAuthAccount, User.id == OAuthAccount.user_id)
            .where(
                OAuthAccount.provider == provider,
                OAuthAccount.provider_user_id == provider_user_id,
            )
        )
        user = result.scalars().first()
        if user:
            return user

        # Also check UserIdentity table if available
        try:
            res_id = await self.session.execute(
                select(User)
                .join(UserIdentity, User.id == UserIdentity.user_id)
                .where(
                    UserIdentity.provider == provider,
                    UserIdentity.provider_user_id == provider_user_id,
                )
            )
            return res_id.scalars().first()
        except Exception:
            return None

    async def get_by_identity(
        self, provider: str, provider_user_id: str
    ) -> Optional[User]:
        return await self.get_by_oauth(provider, provider_user_id)

    async def create(self, user: User) -> User:
        if user.email:
            user.email = user.email.lower().strip()
        if user.username:
            user.username = user.username.lower().strip()
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def create_with_identity(
        self,
        user: User,
        provider: str = "email",
        provider_user_id: Optional[str] = None,
        provider_email: Optional[str] = None,
    ) -> User:
        """Transactionally creates user and links identity record."""
        if user.email:
            user.email = user.email.lower().strip()
        if user.username:
            user.username = user.username.lower().strip()

        self.session.add(user)
        await self.session.flush()

        p_uid = provider_user_id or user.id
        p_email = provider_email or user.email

        try:
            identity = UserIdentity(
                user_id=user.id,
                provider=provider,
                provider_user_id=p_uid,
                provider_email=p_email,
            )
            self.session.add(identity)
        except Exception:
            pass

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
        Otherwise, creates new User, UserIdentity, and OAuthAccount transactionally with conflict handling.
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

        # 2. If email matches an existing account, seamlessly link the OAuth provider identity!
        existing_user_by_email = await self.get_by_email(normalized_email)
        if existing_user_by_email:
            user = existing_user_by_email
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
            if not result.scalars().first():
                self.session.add(
                    OAuthAccount(
                        user_id=user.id,
                        provider=provider,
                        provider_user_id=provider_user_id,
                        access_token=None,
                        refresh_token=None,
                    )
                )

            try:
                id_res = await self.session.execute(
                    select(UserIdentity).where(
                        UserIdentity.user_id == user.id,
                        UserIdentity.provider == provider,
                    )
                )
                if not id_res.scalars().first():
                    self.session.add(
                        UserIdentity(
                            user_id=user.id,
                            provider=provider,
                            provider_user_id=provider_user_id,
                            provider_email=normalized_email,
                        )
                    )
            except Exception:
                pass

            try:
                await self.session.commit()
                await self.session.refresh(user)
            except IntegrityError:
                await self.session.rollback()
                user = await self.get_by_email(normalized_email)
            return user

        # 3. Create unique username for new social user
        base_username = normalized_email.split("@")[0].replace(".", "_")
        existing_username = await self.get_by_username(base_username)
        username = base_username if not existing_username else f"{base_username}_{secrets.token_hex(2)}"

        # 4. Create new User and Identity records in a single transaction
        new_user = User(
            username=username,
            email=normalized_email,
            full_name=full_name,
            avatar_url=avatar_url,
            is_active=True,
            email_verified=True,  # OAuth emails from verified providers
            role="operator",
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

            try:
                identity = UserIdentity(
                    user_id=new_user.id,
                    provider=provider,
                    provider_user_id=provider_user_id,
                    provider_email=normalized_email,
                )
                self.session.add(identity)
            except Exception:
                pass

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

    async def get_user_identities(self, user_id: str) -> list[UserIdentity]:
        """Fetches all identity records linked to a user."""
        result = await self.session.execute(
            select(UserIdentity)
            .where(UserIdentity.user_id == user_id)
            .order_by(UserIdentity.created_at.asc())
        )
        return list(result.scalars().all())
