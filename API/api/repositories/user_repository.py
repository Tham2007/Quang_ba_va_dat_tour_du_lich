"""User query boundaries."""

from sqlalchemy import select
from api.models import User


def user_conflict(db, email: str, phone: str) -> bool:
    return bool(
        db.scalar(select(User.id).where((User.email == email) | (User.phone == phone)))
    )


def find_user_by_email(db, email: str):
    return db.scalar(select(User).where(User.email == email))
