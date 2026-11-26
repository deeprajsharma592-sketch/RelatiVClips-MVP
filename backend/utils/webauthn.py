"""Minimal zero-dependency WebAuthn (ES256 / P-256) verification for Admin Passkeys."""
from __future__ import annotations

import base64
import hashlib
import json
from typing import Iterable, Tuple

# NIST P-256 (secp256r1) curve parameters
_P = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF
_A = (_P - 3)
_B = 0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B
_GX = 0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296
_GY = 0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5
_N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def _point_add(p1: Tuple[int, int] | None, p2: Tuple[int, int] | None) -> Tuple[int, int] | None:
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    x1, y1 = p1
    x2, y2 = p2
    if x1 == x2:
        if (y1 + y2) % _P == 0:
            return None
        lam = ((3 * x1 * x1 + _A) * pow(2 * y1, -1, _P)) % _P
    else:
        lam = ((y2 - y1) * pow(x2 - x1, -1, _P)) % _P
    x3 = (lam * lam - x1 - x2) % _P
    y3 = (lam * (x1 - x3) - y1) % _P
    return (x3, y3)


def _point_mul(k: int, point: Tuple[int, int]) -> Tuple[int, int] | None:
    result = None
    addend = point
    while k > 0:
        if k & 1:
            result = _point_add(result, addend)
        addend = _point_add(addend, addend)
        k >>= 1
    return result


def parse_spki_p256_point(spki_der: bytes) -> Tuple[int, int]:
    """Extract uncompressed P-256 (x, y) point from SubjectPublicKeyInfo DER bytes."""
    if len(spki_der) < 65 or spki_der[-65] != 0x04:
        raise ValueError("Unsupported passkey public key format (expected P-256 SPKI)")
    x = int.from_bytes(spki_der[-64:-32], "big")
    y = int.from_bytes(spki_der[-32:], "big")
    if (y * y - (x * x * x + _A * x + _B)) % _P != 0:
        raise ValueError("Invalid P-256 public key point")
    return (x, y)


def _parse_der_sig(der_sig: bytes) -> Tuple[int, int]:
    if len(der_sig) < 8 or der_sig[0] != 0x30:
        raise ValueError("Invalid DER ECDSA signature")
    idx = 2
    if der_sig[1] & 0x80:
        idx += der_sig[1] & 0x7F
    if idx >= len(der_sig) or der_sig[idx] != 0x02:
        raise ValueError("Invalid DER signature r")
    r_len = der_sig[idx + 1]
    r = int.from_bytes(der_sig[idx + 2 : idx + 2 + r_len], "big")
    idx += 2 + r_len
    if idx >= len(der_sig) or der_sig[idx] != 0x02:
        raise ValueError("Invalid DER signature s")
    s_len = der_sig[idx + 1]
    s = int.from_bytes(der_sig[idx + 2 : idx + 2 + s_len], "big")
    return r, s


def verify_p256_der_signature(spki_der: bytes, message: bytes, der_sig: bytes) -> bool:
    """Verify an ES256 (ECDSA P-256 + SHA-256) DER signature against an SPKI public key."""
    try:
        pub = parse_spki_p256_point(spki_der)
        r, s = _parse_der_sig(der_sig)
        if not (1 <= r < _N and 1 <= s < _N):
            return False
        z = int.from_bytes(hashlib.sha256(message).digest(), "big")
        w = pow(s, -1, _N)
        u1 = (z * w) % _N
        u2 = (r * w) % _N
        pt = _point_add(_point_mul(u1, (_GX, _GY)), _point_mul(u2, pub))
        if pt is None:
            return False
        return (pt[0] % _N) == r
    except Exception:
        return False


def verify_client_data(
    client_data_b64: str,
    *,
    expected_type: str,
    expected_challenge: str,
    allowed_rp_ids: Iterable[str],
) -> tuple[bytes, str]:
    """Decode and validate WebAuthn clientDataJSON. Returns (raw_bytes, rp_id_from_origin)."""
    raw = b64url_decode(client_data_b64)
    data = json.loads(raw.decode("utf-8"))
    if data.get("type") != expected_type:
        raise ValueError(f"Unexpected WebAuthn ceremony type: {data.get('type')}")
    if data.get("challenge") != expected_challenge:
        raise ValueError("WebAuthn challenge mismatch")
    origin = str(data.get("origin") or "")
    host = origin.split("://", 1)[-1].split("/", 1)[0].split(":", 1)[0].lower()
    allowed = {rp.lower() for rp in allowed_rp_ids}
    if not host or (host not in allowed and not any(host.endswith(f".{rp}") for rp in allowed)):
        raise ValueError(f"Origin host '{host}' is not allowed for passkey auth")
    matched_rp = next((rp for rp in allowed if host == rp or host.endswith(f".{rp}")), host)
    return raw, matched_rp


def parse_authenticator_data(auth_data_b64: str, expected_rp_id: str) -> tuple[bytes, int]:
    """Validate rpIdHash + User Present flag in authenticatorData. Returns (raw_bytes, sign_count)."""
    raw = b64url_decode(auth_data_b64)
    if len(raw) < 37:
        raise ValueError("Truncated WebAuthn authenticatorData")
    rp_hash = raw[:32]
    if rp_hash != hashlib.sha256(expected_rp_id.encode("utf-8")).digest():
        raise ValueError("WebAuthn rpIdHash mismatch")
    flags = raw[32]
    if not (flags & 0x01):
        raise ValueError("WebAuthn user-presence flag not set")
    sign_count = int.from_bytes(raw[33:37], "big")
    return raw, sign_count
