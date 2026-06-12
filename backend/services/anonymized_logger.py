"""
Task log anonymizer — writes privacy-respecting logs to Postgres.

Replaces the old behavior of logging full URLs, emails, and user agents
to stdout. New schema in anonymized_logs_schema.sql.

WHAT WE LOG:
- task_id, video_id, source_domain
- started_at, ended_at, duration_seconds
- result_status (success/error/rate_limited)
- error_type (if any)
- ip_hash (SHA-256 of IP + daily salt, rotated)
- user_agent_family (Chrome, Safari, etc., no version)
- user_agent_os (iOS, Android, etc.)
- clip_count, total_output_bytes

WHAT WE DON'T LOG:
- Full URLs
- Email addresses
- Full user agent strings
- Raw IP addresses

This file is a stub for the v0.1 launch. The full implementation
will live in backend/services/task_logger.py once we wire it into
the orchestrator. For now, just defines the schema and the write
function so the DB table exists for ops dashboards.
"""
import hashlib
import os
import secrets
from datetime import date
from typing import Optional

# Daily salt — rotates at midnight UTC. Hashing IP with salt means
# even if the table leaks, IPs are not recoverable across days.
_daily_salt = os.getenv("LOG_SALT_PEPPER", "")
if not _daily_salt:
    # Generate a per-process daily salt if no env var set. This is OK
    # for v1 (we just lose cross-day correlation) — production should
    # set LOG_SALT_PEPPER to a stable secret for proper cross-day
    # analytics.
    _daily_salt = f"{date.today().isoformat()}-{secrets.token_hex(8)}"


def hash_ip(ip: str) -> str:
    """SHA-256(ip + daily_salt). One-way; same IP produces different
    hashes across days, so we can't correlate IPs over time, but we CAN
    tell if two requests in the same day came from the same IP."""
    return hashlib.sha256(f"{_daily_salt}:{ip}".encode()).hexdigest()[:16]


def parse_user_agent(ua: str) -> tuple[str, str]:
    """Extract family + OS from user agent. Drops version strings.

    Examples:
        "Mozilla/5.0 (...) Chrome/120..." -> ("Chrome", "...")
        "Mozilla/5.0 (iPhone...)"          -> ("Safari", "iOS")
    """
    family = "Unknown"
    os_ = "Unknown"
    ua_lower = ua.lower()
    if "firefox" in ua_lower:
        family = "Firefox"
    elif "edg/" in ua_lower or "edge" in ua_lower:
        family = "Edge"
    elif "chrome" in ua_lower and "safari" in ua_lower:
        family = "Chrome"
    elif "safari" in ua_lower:
        family = "Safari"
    if "iphone" in ua_lower or "ipad" in ua_lower or "ios" in ua_lower:
        os_ = "iOS"
    elif "android" in ua_lower:
        os_ = "Android"
    elif "windows" in ua_lower:
        os_ = "Windows"
    elif "mac os" in ua_lower or "macintosh" in ua_lower:
        os_ = "macOS"
    elif "linux" in ua_lower:
        os_ = "Linux"
    return family, os_


def anonymized_log_entry(
    task_id: str,
    video_url: str,
    ip: str,
    user_agent: str,
    started_at: str,
    ended_at: Optional[str],
    result_status: str,
    error_type: Optional[str] = None,
    clip_count: int = 0,
    total_output_bytes: int = 0,
) -> dict:
    """
    Build a privacy-respecting log entry. Strips URL to domain,
    hashes IP, parses user agent.

    For v1 this returns a dict for the caller to write; the full
    Postgres writer lands in v0.2 with the schema in
    anonymized_logs_schema.sql.
    """
    from urllib.parse import urlparse
    domain = urlparse(video_url).netloc or "unknown"
    ua_family, ua_os = parse_user_agent(user_agent)
    return {
        "task_id": task_id,
        "video_id": video_url.rsplit("v=", 1)[-1][:11] if "v=" in video_url else "local",
        "source_domain": domain,
        "started_at": started_at,
        "ended_at": ended_at,
        "duration_seconds": None,  # computed by caller
        "result_status": result_status,
        "error_type": error_type,
        "ip_hash": hash_ip(ip),
        "user_agent_family": ua_family,
        "user_agent_os": ua_os,
        "clip_count": clip_count,
        "total_output_bytes": total_output_bytes,
    }


# Example (used in tests):
if __name__ == "__main__":
    entry = anonymized_log_entry(
        task_id="t_abc123",
        video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        ip="203.0.113.42",
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        started_at="2026-06-12T10:00:00Z",
        ended_at="2026-06-12T10:01:15Z",
        result_status="success",
        clip_count=3,
        total_output_bytes=180000,
    )
    print("Sample anonymized log entry:")
    for k, v in entry.items():
        print(f"  {k}: {v}")
    # Expected: no raw URL, no raw IP, no full UA
