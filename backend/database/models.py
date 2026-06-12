import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, JSON, Text, Boolean, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from typing import Optional, List
import enum


class Base(DeclarativeBase):
    pass


class TaskStatus(str, enum.Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class UserRole(str, enum.Enum):
    """The 3 user types in RelatiV's marketplace.

    - CREATOR: owns source content (YouTube, podcasts, etc.). Uploads videos
      for clipping. Earns a share of CPM when brands pay.
    - BRAND: D2C brand, agency, or campaign sponsor. Posts campaigns, sets
      CPM, approves clips, pays invoices.
    - CLIPPER: Pro/Elite subscriber who creates clips for brand campaigns.
      Pays a monthly subscription ($19 Pro, $99 Elite). 70/30 revenue share.

    Clippers-as-applicants (free, not yet approved) are tracked separately
    in the intake store — they don't have user accounts until accepted.
    """
    CREATOR = "creator"
    BRAND = "brand"
    CLIPPER = "clipper"


class TaskModel(Base):
    __tablename__ = "tasks"

    task_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    url: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default=TaskStatus.QUEUED)
    position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    current_step: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    step_number: Mapped[int] = mapped_column(Integer, default=0)
    step_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    step_times: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

    clips = relationship("ClipModel", back_populates="task", cascade="all, delete-orphan")


class ClipModel(Base):
    __tablename__ = "clips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clip_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.task_id"), nullable=False)
    start: Mapped[float] = mapped_column(Float, nullable=False)
    end: Mapped[float] = mapped_column(Float, nullable=False)
    duration_s: Mapped[float] = mapped_column(Float, nullable=False)
    caption: Mapped[str] = mapped_column(Text, default="")
    viral_title: Mapped[str] = mapped_column(String(200), default="")
    hashtags: Mapped[str] = mapped_column(String(500), default="")
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_size_mb: Mapped[float] = mapped_column(Float, default=0)
    story_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    task = relationship("TaskModel", back_populates="clips")


# ─────────────────────────────────────────────────────────────────────────────
# Auth models (Day 4 — creators, D2C brands, paying clippers)
# Clipping-economy data (clippers/apply form) is owned by the founder and
# will be wired in after v1 has run for a while. Auth here is for the
# other 3 user types: CREATOR, BRAND, CLIPPER (paying).
# ─────────────────────────────────────────────────────────────────────────────


class UserModel(Base):
    """Core user account. The role determines which Profile row joins
    (`creator_profiles`, `brand_profiles`, or `clipper_profiles`)."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # UserRole enum
    name: Mapped[str] = mapped_column(String(200), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # 1:1 profile per role. Nullable because each user has only one.
    creator_profile = relationship("CreatorProfileModel", back_populates="user", uselist=False, cascade="all, delete-orphan")
    brand_profile = relationship("BrandProfileModel", back_populates="user", uselist=False, cascade="all, delete-orphan")
    clipper_profile = relationship("ClipperProfileModel", back_populates="user", uselist=False, cascade="all, delete-orphan")


class CreatorProfileModel(Base):
    """Creator-specific data. A creator is a content owner — YouTuber,
    podcaster, news outlet — who wants their long-form video clipped."""

    __tablename__ = "creator_profiles"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    # Public handle and platform links
    handle: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    primary_platform: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)  # youtube, spotify, etc.
    channel_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # Perks
    revenue_share_bps: Mapped[int] = mapped_column(Integer, default=1500)  # 15% default; basis points
    auto_approve_clips: Mapped[bool] = mapped_column(Boolean, default=False)
    # Aggregates
    total_videos_uploaded: Mapped[int] = mapped_column(Integer, default=0)
    total_views_earned: Mapped[int] = mapped_column(Integer, default=0)
    total_revenue_cents: Mapped[int] = mapped_column(Integer, default=0)

    user = relationship("UserModel", back_populates="creator_profile")


class BrandProfileModel(Base):
    """Brand-specific data. A brand is a D2C company, agency, or campaign
    sponsor that posts campaigns and pays clippers for views."""

    __tablename__ = "brand_profiles"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    company_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    # Billing
    billing_email: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    payment_terms: Mapped[str] = mapped_column(String(20), default="net15")  # prepay, net15, net30
    credit_limit_cents: Mapped[int] = mapped_column(Integer, default=0)
    # Aggregates
    total_campaigns_run: Mapped[int] = mapped_column(Integer, default=0)
    total_spend_cents: Mapped[int] = mapped_column(Integer, default=0)

    user = relationship("UserModel", back_populates="brand_profile")


class ClipperProfileModel(Base):
    """Paying clipper data. Subscription tier + earnings + payout info.
    Free / unvetted clippers do NOT have user accounts — they apply via
    the public form and wait for review."""

    __tablename__ = "clipper_profiles"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    handle: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    specialty: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    subscription_tier: Mapped[str] = mapped_column(String(20), default="pro")  # pro, elite
    subscription_status: Mapped[str] = mapped_column(String(20), default="active")  # active, paused, cancelled, past_due
    subscription_renews_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    # Payout
    payout_method: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # upi, paypal, usdc, ach
    payout_handle: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # Aggregates
    lifetime_earnings_cents: Mapped[int] = mapped_column(Integer, default=0)
    pending_payout_cents: Mapped[int] = mapped_column(Integer, default=0)

    user = relationship("UserModel", back_populates="clipper_profile")


class SessionModel(Base):
    """Server-side session. JWT is the client cookie, but we keep a
    server row so we can revoke sessions (sign out everywhere, ban user,
    expire leaked tokens)."""

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # random opaque
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    jwt_jti: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)  # matches JWT jti claim
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    ip_hash: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)  # hashed, not raw
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
