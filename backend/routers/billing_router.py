"""
Stripe billing endpoints — checkout, portal, webhook, subscription status.

The router works in "stub" mode when STRIPE_SECRET_KEY is not set:
  - /api/v1/billing/checkout  → 503 with a helpful message
  - /api/v1/billing/portal    → 503
  - /api/v1/billing/subscription → returns local DB state
  - /api/v1/billing/webhook   → noop (rejected)

Set STRIPE_SECRET_KEY in /app/RelatiV/.env (or Hetzner env) to enable.

Pricing
-------
  clipper_pro     → $29/mo   (current default in `clipper_profiles.subscription_tier='pro'`)
  clipper_elite   → $99/mo   (upgrade tier)
  brand_credits   → usage-based (Phase 2)

Webhook events handled
----------------------
  checkout.session.completed           → attach subscription_id + customer_id
  customer.subscription.updated         → update status + renews_at
  customer.subscription.deleted         → mark cancelled
  invoice.payment_failed               → mark past_due
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth_utils import get_session_cookie  # noqa: F401  (re-exported via auth_router)
from ..database.models import (
    BrandProfileModel,
    ClipperProfileModel,
    UserModel,
)
from ..database.session import get_session
from .auth_router import get_current_user

log = logging.getLogger("relativ.billing")
router = APIRouter(prefix="/api/v1/billing", tags=["billing"])

# ─── Config ────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://relativclips.com")

# Plan catalog — single source of truth for pricing. Each plan maps to a
# Stripe Price ID (env-supplied) and a tier label stored in the profile.
PLANS = {
    "clipper_pro": {
        "label": "Clipper Pro",
        "amount_cents": 2900,
        "tier": "pro",
        "description": "Pro subscription — 70/30 revenue share, all platforms",
        "stripe_price_id_env": "STRIPE_PRICE_ID_CLIPPER_PRO",
    },
    "clipper_elite": {
        "label": "Clipper Elite",
        "amount_cents": 9900,
        "tier": "elite",
        "description": "Elite subscription — 80/20 revenue share, priority campaigns, custom bio",
        "stripe_price_id_env": "STRIPE_PRICE_ID_CLIPPER_ELITE",
    },
}


# ─── Stripe SDK lazy import ────────────────────────────────────────────────


def _get_stripe():
    """Lazy import stripe so the router loads even if SDK isn't installed."""
    if not STRIPE_SECRET_KEY:
        return None
    try:
        import stripe
        stripe.api_key = STRIPE_SECRET_KEY
        return stripe
    except ImportError:
        log.error("STRIPE_SECRET_KEY set but stripe SDK not installed. pip install stripe")
        return None


def _is_stripe_ready() -> bool:
    return _get_stripe() is not None


# ─── Pydantic shapes ──────────────────────────────────────────────────────


class CheckoutRequest(BaseModel):
    plan: str  # "clipper_pro" | "clipper_elite"


class CheckoutResponse(BaseModel):
    checkout_url: str
    plan: str
    amount_cents: int
    publishable_key: str  # so frontend can confirm


class SubscriptionResponse(BaseModel):
    tier: str
    status: str  # "active" | "paused" | "cancelled" | "past_due" | "none"
    renews_at: Optional[str] = None
    cancel_at_period_end: bool = False
    stripe_customer_id: Optional[str] = None
    has_payment_method: bool = False


class MessageResponse(BaseModel):
    message: str


# ─── Helpers ──────────────────────────────────────────────────────────────


async def _get_or_create_stripe_customer(stripe, user: UserModel, session: AsyncSession) -> str:
    """Find the user's existing Stripe customer ID, or create a new one."""
    # Look up the customer ID from the role-specific profile
    if user.role == "clipper":
        result = await session.execute(
            select(ClipperProfileModel).where(ClipperProfileModel.user_id == user.id)
        )
        profile = result.scalar_one_or_none()
    elif user.role == "brand":
        result = await session.execute(
            select(BrandProfileModel).where(BrandProfileModel.user_id == user.id)
        )
        profile = result.scalar_one_or_none()
    else:
        profile = None

    if profile and profile.stripe_customer_id:
        return profile.stripe_customer_id

    # Create a new Stripe customer
    customer = stripe.Customer.create(
        email=user.email,
        name=user.name or user.email,
        metadata={"relativ_user_id": user.id, "relativ_role": user.role},
    )

    # Save to the profile
    if profile:
        profile.stripe_customer_id = customer.id
        await session.commit()
    return customer.id


