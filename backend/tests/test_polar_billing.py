import base64
import hashlib
import hmac
import time
from types import SimpleNamespace

from backend.routers import billing_router


def test_polar_plan_comes_from_product_metadata():
    assert billing_router._polar_plan_key({
        "product": {"metadata": {"plan_key": "creator_pro"}},
    }) == "creator_pro"


def test_polar_metadata_accepts_checkout_user_id():
    assert billing_router._polar_metadata({
        "checkout": {"metadata": {"user_id": "user-123"}},
    })["user_id"] == "user-123"


def test_standard_webhook_signature_is_verified(monkeypatch):
    raw_secret = b"polar-test-secret"
    monkeypatch.setattr(
        billing_router,
        "POLAR_WEBHOOK_SECRET",
        "whsec_" + base64.b64encode(raw_secret).decode(),
    )
    payload = b'{"type":"order.created","data":{}}'
    webhook_id = "evt_123"
    timestamp = str(int(time.time()))
    message = f"{webhook_id}.{timestamp}.".encode() + payload
    signature = base64.b64encode(hmac.new(raw_secret, message, hashlib.sha256).digest()).decode()
    request = SimpleNamespace(headers={
        "webhook-id": webhook_id,
        "webhook-timestamp": timestamp,
        "webhook-signature": f"v1,{signature}",
    })
    billing_router._verify_polar_signature(payload, request)
