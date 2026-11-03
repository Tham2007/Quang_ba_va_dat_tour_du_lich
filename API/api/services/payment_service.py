"""Manual payment proof reuse validation."""
from sqlalchemy import select
from api.models import Booking


def payment_reference_used(db, reference: str, *, except_booking_id: str) -> bool:
    return bool(db.scalar(select(Booking.id).where(Booking.payment_evidence == reference, Booking.id != except_booking_id).limit(1)))
