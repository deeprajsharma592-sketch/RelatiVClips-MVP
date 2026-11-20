"""Authenticated one-time checkout. Does not grant subscription entitlements."""
import hashlib
import hmac
import os
import re
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from .auth_router import get_current_user

router = APIRouter(prefix="/api", tags=["razorpay"])

PLANS = {
    "creator_go": {"amount": 49_900, "label": "RelatiV Go"},
    "creator_pro": {"amount": 89_900, "label": "RelatiV Pro"},
    "creator_premium": {"amount": 199_900, "label": "RelatiV Premium"},
}


def credentials():
    key = os.getenv("RAZORPAY_KEY_ID", "")
    secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not key or not secret:
        raise HTTPException(503, "Payment service is not configured")
    return key, secret


async def provider_call(method: str, path: str, payload=None):
    key, secret = credentials()
    try:
        async with httpx.AsyncClient(
            base_url="https://api.razorpay.com/v1",
            auth=(key, secret),
            timeout=15,
        ) as provider:
            response = await provider.request(method, path, json=payload)
    except httpx.RequestError:
        raise HTTPException(500, "Payment provider unavailable. Please try again.") from None
    if response.status_code == 401:
        raise HTTPException(401, "Payment provider authentication failed")
    if not response.is_success:
        raise HTTPException(500, "Payment provider rejected the request")
    try:
        return response.json()
    except ValueError:
        raise HTTPException(500, "Payment provider returned an invalid response") from None


async def body(request):
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON") from None
    if not isinstance(data, dict):
        raise HTTPException(400, "Expected a JSON object")
    return data


@router.post("/create-order")
async def create_order(request: Request, user=Depends(get_current_user)):
    data = await body(request)
    plan_key = data.get("plan")
    plan = PLANS.get(plan_key) if isinstance(plan_key, str) else None
    if plan_key is not None and plan is None:
        raise HTTPException(400, "Unknown payment plan")
    amount = plan["amount"] if plan else data.get("amount")
    if type(amount) is not int or not 100 <= amount <= 10000000:
        raise HTTPException(400, "Amount must be an integer from 100 to 10000000 paise")
    if data.get("currency", "INR") != "INR":
        raise HTTPException(400, "Only INR is supported")
    receipt = data.get("receipt") or f"rv_{uuid.uuid4().hex}"
    if not isinstance(receipt, str) or len(receipt) > 40:
        raise HTTPException(400, "Receipt must be at most 40 characters")
    order = await provider_call("POST", "/orders", {
        "amount": amount, "currency": "INR", "receipt": receipt,
        "notes": {
            "relativ_user_id": str(user.id),
            "purpose": "creator_plan" if plan else "one_time_payment",
            "relativ_plan": plan_key or "custom",
        },
    })
    return {"order_id": order["id"], "amount": order["amount"], "currency": order["currency"],
            "key_id": credentials()[0], "plan": plan_key,
            "description": plan["label"] if plan else "RelatiV payment"}


@router.post("/verify-payment")
async def verify_payment(request: Request, user=Depends(get_current_user)):
    data = await body(request)
    fields = ("razorpay_order_id", "razorpay_payment_id", "razorpay_signature")
    if any(not isinstance(data.get(k), str) or not data[k] for k in fields):
        raise HTTPException(400, "Missing payment verification fields")
    order_id, payment_id, signature = (data[k] for k in fields)
    if not re.fullmatch(r"order_[A-Za-z0-9]+", order_id) or not re.fullmatch(r"pay_[A-Za-z0-9]+", payment_id) or not re.fullmatch(r"[0-9a-f]{64}", signature):
        raise HTTPException(400, "Invalid payment verification fields")
    # The provider's order is durable authoritative storage, bound to this user.
    order = await provider_call("GET", f"/orders/{order_id}")
    if order.get("notes", {}).get("relativ_user_id") != str(user.id):
        raise HTTPException(403, "This order belongs to another account")
    expected = hmac.new(os.environ["RAZORPAY_KEY_SECRET"].encode(),
                        f'{order["id"]}|{payment_id}'.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(400, "Payment signature mismatch")
    payment = await provider_call("GET", f"/payments/{payment_id}")
    if payment.get("order_id") != order["id"] or payment.get("amount") != order["amount"] or payment.get("currency") != order["currency"]:
        raise HTTPException(400, "Payment does not match the order")
    if payment.get("status") != "captured":
        return {"success": False, "status": payment.get("status", "pending"), "message": "Payment verified; awaiting capture. Do not pay again."}
    return {"success": True, "status": "paid", "payment_id": payment_id, "order_id": order["id"]}
