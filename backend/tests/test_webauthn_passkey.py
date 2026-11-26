import hashlib
import json

from backend.utils.webauthn import (
    b64url_encode,
    parse_authenticator_data,
    parse_spki_p256_point,
    verify_client_data,
    verify_p256_der_signature,
    _N,
    _GX,
    _GY,
    _point_mul,
)


def _encode_der_int(val: int) -> bytes:
    raw = val.to_bytes((val.bit_length() + 7) // 8 or 1, "big")
    if raw[0] & 0x80:
        raw = b"\x00" + raw
    return b"\x02" + bytes([len(raw)]) + raw


def _make_p256_keypair_and_sig(priv: int, message: bytes):
    pub = _point_mul(priv, (_GX, _GY))
    assert pub is not None
    x, y = pub
    spki_prefix = bytes.fromhex("3059301306072a8648ce3d020106082a8648ce3d030107034200")
    spki_der = spki_prefix + b"\x04" + x.to_bytes(32, "big") + y.to_bytes(32, "big")

    k = 0x123456789ABCDEF123456789ABCDEF123456789ABCDEF123456789ABCDEF1234
    r_pt = _point_mul(k, (_GX, _GY))
    assert r_pt is not None
    r = r_pt[0] % _N
    z = int.from_bytes(hashlib.sha256(message).digest(), "big")
    s = (pow(k, -1, _N) * (z + r * priv)) % _N
    r_der = _encode_der_int(r)
    s_der = _encode_der_int(s)
    der_sig = b"\x30" + bytes([len(r_der) + len(s_der)]) + r_der + s_der
    return spki_der, der_sig


def test_p256_spki_and_signature_verification():
    priv = 0x519B423D715F8B581F4FA8EE59F4771A5B44C8130B4E3EACCA54A56DDA72B464
    msg = b"webauthn-auth-data-plus-client-hash"
    spki, sig = _make_p256_keypair_and_sig(priv, msg)

    x, y = parse_spki_p256_point(spki)
    assert x > 0 and y > 0
    assert verify_p256_der_signature(spki, msg, sig) is True
    assert verify_p256_der_signature(spki, b"tampered", sig) is False


def test_webauthn_client_and_authenticator_data():
    challenge = "test-challenge-123"
    client_json = json.dumps({
        "type": "webauthn.get",
        "challenge": challenge,
        "origin": "https://relativclips.com",
    }).encode("utf-8")
    raw_client, rp_id = verify_client_data(
        b64url_encode(client_json),
        expected_type="webauthn.get",
        expected_challenge=challenge,
        allowed_rp_ids=["relativclips.com", "localhost"],
    )
    assert rp_id == "relativclips.com"
    assert raw_client == client_json

    auth_data = hashlib.sha256(b"relativclips.com").digest() + bytes([0x05]) + (7).to_bytes(4, "big")
    _, sign_count = parse_authenticator_data(b64url_encode(auth_data), "relativclips.com")
    assert sign_count == 7


def test_verify_supabase_password_handles_401_and_200():
    import asyncio
    from unittest.mock import AsyncMock, MagicMock, patch
    from fastapi import HTTPException
    from backend.services import supabase_auth

    async def _run():
        resp_401 = MagicMock(status_code=400)
        resp_200 = MagicMock(status_code=200)
        resp_200.json.return_value = {"user": {"id": "supa-1", "email": "deeprajsharma@relativclips.com"}}

        client_401 = AsyncMock()
        client_401.__aenter__.return_value.post = AsyncMock(return_value=resp_401)
        with (
            patch.object(supabase_auth, "is_supabase_auth_configured", return_value=True),
            patch("httpx.AsyncClient", return_value=client_401),
        ):
            try:
                await supabase_auth.verify_supabase_password("deeprajsharma@relativclips.com", "wrong")
                assert False, "Expected HTTPException"
            except HTTPException as exc:
                assert exc.status_code == 401

        client_200 = AsyncMock()
        client_200.__aenter__.return_value.post = AsyncMock(return_value=resp_200)
        with (
            patch.object(supabase_auth, "is_supabase_auth_configured", return_value=True),
            patch("httpx.AsyncClient", return_value=client_200),
        ):
            u = await supabase_auth.verify_supabase_password("deeprajsharma@relativclips.com", "correct")
            assert u["id"] == "supa-1"

    asyncio.run(_run())
