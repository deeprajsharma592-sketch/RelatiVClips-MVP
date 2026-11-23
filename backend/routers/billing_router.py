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
import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth_utils import get_session_cookie  # noqa: F401  (re-exported via auth_router)
from ..database.models import (
    BrandProfileModel,
    ClipperProfileModel,
    CreditTransactionModel,
    UserModel,
)
from ..database.session import get_session
from ..services.entitlements import PLAN_CATALOG, normalize_plan_key
from .auth_router import get_current_user

log = logging.getLogger("relativ.billing")
router = APIRouter(prefix="/api/v1/billing", tags=["billing"])

# ─── Config ────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://relativclips.com")
POLAR_WEBHOOK_SECRET = os.getenv("POLAR_WEBHOOK_SECRET", "")

POLAR_PRODUCT_PLANS = {
    value: plan
    for plan, value in {
        "creator_go": os.getenv("POLAR_GO_PRODUCT_ID", ""),
        "creator_pro": os.getenv("POLAR_PRO_PRODUCT_ID", ""),
        "creator_max": os.getenv("POLAR_MAX_PRODUCT_ID", ""),
    }.items()
    if value
}

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


def _verify_polar_signature(payload: bytes, request: Request) -> None:
    """Verify Polar's Standard Webhooks signature without exposing the secret."""
    if not POLAR_WEBHOOK_SECRET:
        environment = os.getenv("ENVIRONMENT", os.getenv("APP_ENV", "development")).lower()
        if environment in {"production", "prod"}:
            raise HTTPException(status_code=503, detail="Polar webhook secret is not configured")
        log.warning("polar.webhook.secret_missing — accepting unsigned payload in development mode")
        return

    message_id = request.headers.get("webhook-id", "")
    timestamp = request.headers.get("webhook-timestamp", "")
    signatures = request.headers.get("webhook-signature", "")
    if not message_id or not timestamp or not signatures:
        raise HTTPException(status_code=400, detail="Missing Polar webhook signature headers")
    try:
        timestamp_int = int(timestamp)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Polar webhook timestamp") from None
    if abs(int(time.time()) - timestamp_int) > 300:
        raise HTTPException(status_code=400, detail="Expired Polar webhook timestamp")

    secret_value = POLAR_WEBHOOK_SECRET
    if secret_value.startswith("whsec_"):
        secret_value = secret_value[6:]
    try:
        padding = "=" * (-len(secret_value) % 4)
        secret = base64.b64decode(secret_value + padding, altchars=b"-_", validate=True)
    except Exception:
        # Some Polar environments issue an opaque endpoint secret rather than
        # the conventional whsec_ base64 form.
        secret = secret_value.encode("utf-8")

    signed = message_id.encode() + b"." + timestamp.encode() + b"." + payload
    expected = base64.b64encode(hmac.new(secret, signed, hashlib.sha256).digest()).decode()
    candidates = [part.split(",", 1)[1] for part in signatures.split() if part.startswith("v1,")]
    if not candidates or not any(hmac.compare_digest(expected, candidate) for candidate in candidates):
        raise HTTPException(status_code=400, detail="Invalid Polar webhook signature")


def _parse_polar_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo:
            parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed
    except (TypeError, ValueError):
        return None


def _polar_plan_key(data: dict) -> Optional[str]:
    product = data.get("product") if isinstance(data.get("product"), dict) else {}
    product_meta = product.get("metadata") if isinstance(product.get("metadata"), dict) else {}
    data_meta = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    plan = normalize_plan_key(product_meta.get("plan_key") or data_meta.get("plan_key"))
    if plan:
        return plan
    product_id = data.get("product_id") or product.get("id")
    return POLAR_PRODUCT_PLANS.get(str(product_id)) if product_id else None


def _polar_metadata(data: dict) -> dict:
    merged: dict = {}
    for holder_name in ("checkout", "subscription", "order"):
        holder = data.get(holder_name)
        if isinstance(holder, dict) and isinstance(holder.get("metadata"), dict):
            merged.update(holder["metadata"])
    if isinstance(data.get("metadata"), dict):
        merged.update(data["metadata"])
    return merged


def _polar_email(data: dict) -> Optional[str]:
    for holder_name in ("customer", "user"):
        holder = data.get(holder_name)
        if isinstance(holder, dict) and holder.get("email"):
            return str(holder["email"]).strip().lower()
    value = data.get("customer_email")
    return str(value).strip().lower() if value else None


