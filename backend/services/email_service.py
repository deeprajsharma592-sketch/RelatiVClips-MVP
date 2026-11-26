"""
Email service — abstract send() so we can swap backends.

Backend priority:
  1. RESEND_API_KEY env var set → use Resend (https://resend.com)
  2. POSTMARK_TOKEN env var set → use Postmark
  3. SMTP_* env vars set → use aiosmtplib
  4. None of the above → console-print fallback (dev mode)

The fallback logs the rendered email to stdout with a clear separator.
This is intentional for dev: it means /forgot-password and /verify-email
work end-to-end with no external setup. The user can read the link from
the server logs.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from email.message import EmailMessage as PyEmailMessage  # stdlib type, for SMTP

log = logging.getLogger("relativ.email")


@dataclass
class OutgoingEmail:
    to: str
    subject: str
    html: str
    text: str | None = None
    from_addr: str = "RelatiV <noreply@relativclips.com>"


def _effective_from(msg: OutgoingEmail) -> str:
    env_from = (os.getenv("EMAIL_FROM") or os.getenv("RESEND_FROM") or os.getenv("SMTP_FROM") or "").strip()
    return env_from or msg.from_addr


async def send(msg: OutgoingEmail) -> bool:
    """Send an email using the first available backend. Returns True if sent."""
    text_body = msg.text or _strip_html(msg.html)

    # Backend 1: Resend
    resend_key = os.getenv("RESEND_API_KEY")
    if resend_key:
        return await _send_resend(msg, resend_key)

    # Backend 2: Postmark
    postmark = os.getenv("POSTMARK_TOKEN")
    if postmark:
        return await _send_postmark(msg, postmark)

    # Backend 3: SMTP
    smtp_host = os.getenv("SMTP_HOST")
    if smtp_host:
        return await _send_smtp(msg, text_body)

    # Backend 4: dev fallback — log to stdout
    _send_console(msg, text_body)
    return True


async def send_with_status(msg: OutgoingEmail) -> tuple[bool, str, str]:
    """Send an email and return (ok, backend_name, detail), falling through configured providers."""
    text_body = msg.text or _strip_html(msg.html)
    errors: list[str] = []

    resend_key = (os.getenv("RESEND_API_KEY") or "").strip()
    if resend_key:
        ok, detail = await _send_resend_with_detail(msg, resend_key)
        if ok:
            return True, "resend", detail
        errors.append(f"resend: {detail}")

    postmark = (os.getenv("POSTMARK_TOKEN") or "").strip()
    if postmark:
        ok = await _send_postmark(msg, postmark)
        if ok:
            return True, "postmark", "Sent via Postmark"
        errors.append("postmark: delivery failed")

    smtp_host = (os.getenv("SMTP_HOST") or "").strip()
    if smtp_host:
        ok, detail = await send_via_smtp(msg)
        if ok:
            return True, "smtp", detail
        errors.append(f"smtp: {detail}")

    if errors:
        return False, "multi", "; ".join(errors)

    _send_console(msg, text_body)
    return False, "console", "No email provider configured (SMTP_HOST / RESEND_API_KEY / POSTMARK_TOKEN missing)"


async def _send_resend_with_detail(msg: OutgoingEmail, api_key: str) -> tuple[bool, str]:
    """Resend (https://resend.com/docs/api-reference/emails/send-email)."""
    try:
        import httpx
    except ImportError:
        log.error("RESEND_API_KEY set but httpx not installed")
        return False, "httpx not installed"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "from": _effective_from(msg),
                    "to": [msg.to],
                    "subject": msg.subject,
                    "html": msg.html,
                    "text": msg.text or "",
                },
            )
            if r.status_code >= 300:
                err_txt = r.text[:200]
                log.error(f"Resend send failed: {r.status_code} {err_txt}")
                return False, f"HTTP {r.status_code}: {err_txt}"
            return True, "Sent via Resend"
    except Exception as e:
        log.error(f"Resend send error: {e}")
        return False, str(e)


