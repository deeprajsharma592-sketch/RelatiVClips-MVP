"""Server-only founder identity policy for the private admin workspace."""
import os

ADMIN_EMAILS = frozenset(
    email.strip().lower()
    for email in os.getenv(
        "ADMIN_EMAILS",
        "deeprajsharma592@gmail.com,deeprajsharma780@gmail.com",
    ).split(",")
    if email.strip()
)


def is_admin_email(email: str) -> bool:
    return email.strip().lower() in ADMIN_EMAILS