# ─── Endpoints ────────────────────────────────────────────────────────────


@router.get("/config")
async def billing_config():
    """Public config — what plans exist, what's enabled, and the publishable key.

    Used by the frontend to render /plans correctly even when Stripe isn't
    fully configured (e.g. on the Vercel preview without env vars).
    """
    return {
        "stripe_enabled": _is_stripe_ready(),
        "publishable_key": STRIPE_PUBLISHABLE_KEY,
        "plans": [
            {
                "key": k,
                "label": v["label"],
                "amount_cents": v["amount_cents"],
                "tier": v["tier"],
                "description": v["description"],
                "available": bool(os.getenv(v["stripe_price_id_env"])) if _is_stripe_ready() else False,
            }
            for k, v in PLANS.items()
        ],
    }


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    body: CheckoutRequest,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a Stripe Checkout session for the given plan and return its URL."""
    if body.plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {body.plan}")

    plan = PLANS[body.plan]
    stripe = _get_stripe()
    if not stripe:
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured on this deployment. Set STRIPE_SECRET_KEY in /app/RelatiV/.env to enable billing.",
        )

    price_id = os.getenv(plan["stripe_price_id_env"])
    if not price_id:
        raise HTTPException(
            status_code=503,
            detail=f"Stripe is enabled but {plan['stripe_price_id_env']} is not set. Add the Stripe Price ID for the {plan['label']} plan to /app/RelatiV/.env.",
        )

    # Only clippers can subscribe for now. Brands use prepay/net15 (Phase 2).
    if user.role not in ("clipper", "creator"):
        raise HTTPException(
            status_code=400,
            detail="Subscriptions are currently available for clipper and creator accounts. Brands use prepay/net15 invoicing (coming soon).",
        )

    customer_id = await _get_or_create_stripe_customer(stripe, user, session)

    try:
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{FRONTEND_URL}/account?billing=success&plan={body.plan}",
            cancel_url=f"{FRONTEND_URL}/plans?billing=cancelled",
            metadata={
                "relativ_user_id": user.id,
                "relativ_plan": body.plan,
                "relativ_tier": plan["tier"],
            },
            allow_promotion_codes=True,
        )
    except Exception as e:
        log.error(f"stripe.checkout.create failed: {e}")
        raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)[:200]}")

    return CheckoutResponse(
        checkout_url=checkout_session.url,
        plan=body.plan,
        amount_cents=plan["amount_cents"],
        publishable_key=STRIPE_PUBLISHABLE_KEY,
    )


@router.post("/portal")
async def create_portal(
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a Stripe Customer Portal session (manage subscription, payment method, invoices)."""
    stripe = _get_stripe()
    if not stripe:
        raise HTTPException(status_code=503, detail="Stripe is not configured on this deployment.")

    customer_id = await _get_or_create_stripe_customer(stripe, user, session)

    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{FRONTEND_URL}/account?billing=returned",
        )
    except Exception as e:
        log.error(f"stripe.portal.create failed: {e}")
        raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)[:200]}")

    return {"portal_url": portal_session.url}


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return the user's current subscription state (from local DB)."""
    if user.role == "clipper":
        result = await session.execute(
            select(ClipperProfileModel).where(ClipperProfileModel.user_id == user.id)
        )
        profile = result.scalar_one_or_none()
    else:
        profile = None

    if not profile:
        return SubscriptionResponse(
            tier="none",
            status="none",
            renews_at=None,
            cancel_at_period_end=False,
            stripe_customer_id=None,
            has_payment_method=False,
        )

    has_pm = bool(profile.stripe_customer_id and profile.stripe_subscription_id)
    return SubscriptionResponse(
        tier=profile.subscription_tier or "none",
        status=profile.subscription_status or "none",
        renews_at=profile.subscription_renews_at.isoformat() if profile.subscription_renews_at else None,
        cancel_at_period_end=False,  # not yet tracked separately
        stripe_customer_id=profile.stripe_customer_id,
        has_payment_method=has_pm,
    )


