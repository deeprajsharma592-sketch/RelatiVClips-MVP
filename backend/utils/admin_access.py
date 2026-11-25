"""Server-only founder identity policy for the private admin workspace."""
import os

ALLOWED_ADMIN_DOMAIN = "relativclips.com"

ADMIN_EMAILS = frozenset(
    email.strip().lower()
    for email in os.getenv(
        "ADMIN_EMAILS",
        "siddharth@relativclips.com,deepraj@relativclips.com",
    ).split(",")
    if email.strip() and email.strip().lower().endswith(f"@{ALLOWED_ADMIN_DOMAIN}")
)


def is_allowed_admin_domain(email: str) -> bool:
    return email.strip().lower().endswith(f"@{ALLOWED_ADMIN_DOMAIN}")


def is_admin_email(email: str) -> bool:
    normalized = email.strip().lower()
    return is_allowed_admin_domain(normalized) and normalized in ADMIN_EMAILS
