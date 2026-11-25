import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.database.models import AuditLogModel
from backend.services.email_service import OutgoingEmail, send_via_smtp
from backend.utils.audit import record_audit_event


@pytest.mark.asyncio
async def test_record_audit_event_persists_row():
    session = MagicMock()
    session.add = MagicMock()
    session.commit = AsyncMock()

    await record_audit_event(
        session,
        action="admin.smtp_test",
        actor_user_id="u_1",
        actor_email="deepraj@relativclips.com",
        resource_type="email",
        resource_id="deepraj@relativclips.com",
        status="success",
        ip_address="127.0.0.1",
        details={"detail": "Sent via smtp.example.com:587"},
    )

    session.add.assert_called_once()
    row = session.add.call_args.args[0]
    assert isinstance(row, AuditLogModel)
    assert row.action == "admin.smtp_test"
    assert row.actor_email == "deepraj@relativclips.com"
    assert row.resource_id == "deepraj@relativclips.com"
    assert "smtp.example.com" in (row.details or "")
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_send_via_smtp_requires_host():
    with patch.dict(os.environ, {"SMTP_HOST": ""}, clear=False):
        ok, detail = await send_via_smtp(
            OutgoingEmail(to="deepraj@relativclips.com", subject="Test", html="<p>Hi</p>")
        )
        assert ok is False
        assert "SMTP_HOST" in detail


@pytest.mark.asyncio
async def test_send_via_smtp_sends_with_starttls():
    mock_smtp = MagicMock()
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = mock_smtp
    mock_ctx.__exit__.return_value = False

    with patch.dict(
        os.environ,
        {
            "SMTP_HOST": "smtp.example.com",
            "SMTP_PORT": "587",
            "SMTP_USER": "mailer@relativclips.com",
            "SMTP_PASSWORD": "secret",
        },
        clear=False,
    ), patch("smtplib.SMTP", return_value=mock_ctx) as smtp_cls:
        ok, detail = await send_via_smtp(
            OutgoingEmail(to="deepraj@relativclips.com", subject="Test", html="<p>Hi</p>")
        )
        assert ok is True
        assert "smtp.example.com:587" in detail
        smtp_cls.assert_called_once_with("smtp.example.com", 587, timeout=15)
        mock_smtp.starttls.assert_called_once()
        mock_smtp.login.assert_called_once_with("mailer@relativclips.com", "secret")
        mock_smtp.send_message.assert_called_once()
