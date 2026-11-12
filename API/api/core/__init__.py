"""Public dependencies retained after MVC conversion."""

from .config import ENV, SECURE_COOKIE, SESSION_NAME, CSRF_NAME, HOLD_MINUTES
from .session import (
    utc,
    iso,
    new_id,
    fail,
    db_session,
    me,
    admin,
    user_dict,
    set_auth_cookies,
    audit,
)

SECURITY_CSP = (
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; "
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:; "
    "img-src 'self' https: data: blob: http:; "
    "connect-src 'self' https: http:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
)

__all__ = [
    "ENV",
    "SECURE_COOKIE",
    "SESSION_NAME",
    "CSRF_NAME",
    "HOLD_MINUTES",
    "SECURITY_CSP",
    "utc",
    "iso",
    "new_id",
    "fail",
    "db_session",
    "me",
    "admin",
    "user_dict",
    "set_auth_cookies",
    "audit",
]