async def _send_resend(msg: OutgoingEmail, api_key: str) -> bool:
    ok, _ = await _send_resend_with_detail(msg, api_key)
    return ok


async def _send_postmark(msg: OutgoingEmail, token: str) -> bool:
    """Postmark (https://postmarkapp.com/developer/api/email-api)."""
    try:
        import httpx
    except ImportError:
        log.error("POSTMARK_TOKEN set but httpx not installed")
        return False
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.postmarkapp.com/email",
                headers={
                    "X-Postmark-Server-Token": token,
                    "Accept": "application/json",
                },
                json={
                    "From": msg.from_addr,
                    "To": msg.to,
                    "Subject": msg.subject,
                    "HtmlBody": msg.html,
                    "TextBody": msg.text or "",
                },
            )
            if r.status_code >= 300:
                log.error(f"Postmark send failed: {r.status_code} {r.text[:200]}")
                return False
            return True
    except Exception as e:
        log.error(f"Postmark send error: {e}")
        return False


async def send_via_smtp(msg: OutgoingEmail) -> tuple[bool, str]:
    """Send an email explicitly via SMTP (no Resend/Postmark/console fallback)."""
    host = (os.getenv("SMTP_HOST") or "").strip()
    if not host:
        return False, "SMTP_HOST is not configured"

    import asyncio
    import smtplib

    port = int(os.getenv("SMTP_PORT", "587"))
    user = (os.getenv("SMTP_USER") or "").strip() or None
    pw = os.getenv("SMTP_PASSWORD")
    from_addr = (
        (os.getenv("EMAIL_FROM") or os.getenv("SMTP_FROM") or "").strip()
        or (f"RelatiV <{user}>" if user and "@" in user else msg.from_addr)
    )
    text_body = msg.text or _strip_html(msg.html)

    def _send_sync() -> None:
        m = PyEmailMessage()
        m["From"] = from_addr
        m["To"] = msg.to
        m["Subject"] = msg.subject
        m.set_content(text_body)
        m.add_alternative(msg.html, subtype="html")
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=15) as s:
                if user and pw:
                    s.login(user, pw)
                s.send_message(m)
        else:
            with smtplib.SMTP(host, port, timeout=15) as s:
                s.starttls()
                if user and pw:
                    s.login(user, pw)
                s.send_message(m)

    try:
        await asyncio.to_thread(_send_sync)
        return True, f"Sent via {host}:{port}"
    except Exception as e:
        log.error(f"SMTP send error: {e}")
        return False, str(e)


async def _send_smtp(msg: OutgoingEmail, text_body: str) -> bool:
    """Generic SMTP via aiosmtplib (or stdlib smtplib as fallback)."""
    import asyncio
    import smtplib
    host = os.getenv("SMTP_HOST", "localhost")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    pw = os.getenv("SMTP_PASSWORD")

    def _send_sync():
        m = PyEmailMessage()
        m["From"] = msg.from_addr
        m["To"] = msg.to
        m["Subject"] = msg.subject
        m.set_content(text_body)
        m.add_alternative(msg.html, subtype="html")
        with smtplib.SMTP(host, port, timeout=15) as s:
            s.starttls()
            if user and pw:
                s.login(user, pw)
            s.send_message(m)

    try:
        await asyncio.to_thread(_send_sync)
        return True
    except Exception as e:
        log.error(f"SMTP send error: {e}")
        return False


def _send_console(msg: OutgoingEmail, text_body: str) -> None:
    """Dev fallback — log the email in a clearly-marked block."""
    sep = "═" * 78
    log.info("")
    log.info(sep)
    log.info(f"EMAIL (console backend) -> {msg.to}")
    log.info(f"Subject: {msg.subject}")
    log.info("-" * 78)
    log.info(text_body)
    log.info(sep)
    log.info("")


def _strip_html(html: str) -> str:
    """Minimal HTML to text for the text/plain alternative."""
    import re
    text = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.S | re.I)
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s{3,}", "\n\n", text)
    return text.strip()