@router.post("/webhook")
async def stripe_webhook(request: Request, session: AsyncSession = Depends(get_session)):
    """Handle Stripe webhook events. Signature-verified if STRIPE_WEBHOOK_SECRET is set."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    stripe = _get_stripe()
    if not stripe:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    # Verify signature if we have a secret
    if STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig, STRIPE_WEBHOOK_SECRET
            )
        except Exception as e:
            log.warning(f"stripe.webhook.signature_invalid: {e}")
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        # No secret = dev mode, trust the payload
        import json
        try:
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid event: {e}")

    # Dispatch
    etype = event["type"]
    data = event["data"]["object"]
    log.info(f"stripe.webhook type={etype}")

    if etype == "checkout.session.completed":
        await _handle_checkout_completed(data, session)
    elif etype == "customer.subscription.updated":
        await _handle_subscription_updated(data, session)
    elif etype == "customer.subscription.deleted":
        await _handle_subscription_deleted(data, session)
    elif etype == "invoice.payment_failed":
        await _handle_payment_failed(data, session)
    else:
        log.debug(f"stripe.webhook.ignored type={etype}")

    return {"received": True}


# ─── Webhook handlers ─────────────────────────────────────────────────────


async def _handle_checkout_completed(session_data: dict, session: AsyncSession):
    user_id = session_data.get("metadata", {}).get("relativ_user_id")
    tier = session_data.get("metadata", {}).get("relativ_tier", "pro")
    subscription_id = session_data.get("subscription")
    customer_id = session_data.get("customer")
    if not user_id:
        log.warning("stripe.webhook.checkout_completed.no_user_metadata")
        return

    user = (await session.execute(
        select(UserModel).where(UserModel.id == user_id)
    )).scalar_one_or_none()
    if not user:
        return

    if user.role == "clipper":
        result = await session.execute(
            select(ClipperProfileModel).where(ClipperProfileModel.user_id == user.id)
        )
        profile = result.scalar_one_or_none()
        if profile:
            profile.subscription_tier = tier
            profile.subscription_status = "active"
            profile.stripe_customer_id = customer_id
            profile.stripe_subscription_id = subscription_id
            # Fetch the subscription to get the renews_at
            stripe = _get_stripe()
            if stripe and subscription_id:
                try:
                    sub = stripe.Subscription.retrieve(subscription_id)
                    from datetime import timezone
                    profile.subscription_renews_at = datetime.fromtimestamp(
                        sub.current_period_end, tz=timezone.utc
                    ).replace(tzinfo=None)
                except Exception as e:
                    log.warning(f"stripe.subscription.retrieve failed: {e}")
            await session.commit()
            log.info(f"billing.activated user_id={user.id} tier={tier}")


async def _handle_subscription_updated(sub_data: dict, session: AsyncSession):
    sub_id = sub_data.get("id")
    status = sub_data.get("status")  # active, past_due, canceled, etc.
    result = await session.execute(
        select(ClipperProfileModel).where(ClipperProfileModel.stripe_subscription_id == sub_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return
    profile.subscription_status = status
    if sub_data.get("current_period_end"):
        from datetime import timezone
        profile.subscription_renews_at = datetime.fromtimestamp(
            sub_data["current_period_end"], tz=timezone.utc
        ).replace(tzinfo=None)
    await session.commit()
    log.info(f"billing.subscription_updated sub_id={sub_id} status={status}")


async def _handle_subscription_deleted(sub_data: dict, session: AsyncSession):
    sub_id = sub_data.get("id")
    result = await session.execute(
        select(ClipperProfileModel).where(ClipperProfileModel.stripe_subscription_id == sub_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return
    profile.subscription_status = "cancelled"
    profile.subscription_renews_at = None
    await session.commit()
    log.info(f"billing.subscription_cancelled sub_id={sub_id}")


async def _handle_payment_failed(invoice_data: dict, session: AsyncSession):
    customer_id = invoice_data.get("customer")
    if not customer_id:
        return
    result = await session.execute(
        select(ClipperProfileModel).where(ClipperProfileModel.stripe_customer_id == customer_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return
    profile.subscription_status = "past_due"
    await session.commit()
    log.info(f"billing.payment_failed customer_id={customer_id}")
