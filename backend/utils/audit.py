"""Structured audit logging helper backed by PostgreSQL/SQLite."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..database.models import AuditLogModel

log = logging.getLogger("relativ.audit")


async def record_audit_event(
    session: AsyncSession,
    *,
    action: str,
    actor_user_id: Optional[str] = None,
    actor_email: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    status: str = "success",
    ip_address: Optional[str] = None,
    details: Optional[dict[str, Any] | str] = None,
    commit: bool = True,
) -> None:
    """Persist an audit log row without letting logging failures break callers."""
    serialized: Optional[str]
    if details is None:
        serialized = None
    elif isinstance(details, str):
        serialized = details[:2000]
    else:
        serialized = json.dumps(details, default=str)[:2000]

    try:
        session.add(
            AuditLogModel(
                created_at=datetime.utcnow(),
                actor_user_id=actor_user_id,
                actor_email=actor_email,
                action=action[:120],
                resource_type=resource_type[:80] if resource_type else None,
                resource_id=resource_id[:160] if resource_id else None,
                status=status[:32],
                ip_address=ip_address[:64] if ip_address else None,
                details=serialized,
            )
        )
        if commit:
            await session.commit()
    except Exception as exc:
        log.warning("Failed to persist audit event %s: %s", action, exc)
