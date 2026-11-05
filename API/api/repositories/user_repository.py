"""User query boundaries."""

from sqlalchemy import select
from api.models import User


def user_conflict(db, email: str, phone: str) -> bool:
    return bool(
        db.scalar(select(User.id).where((User.email == email) | (User.phone == phone)))
    )


def phone_conflict(db, phone: str, exclude_user_id: str) -> bool:
    return bool(
        db.scalar(
            select(User.id).where(User.phone == phone, User.id != exclude_user_id)
        )
    )


def find_user_by_email(db, email: str):
    return db.scalar(select(User).where((User.email == email) | (User.phone == email)))


def find_user_by_identifier(db, ident: str):
    return db.scalar(select(User).where((User.email == ident) | (User.phone == ident)))
