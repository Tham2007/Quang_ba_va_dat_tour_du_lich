"""Password verification remains server-side."""
from api.core.security import verify_password


def credentials_match(user, password: str) -> bool:
    return bool(user and user.active and verify_password(password, user.password_hash))
