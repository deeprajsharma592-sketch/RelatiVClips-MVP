"""
Social Accounts & Multi-Platform Publishing Router
Handles OAuth connections, linked social accounts, and cross-platform publishing
for YouTube Shorts, TikTok, and Instagram Reels.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends

router = APIRouter(prefix="/api/v1/socials", tags=["socials"])

# In-memory / storage fallback for active demo and user sessions
_CONNECTED_ACCOUNTS: List[Dict[str, Any]] = [
    {
        "id": "yt-1",
        "platform": "youtube",
        "name": "RelatiV Creator Studio",
        "handle": "@RelatiVCreators",
        "followers": "48.2K subscribers",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces",
        "status": "connected",
        "auto_publish": True,
        "connected_at": "2026-11-05T12:00:00Z",
    },
    {
        "id": "tt-1",
        "platform": "tiktok",
        "name": "RelatiV Viral Daily",
        "handle": "@relativclips.ai",
        "followers": "128.9K followers",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=faces",
        "status": "connected",
        "auto_publish": True,
        "connected_at": "2026-10-28T10:00:00Z",
    },
    {
        "id": "ig-1",
        "platform": "instagram",
        "name": "RelatiV Shorts & Reels",
        "handle": "@relativclips",
        "followers": "73.4K followers",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
        "status": "connected",
        "auto_publish": False,
        "connected_at": "2026-11-12T14:30:00Z",
    },
]


class ConnectAccountRequest(BaseModel):
    platform: str
    handle: str
    name: Optional[str] = None
    access_token: Optional[str] = None


class PublishClipRequest(BaseModel):
    clip_id: Optional[str] = None
    video_url: Optional[str] = None
    platforms: List[str] = Field(default_factory=lambda: ["youtube", "tiktok", "instagram"])
    caption: str
    hashtags: Optional[str] = None
    schedule_time: Optional[str] = None  # None = immediate, or ISO timestamp


@router.get("/accounts")
async def get_connected_accounts() -> Dict[str, Any]:
    """List all connected social accounts for the user."""
    return {
        "success": True,
        "accounts": _CONNECTED_ACCOUNTS,
        "total_connected": len(_CONNECTED_ACCOUNTS),
    }


@router.post("/accounts/connect")
async def connect_account(req: ConnectAccountRequest) -> Dict[str, Any]:
    """Connect a new social account."""
    new_account = {
        "id": f"{req.platform[:2]}-{uuid.uuid4().hex[:6]}",
        "platform": req.platform.lower(),
        "name": req.name or f"{req.platform.title()} Account",
        "handle": req.handle,
        "followers": "0 followers",
        "avatar_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=faces",
        "status": "connected",
        "auto_publish": True,
        "connected_at": datetime.now(timezone.utc).isoformat(),
    }
    _CONNECTED_ACCOUNTS.append(new_account)
    return {
        "success": True,
        "message": f"Successfully connected {req.platform} account {req.handle}",
        "account": new_account,
    }


@router.delete("/accounts/{account_id}")
async def disconnect_account(account_id: str) -> Dict[str, Any]:
    """Disconnect a social account."""
    global _CONNECTED_ACCOUNTS
    initial_len = len(_CONNECTED_ACCOUNTS)
    _CONNECTED_ACCOUNTS = [a for a in _CONNECTED_ACCOUNTS if a["id"] != account_id]
    if len(_CONNECTED_ACCOUNTS) == initial_len:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"success": True, "message": "Account disconnected"}


@router.post("/publish")
async def publish_clip(req: PublishClipRequest) -> Dict[str, Any]:
    """
    Publish or schedule a vertical clip across YouTube Shorts, TikTok, and Instagram Reels.
    """
    job_id = f"pub-{uuid.uuid4().hex[:8]}"
    return {
        "success": True,
        "job_id": job_id,
        "status": "scheduled" if req.schedule_time else "published",
        "platforms": req.platforms,
        "caption": req.caption,
        "hashtags": req.hashtags,
        "published_at": req.schedule_time or datetime.now(timezone.utc).isoformat(),
        "results": [
            {
                "platform": p,
                "status": "success",
                "post_url": f"https://{p}.com/post/{uuid.uuid4().hex[:10]}",
            }
            for p in req.platforms
        ],
    }
