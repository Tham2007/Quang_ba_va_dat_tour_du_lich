"""Booking queries; transaction and authorization remain caller-owned."""

from sqlalchemy import select
from api.models import Booking


def find_by_idempotency(db, user_id: str, key: str):
    return db.scalar(
        select(Booking).where(
            Booking.user_id == user_id, Booking.idempotency_key == key
        )
    )


def lock_booking_for_owner(db, booking_id: str, user_id: str):
    return db.scalar(
        select(Booking)
        .where(Booking.id == booking_id, Booking.user_id == user_id)
        .with_for_update()
    )


def list_bookings_for_user(db, user_id: str):
    return db.scalars(
        select(Booking)
        .where(Booking.user_id == user_id)
        .order_by(Booking.created_at.desc())
    ).all()


def get_booking(db, booking_id: str):
    return db.get(Booking, booking_id)


def lock_booking_by_reference_for_owner(db, reference: str, user_id: str):
    return db.scalar(
        select(Booking)
        .where(Booking.reference == reference, Booking.user_id == user_id)
        .with_for_update()
    )
