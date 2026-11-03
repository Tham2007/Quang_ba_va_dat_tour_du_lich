"""Booking queries; transaction and authorization remain caller-owned."""
from sqlalchemy import select
from api.models import Booking


def find_by_idempotency(db, user_id: str, key: str):
    return db.scalar(select(Booking).where(Booking.user_id == user_id, Booking.idempotency_key == key))


def lock_booking_for_owner(db, booking_id: str, user_id: str):
    return db.scalar(select(Booking).where(Booking.id == booking_id, Booking.user_id == user_id).with_for_update())
