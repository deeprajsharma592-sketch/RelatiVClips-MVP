"""
Tier 1 migration: add marketplace tables + email/reset columns + seed test data.

Safe to run multiple times (idempotent). Detects which columns/tables already
exist via SQLAlchemy inspector before adding.

Run from /app/RelatiV (project root) with:
    docker exec relativ-backend-1 python /app/RelatiV/backend/scripts/migrate_tier1.py

Or locally:
    python -m backend.scripts.migrate_tier1
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

# Make /app/RelatiV importable when run as a script
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import create_async_engine

from backend.database.models import (
    Base,
    CampaignClipModel,
    CampaignClaimModel,
    CampaignModel,
    ClaimStatus,
    CampaignClipStatus,
    CampaignStatus,
    UserModel,
)
from backend.database.session import DATABASE_URL, get_session  # noqa: F401


# ─── Idempotent migration helpers ──────────────────────────────────────────


async def add_column_if_missing(engine, table: str, column: str, ddl: str):
    """Add a column to an existing table if it doesn't already exist.

    DDL should be the column type + constraints, e.g. "VARCHAR(64) NULL".
    """
    async with engine.begin() as conn:
        # Run the sync inspector inside the async connection
        def _column_exists(sync_conn):
            from sqlalchemy import inspect as sa_inspect
            insp = sa_inspect(sync_conn)
            return column in [c["name"] for c in insp.get_columns(table)]

        exists = await conn.run_sync(lambda c: _column_exists(c))
        if exists:
            print(f"  - {table}.{column}: already exists, skipping")
            return
        await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
        print(f"  + {table}.{column}: added")


async def create_table_if_missing(engine, model):
    """Create a single table (no cascade)."""
    async with engine.begin() as conn:
        def _table_exists(sync_conn):
            from sqlalchemy import inspect as sa_inspect
            insp = sa_inspect(sync_conn)
            return model.__tablename__ in insp.get_table_names()

        exists = await conn.run_sync(_table_exists)
        if exists:
            print(f"  - {model.__tablename__}: already exists, skipping")
            return
        await conn.run_sync(model.__table__.create)
        print(f"  + {model.__tablename__}: created")


# ─── Step 1: schema migration ───────────────────────────────────────────────


async def migrate_schema():
    engine = create_async_engine(DATABASE_URL)
    print("━━━ Step 1: schema migration ━━━")

    # 1a. Add new columns to users table
    print("\n[users] adding tier 1 columns:")
    await add_column_if_missing(engine, "users", "email_verification_token", "VARCHAR(64) NULL")
    await add_column_if_missing(engine, "users", "email_verified_at", "TIMESTAMP NULL")
    await add_column_if_missing(engine, "users", "password_reset_token", "VARCHAR(64) NULL")
    await add_column_if_missing(engine, "users", "password_reset_expires_at", "TIMESTAMP NULL")
    # Indexes for token lookups
    async with engine.begin() as conn:
        def _index_check(sync_conn):
            from sqlalchemy import inspect as sa_inspect
            insp = sa_inspect(sync_conn)
            return {i["name"] for i in insp.get_indexes("users")}

        existing_idx = await conn.run_sync(_index_check)
        if "ix_users_email_verification_token" not in existing_idx:
            await conn.execute(text("CREATE INDEX ix_users_email_verification_token ON users (email_verification_token)"))
            print("  + users.ix_users_email_verification_token: created")
        if "ix_users_password_reset_token" not in existing_idx:
            await conn.execute(text("CREATE INDEX ix_users_password_reset_token ON users (password_reset_token)"))
            print("  + users.ix_users_password_reset_token: created")

    # 1b. Create 3 new marketplace tables
    print("\n[marketplace] creating tables:")
    await create_table_if_missing(engine, CampaignModel)
    await create_table_if_missing(engine, CampaignClaimModel)
    await create_table_if_missing(engine, CampaignClipModel)

    await engine.dispose()
    print("\n✓ Schema migration complete")


# ─── Step 2: seed test data ────────────────────────────────────────────────


async def seed_data():
    """Seed 4 test accounts with realistic campaigns + clips + earnings.

    Idempotent: detects if data already exists for a user before seeding.
    """
    print("\n━━━ Step 2: seed test data ━━━")
    async for session in get_session():
        # 1. Find the 4 test users
        result = await session.execute(
            select(UserModel).where(
                UserModel.email.in_([
                    "deepraj@test.com",
                    "brand@test.com",
                    "clipper@test.com",
                    "e2e-test@relativ.video",
                ])
            )
        )
        users = {u.email: u for u in result.scalars()}
        if not users:
            print("  ✗ No test users found. Run auth tests first to create them.")
            return
        print(f"  Found {len(users)} test users: {list(users.keys())}")

        # 2. Seed brand campaigns
        brand = users.get("brand@test.com")
        if brand:
            existing = await session.execute(
                select(CampaignModel).where(CampaignModel.brand_user_id == brand.id)
            )
            if existing.scalars().first():
                print(f"  - brand@test.com: {len((await session.execute(select(CampaignModel).where(CampaignModel.brand_user_id == brand.id))).scalars().all())} campaigns already exist, skipping")
            else:
                print(f"  + Seeding campaigns for brand@test.com")
                now = datetime.now()
                campaigns = [
                    CampaignModel(
                        id=str(uuid.uuid4()),
                        brand_user_id=brand.id,
                        name="Founder Mode · Q2 Launch",
                        brief="Best 90-second moments from the Founder Mode podcast. Tech, pricing, cold email. We want clean hooks + political-neutral framing.",
                        vertical="Podcasts · Tech",
                        source_handle="@foundermode",
                        cpm_cents=700,
                        budget_cents=800_000,  # $8,000
                        spent_cents=544_000,   # $5,440
                        slots_total=24,
                        slots_filled=18,
                        status=CampaignStatus.LIVE.value,
                        starts_at=now - timedelta(days=12),
                        ends_at=now + timedelta(days=18),
                    ),
                    CampaignModel(
                        id=str(uuid.uuid4()),
                        brand_user_id=brand.id,
                        name="All-In Summit · Highlights",
                        brief="Best moments from the All-In Summit. Tech, geopolitics, deals. Clean hooks, no political framing.",
                        vertical="Podcasts · Business",
                        source_handle="@allinsummit",
                        cpm_cents=900,
                        budget_cents=1_200_000,  # $12,000
                        spent_cents=918_000,     # $9,180
                        slots_total=36,
                        slots_filled=31,
                        status=CampaignStatus.LIVE.value,
                        starts_at=now - timedelta(days=28),
                        ends_at=now + timedelta(days=62),
                    ),
                    CampaignModel(
                        id=str(uuid.uuid4()),
                        brand_user_id=brand.id,
                        name="Huberman Lab · Sleep Series",
                        brief="Sleep series highlights. 30-60s clips with a strong actionable hook. Not interested in motivation-only content.",
                        vertical="Podcasts · Health",
                        source_handle="@hubermanlab",
                        cpm_cents=600,
                        budget_cents=400_000,   # $4,000
                        spent_cents=126_000,    # $1,260
                        slots_total=12,
                        slots_filled=6,
                        status=CampaignStatus.LIVE.value,
                        starts_at=now - timedelta(days=5),
                        ends_at=now + timedelta(days=25),
                    ),
                    CampaignModel(
                        id=str(uuid.uuid4()),
                        brand_user_id=brand.id,
                        name="AI Tooling · Weekly Drops",
                        brief="Weekly AI tool releases. We're doubling down on tactical content (not motivational). Bonus for clips mentioning cold email or pricing.",
                        vertical="Education · AI",
                        source_handle="@aitooling",
                        cpm_cents=1100,
                        budget_cents=250_000,   # $2,500
                        spent_cents=0,
                        slots_total=20,
                        slots_filled=0,
                        status=CampaignStatus.PAUSED.value,
                        starts_at=now,
                        ends_at=now + timedelta(days=90),
                    ),
                ]
                for c in campaigns:
                    session.add(c)
                await session.flush()
                print(f"    + {len(campaigns)} campaigns")

                # 3. Seed clips for the clipper (per "Acme Co."'s campaigns)
                clipper = users.get("clipper@test.com")
                if clipper:
                    print(f"  + Seeding claims + clips for clipper@test.com")
                    # Pick the first 2 campaigns
                    claims_created = 0
                    clips_created = 0
                    for campaign in campaigns[:2]:
                        # 1 claim per campaign
                        claim = CampaignClaimModel(
                            id=str(uuid.uuid4()),
                            campaign_id=campaign.id,
                            clipper_user_id=clipper.id,
                            status=ClaimStatus.APPROVED.value,
                            claimed_at=now - timedelta(days=10),
                            submitted_at=now - timedelta(days=9),
                        )
                        session.add(claim)
                        await session.flush()
                        claims_created += 1

                        # 1 clip per claim
                        if campaign.name == "Founder Mode · Q2 Launch":
                            clip = CampaignClipModel(
                                id=str(uuid.uuid4()),
                                campaign_id=campaign.id,
                                claim_id=claim.id,
                                clipper_user_id=clipper.id,
                                title="The 10-10-10 rule for any pricing decision",
                                hook="The brutal truth about pricing your SaaS",
                                caption="Stop guessing your SaaS pricing. The 10-10-10 rule: 10 min, 10 months, 10 years. Here's the framework in 30s.",
                                platform="tiktok",
                                posted_url="https://tiktok.com/@hookqueen/video/12345",
                                duration_s=32,
                                status=CampaignClipStatus.PAID.value,
                                views=412_000,
                                earnings_cents=288_400,  # 412000 × 7 / 1000
                                submitted_at=now - timedelta(days=9),
                                approved_at=now - timedelta(days=8),
                                verified_at=now - timedelta(days=3),
                                paid_at=now - timedelta(days=1),
                            )
                        else:
                            clip = CampaignClipModel(
                                id=str(uuid.uuid4()),
                                campaign_id=campaign.id,
                                claim_id=claim.id,
                                clipper_user_id=clipper.id,
                                title="Why I deleted my LinkedIn (and what came back)",
                                hook="The cold truth about LinkedIn for founders",
                                caption="Deleted LinkedIn for 90 days. Here's what came back 10x harder.",
                                platform="instagram",
                                posted_url="https://instagram.com/p/abc",
                                duration_s=27,
                                status=CampaignClipStatus.VERIFIED.value,
                                views=147_000,
                                earnings_cents=132_300,
                                submitted_at=now - timedelta(days=11),
                                approved_at=now - timedelta(days=10),
                                verified_at=now - timedelta(days=2),
                            )
                        session.add(clip)
                        clips_created += 1
                    print(f"    + {claims_created} claims, {clips_created} clips")

                    # Update clipper aggregates
                    result = await session.execute(
                        select(CampaignClipModel).where(CampaignClipModel.clipper_user_id == clipper.id)
                    )
                    all_clips = result.scalars().all()
                    lifetime = sum(c.earnings_cents for c in all_clips)
                    pending = sum(c.earnings_cents for c in all_clips if c.status in (
                        CampaignClipStatus.VERIFIED.value, CampaignClipStatus.APPROVED.value
                    ))
                    # Update profile aggregates
                    from backend.database.models import ClipperProfileModel
                    profile_result = await session.execute(
                        select(ClipperProfileModel).where(ClipperProfileModel.user_id == clipper.id)
                    )
                    profile = profile_result.scalar_one_or_none()
                    if profile:
                        profile.lifetime_earnings_cents = lifetime
                        profile.pending_payout_cents = pending
                        print(f"    + clipper aggregates: lifetime=${lifetime/100:.2f}, pending=${pending/100:.2f}")

                # 4. Update brand aggregates
                from backend.database.models import BrandProfileModel
                profile_result = await session.execute(
                    select(BrandProfileModel).where(BrandProfileModel.user_id == brand.id)
                )
                profile = profile_result.scalar_one_or_none()
                if profile:
                    profile.total_campaigns_run = len(campaigns)
                    profile.total_spend_cents = sum(c.spent_cents for c in campaigns)
                    print(f"    + brand aggregates: {len(campaigns)} campaigns, ${profile.total_spend_cents/100:.0f} spend")

        # 5. Seed creator data (deepraj)
        creator = users.get("deepraj@test.com")
        if creator:
            from backend.database.models import CreatorProfileModel
            result = await session.execute(
                select(CreatorProfileModel).where(CreatorProfileModel.user_id == creator.id)
            )
            profile = result.scalar_one_or_none()
            if profile:
                profile.total_videos_uploaded = 12
                profile.total_views_earned = 2_450_000
                profile.total_revenue_cents = 3_200_000  # $32,000
                print(f"  + creator aggregates for deepraj@test.com: 12 videos, 2.45M views, $32K revenue")

        await session.commit()
        print("\n✓ Seed complete")
        break


# ─── Main ───────────────────────────────────────────────────────────────────


async def main():
    print("Tier 1 migration + seed starting…\n")
    await migrate_schema()
    await seed_data()
    print("\n━━━ All done. Verify with: ━━━")
    print("  docker exec relativ-backend-1 python3 -c \"")
    print("    import asyncio")
    print("    from sqlalchemy import text")
    print("    from backend.database.session import get_session")
    print("    async def main():")
    print("        async for s in get_session():")
    print("            for t in ['campaigns','campaign_claims','campaign_clips']:")
    print("                r = await s.execute(text(f'SELECT COUNT(*) FROM {t}'))")
    print("                print(f'  {t}: {r.scalar()}'))")
    print("            break")
    print("    asyncio.run(main())\"")


if __name__ == "__main__":
    asyncio.run(main())
