#!/usr/bin/env python3
"""
View-verification cron job — runs every 5 min via Hermes cron scheduler.

Invoked inside the backend container as:
  python3 -m backend.jobs.verify_views [--auto-pay] [--dry-run]

PYTHONPATH=/app is set in the Dockerfile, so `backend` is importable.

Stdout = JSON: {updated, verified, paid, total_views_added, ran_at, ms}
Exit 0 = success. Non-zero = broken watchdog alert.

Per tick:
  - Find every clip in 'approved' or 'live' status
  - Add a small slice of mock-organic views per platform (TikTok grows
    fastest, Twitter slowest)
  - Recompute earnings based on the campaign's CPM
  - Flip 'approved' → 'verified' once views >= 5,000
  - Flip 'verified' → 'paid' once verified for >= 7 days (or
    immediately with --auto-pay, which is the MVP default for testing)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import random
import sys
import time
from datetime import datetime, timedelta

from sqlalchemy import select

from backend.database.session import async_session
from backend.database.models import (
    CampaignClipModel,
    CampaignClipStatus,
    CampaignModel,
)

log = logging.getLogger("relativ.jobs.verify_views")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")


# Mock platform growth rates (views per cron run, per clip)
# Cron runs every 5 min = 288x/day, so these are tiny slices of the daily rate.
PLATFORM_RUN_GROWTH = {
    "tiktok": (60, 600),         # ~5K-30K/day organic
    "instagram": (40, 320),      # ~3K-15K/day
    "youtube_shorts": (50, 450), # ~4K-22K/day
    "twitter": (15, 130),        # ~1K-6K/day
    "x": (15, 130),
}
PLATFORM_VIEWS_CAP = {
    "tiktok": 5_000_000,
    "instagram": 1_500_000,
    "youtube_shorts": 3_000_000,
    "twitter": 800_000,
    "x": 800_000,
}
VERIFIED_VIEWS_THRESHOLD = 5_000  # below this, "approved" stays approved


async def run_verification_pass(
    session,
    *,
    auto_pay: bool = False,
) -> dict:
    """One pass: grow views, mark verified, optionally mark paid."""
    now = datetime.utcnow()
    updated = 0
    verified = 0
    paid = 0
    total_delta = 0

    # 1) Grow views for all 'approved' or 'live' clips
    stmt = (
        select(CampaignClipModel, CampaignModel)
        .join(CampaignModel, CampaignClipModel.campaign_id == CampaignModel.id)
        .where(CampaignClipModel.status.in_([
            CampaignClipStatus.APPROVED.value,
            CampaignClipStatus.LIVE.value,
        ]))
    )
    rows = (await session.execute(stmt)).all()
    for clip, campaign in rows:
        if not clip.platform:
            continue
        rate = PLATFORM_RUN_GROWTH.get(clip.platform, (10, 100))
        cap = PLATFORM_VIEWS_CAP.get(clip.platform, 1_000_000)
        delta = random.randint(rate[0], rate[1])
        new_views = min(cap, clip.views + delta)
        if new_views > clip.views:
            clip.views = new_views
            clip.earnings_cents = int((new_views * campaign.cpm_cents) / 1000)
            total_delta += delta
            updated += 1
        # Promote to 'verified' if we hit the threshold
        if (
            clip.status == CampaignClipStatus.APPROVED.value
            and clip.views >= VERIFIED_VIEWS_THRESHOLD
        ):
            clip.status = CampaignClipStatus.VERIFIED.value
            clip.verified_at = now
            verified += 1
    await session.commit()

    # 2) Pay out verified clips (7-day cycle, or immediate with --auto-pay)
    if auto_pay:
        stmt2 = select(CampaignClipModel).where(
            CampaignClipModel.status == CampaignClipStatus.VERIFIED.value,
        )
        clips_to_pay = (await session.execute(stmt2)).scalars().all()
    else:
        cutoff = now - timedelta(days=7)
        stmt2 = select(CampaignClipModel).where(
            CampaignClipModel.status == CampaignClipStatus.VERIFIED.value,
            CampaignClipModel.verified_at <= cutoff,
        )
        clips_to_pay = (await session.execute(stmt2)).scalars().all()
    for c in clips_to_pay:
        c.status = CampaignClipStatus.PAID.value
    if clips_to_pay:
        await session.commit()
    paid = len(clips_to_pay)

    return {
        "updated": updated,
        "verified": verified,
        "paid": paid,
        "total_views_added": total_delta,
    }


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--auto-pay", action="store_true",
                        help="Flip verified clips to paid immediately (MVP).")
    parser.add_argument("--dry-run", action="store_true",
                        help="Count clips that would be processed, no writes.")
    args = parser.parse_args()

    t0 = time.time()
    ran_at = datetime.utcnow()

    if args.dry_run:
        async with async_session() as session:
            from sqlalchemy import func
            eligible = (await session.execute(
                select(func.count(CampaignClipModel.id)).where(
                    CampaignClipModel.status.in_([
                        CampaignClipStatus.APPROVED.value,
                        CampaignClipStatus.LIVE.value,
                    ])
                )
            )).scalar_one()
            would_pay = (await session.execute(
                select(func.count(CampaignClipModel.id)).where(
                    CampaignClipModel.status == CampaignClipStatus.VERIFIED.value,
                )
            )).scalar_one()
            out = {
                "ok": True,
                "dry_run": True,
                "eligible_clips": eligible,
                "would_pay": would_pay,
                "ran_at": ran_at.isoformat(),
            }
            print(json.dumps(out))
            return 0

    async with async_session() as session:
        stats = await run_verification_pass(session, auto_pay=args.auto_pay)

    ms = int((time.time() - t0) * 1000)
    out = {
        **stats,
        "ran_at": ran_at.isoformat(),
        "ms": ms,
        "ok": True,
    }
    log.info("verify_views %s", json.dumps(out))
    print(json.dumps(out, default=str))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except Exception as e:
        log.exception("verify_views crashed")
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)
