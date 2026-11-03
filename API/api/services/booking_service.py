"""Booking pricing, expiry and response mapping."""
from sqlalchemy import select
from api.models import Booking, Schedule, now
from api.core import iso, fail


def sweep(db):
    """Release expired unpaid holds inside the caller's write transaction."""
    expired = db.scalars(
        select(Booking)
        .where(Booking.status == "PENDING_PAYMENT", Booking.expires_at <= now())
        .with_for_update()
    ).all()
    for b in expired:
        sched = db.get(Schedule, b.schedule_id)
        if sched:
            sched.reserved_seats -= b.seats_held
            if sched.reserved_seats < 0:
                raise RuntimeError("Inventory invariant violated")
        b.status = "EXPIRED"
    return len(expired)

def totals(price, adults, children, infants):
    return (
        price * adults
        + ((price * 75 + 50) // 100) * children
        + ((price * 10 + 50) // 100) * infants
    )

def check_people(adults, children, infants):
    seats = adults + children + infants
    if seats > 20:
        fail(422, "Tối đa 20 hành khách mỗi đơn.")
    return seats

def booking_dict(b):
    return {
        "id": b.id,
        "reference": b.reference,
        "scheduleId": b.schedule_id,
        "tourTitle": b.tour_title,
        "customerName": b.customer_name,
        "adults": b.adults,
        "children": b.children,
        "infants": b.infants,
        "seats": b.seats_held,
        "unitPrice": b.unit_price,
        "totalPrice": b.total_price,
        "status": b.status,
        "paid": b.status in ("PAID", "CONFIRMED", "COMPLETED"),
        "expiresAt": iso(b.expires_at),
        "createdAt": iso(b.created_at),
    }
