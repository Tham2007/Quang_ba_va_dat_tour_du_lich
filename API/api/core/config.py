"""Environment and session settings."""
import os

ENV = os.getenv("DELTA_ENV", "development")
SECURE_COOKIE = ENV in ("staging", "production")
SESSION_NAME = "delta_session"
CSRF_NAME = "delta_csrf"
HOLD_MINUTES = 15