def _polar_grant_reference(event_type: str, data: dict) -> str:
    # Initial subscription + order events normally share checkout_id. Using it
    # prevents two grants for the same first payment. Renewals have an order ID.
    checkout_id = data.get("checkout_id")
    if checkout_id:
        return f"polar:checkout:{checkout_id}:credits"
    subscription_id = data.get("subscription_id")
    if not subscription_id and isinstance(data.get("subscription"), dict):
        subscription_id = data["subscription"].get("id")
    subscription_id = subscription_id or (
        data.get("id") if event_type.startswith("subscription.") else None
    )
    period_start = data.get("current_period_start") or data.get("started_at")
    if subscription_id and period_start:
        return f"polar:subscription:{subscription_id}:period:{period_start}:credits"
    if event_type == "subscription.created":
        return f"polar:subscription:{subscription_id}:initial-credits"
    return f"polar:order:{data.get('id')}:credits"


async def _polar_user(data: dict, session: AsyncSession) -> Optional[UserModel]:
    metadata = _polar_metadata(data)
    user_id = metadata.get("user_id")
    if user_id:
        user = (await session.execute(select(UserModel).where(UserModel.id == str(user_id)))).scalar_one_or_none()
        if user:
            return user
    email = _polar_email(data)
    if not email:
        return None
    return (await session.execute(
        select(UserModel).where(UserModel.email.ilike(email))
    )).scalar_one_or_none()


async def _grant_polar_plan(
    user: UserModel,
    plan_key: str,
    event_type: str,
    data: dict,
    session: AsyncSession,
) -> None:
    reference = _polar_grant_reference(event_type, data)
    prior = (await session.execute(
        select(CreditTransactionModel).where(CreditTransactionModel.reference_id == reference)
    )).scalar_one_or_none()
    if prior:
        return
    credits = int(PLAN_CATALOG[plan_key]["credits"])
    user.credit_balance += credits
    session.add(CreditTransactionModel(
        user_id=user.id,
        amount=credits,
        balance_after=user.credit_balance,
        kind="polar_subscription_credit_grant",
        reference_id=reference,
        details={
            "event_type": event_type,
            "plan": plan_key,
            "polar_order_id": data.get("id") if event_type == "order.created" else None,
            "polar_subscription_id": data.get("subscription_id") or (
                data.get("id") if event_type == "subscription.created" else None
            ),
        },
    ))


def _apply_polar_identity(user: UserModel, data: dict, event_type: str = "") -> None:
    customer = data.get("customer") if isinstance(data.get("customer"), dict) else {}
    subscription = data.get("subscription") if isinstance(data.get("subscription"), dict) else {}
    user.polar_customer_id = str(data.get("customer_id") or customer.get("id") or user.polar_customer_id or "") or None
    subscription_id = data.get("subscription_id") or subscription.get("id")
    if not subscription_id and event_type.startswith("subscription."):
        subscription_id = data.get("id")
    if subscription_id:
        user.polar_subscription_id = str(subscription_id)


@router.post("/polar-webhook")
async def polar_webhook(request: Request, session: AsyncSession = Depends(get_session)):
    payload = await request.body()
    _verify_polar_signature(payload, request)
    try:
        event = json.loads(payload)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid Polar webhook JSON") from None

    event_type = str(event.get("type") or "")
    data = event.get("data") if isinstance(event.get("data"), dict) else {}
    log.info("polar.webhook type=%s id=%s", event_type, request.headers.get("webhook-id", "dev"))
    if event_type not in {
        "subscription.created", "subscription.updated", "subscription.active",
        "subscription.canceled", "subscription.revoked", "order.created",
    }:
        return {"status": "ok"}

    user = await _polar_user(data, session)
    if not user:
        log.warning("polar.webhook.user_not_found type=%s email=%s", event_type, _polar_email(data))
        return {"status": "ok"}

    _apply_polar_identity(user, data, event_type)
    plan_key = _polar_plan_key(data)
    status = str(data.get("status") or "active").lower()
    period_end = _parse_polar_datetime(data.get("current_period_end") or data.get("ends_at"))
    if period_end:
        user.polar_current_period_end = period_end

    if event_type in {"subscription.created", "order.created"}:
        if plan_key:
            user.plan_tier = plan_key
            user.polar_subscription_status = status
            user.polar_cancel_at_period_end = bool(data.get("cancel_at_period_end", False))
            await _grant_polar_plan(user, plan_key, event_type, data, session)
        else:
            log.warning("polar.webhook.plan_unresolved type=%s product_id=%s", event_type, data.get("product_id"))
    elif event_type in {"subscription.updated", "subscription.active"}:
        if plan_key:
            user.plan_tier = plan_key
        user.polar_subscription_status = status
        user.polar_cancel_at_period_end = bool(data.get("cancel_at_period_end", False))
    elif event_type == "subscription.revoked":
        user.plan_tier = "free"
        user.polar_subscription_status = "revoked"
        user.polar_cancel_at_period_end = False
    elif event_type == "subscription.canceled":
        user.polar_subscription_status = "canceled"
        user.polar_cancel_at_period_end = True
        if period_end is None or period_end <= datetime.utcnow():
            user.plan_tier = "free"

    await session.commit()
    return {"status": "ok"}


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
