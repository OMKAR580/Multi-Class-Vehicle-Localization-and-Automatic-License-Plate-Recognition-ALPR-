from typing import Optional
from sqlalchemy import Boolean, Column, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class User(BaseModel):
    __tablename__ = "users"
    
    username = Column(String(100), unique=True, index=True, nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # Nullable for OAuth-only users
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
    role = Column(String(50), default="operator")  # 'admin', 'user', 'operator'
    avatar_url = Column(String(512), nullable=True)

    @property
    def password_hash(self) -> Optional[str]:
        return self.hashed_password

    @password_hash.setter
    def password_hash(self, value: Optional[str]) -> None:
        self.hashed_password = value

    # Relationships
    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="all, delete-orphan")
    identities = relationship("UserIdentity", back_populates="user", cascade="all, delete-orphan")
    detections = relationship("DetectionJob", back_populates="user")
    reports = relationship("Report", back_populates="user")
    report_folders = relationship("ReportFolder", back_populates="user", cascade="all, delete-orphan")

class UserIdentity(BaseModel):
    __tablename__ = "user_identities"
    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_user_identity_provider_user_id"),
    )

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(50), nullable=False)  # 'email', 'google', 'github'
    provider_user_id = Column(String(255), nullable=False, index=True)
    provider_email = Column(String(255), nullable=True)

    user = relationship("User", back_populates="identities")

class OAuthAccount(BaseModel):
    __tablename__ = "oauth_accounts"
    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_user_id"),
        UniqueConstraint("user_id", "provider", name="uq_user_provider"),
    )

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(50), nullable=False)  # 'google', 'github'
    provider_user_id = Column(String(255), nullable=False, index=True)
    access_token = Column(String(1024), nullable=True)
    refresh_token = Column(String(1024), nullable=True)

    user = relationship("User", back_populates="oauth_accounts")
