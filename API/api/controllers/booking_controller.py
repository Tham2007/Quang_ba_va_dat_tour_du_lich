"""Quote, create, retrieve and cancel bookings (demo persistence only)."""

from fastapi import Depends, Header
from sqlalchemy.orm import Session
from api.core import db_session, me
from api.services.booking_service import (
    cancel_user_booking,
    confirm_customer_payment,
    place_booking,
    quote_schedule,
    user_booking,
    user_bookings,
)
from api.schemas import BookingInput, PaymentEvidence, QuoteInput


def quote(body: QuoteInput, db: Session = Depends(db_session)):
    return quote_schedule(
        db,
        body.schedule_id,
        body.adults,
        body.children,
        body.infants,
    )


def create_booking(
    body: BookingInput,
    user=Depends(me),
    db: Session = Depends(db_session),
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
):
    return place_booking(db, user, body, idempotency_key)


def my_bookings(user=Depends(me), db: Session = Depends(db_session)):
    return user_bookings(db, user.id)


def my_booking(booking_id: str, user=Depends(me), db: Session = Depends(db_session)):
    return user_booking(db, booking_id, user)


def cancel_booking(
    booking_id: str, user=Depends(me), db: Session = Depends(db_session)
):
    return cancel_user_booking(db, booking_id, user.id)


def pay_booking(
    booking_id: str,
    body: PaymentEvidence,
    user=Depends(me),
    db: Session = Depends(db_session),
):
    return confirm_customer_payment(db, booking_id, body.reference, user)
