"""Booking pricing, expiry and response mapping."""

import hashlib
import uuid
from datetime import timedelta

from sqlalchemy import select
from api.core import HOLD_MINUTES, audit, fail, iso, new_id, utc
from api.models import Booking, Schedule, Tour, lock_writes, now
from api.repositories.booking_repository import (
    find_by_idempotency,
    get_booking,
    list_bookings_for_user,
    lock_booking_by_reference_for_owner,
    lock_booking_for_owner,
)
from api.repositories.schedule_repository import lock_schedule, schedule_with_tour
from api.services.payment_service import payment_reference_used


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


def ensure_capacity(available_seats, requested_seats):
    if requested_seats > available_seats:
        fail(409, f"Chỉ còn {available_seats} chỗ cho lịch khởi hành này.")


def quote_schedule(db, schedule_id, adults, children, infants):
    seats = check_people(adults, children, infants)
    schedule_pair = schedule_with_tour(db, schedule_id)
    if not schedule_pair:
        fail(404, "Lịch khởi hành không tồn tại.")
    schedule, tour = schedule_pair
    if not schedule.active or not tour.active or utc(schedule.departure_at) <= now():
        fail(404, "Lịch khởi hành không tồn tại.")
    with db.begin_nested():
        lock_writes(db)
        sweep(db)
    db.commit()
    available = schedule.total_seats - schedule.reserved_seats
    ensure_capacity(available, seats)
    return {
        "scheduleId": schedule.id,
        "tourId": tour.id,
        "seats": seats,
        "availableSeats": available,
        "unitPrice": tour.price,
        "totalPrice": totals(tour.price, adults, children, infants),
        "currency": "VND",
        "pricingRules": {"childPercent": 75, "infantPercent": 10},
        "addonsSupported": False,
        "vouchersSupported": False,
    }


def place_booking(db, user, body, idempotency_key):
    try:
        uuid.UUID(idempotency_key)
    except (ValueError, TypeError):
        fail(422, "Idempotency-Key phải là UUID.")
    seats = check_people(body.adults, body.children, body.infants)
    payload = body.model_dump_json(exclude_none=True)
    fingerprint = hashlib.sha256(payload.encode()).hexdigest()
    with db.begin_nested():
        lock_writes(db)
        existing = find_by_idempotency(db, user.id, idempotency_key)
        if existing:
            if existing.payload_fingerprint != fingerprint:
                fail(409, "Idempotency-Key đã được sử dụng với nội dung khác.")
            return booking_dict(existing)
        sweep(db)
        schedule = lock_schedule(db, body.schedule_id)
        tour = db.get(Tour, schedule.tour_id) if schedule else None
        if (
            not schedule
            or not tour
            or not schedule.active
            or not tour.active
            or utc(schedule.departure_at) <= now() + timedelta(hours=72)
        ):
            fail(409, "Không có lịch khởi hành hợp lệ (cần trước ít nhất 72 giờ).")
        ensure_capacity(schedule.total_seats - schedule.reserved_seats, seats)
        schedule.reserved_seats += seats
        booking = Booking(
            id=new_id(),
            reference="DT-" + uuid.uuid4().hex[:14].upper(),
            user_id=user.id,
            schedule_id=schedule.id,
            idempotency_key=idempotency_key,
            payload_fingerprint=fingerprint,
            tour_title=tour.title,
            customer_name=body.customer_name.strip(),
            customer_phone=body.customer_phone,
            customer_email=body.customer_email,
            customer_identity=body.customer_identity,
            note=body.note,
            adults=body.adults,
            children=body.children,
            infants=body.infants,
            seats_held=seats,
            unit_price=tour.price,
            total_price=totals(tour.price, body.adults, body.children, body.infants),
            status="PENDING_PAYMENT",
            expires_at=now() + timedelta(minutes=HOLD_MINUTES),
        )
        db.add(booking)
    db.commit()
    return booking_dict(booking)


def user_bookings(db, user_id):
    with db.begin_nested():
        lock_writes(db)
        sweep(db)
    db.commit()
    return [booking_dict(booking) for booking in list_bookings_for_user(db, user_id)]


def user_booking(db, booking_id, user):
    with db.begin_nested():
        lock_writes(db)
        sweep(db)
    db.commit()
    booking = get_booking(db, booking_id)
    if not booking or (booking.user_id != user.id and user.role != "ADMIN"):
        fail(404, "Không tìm thấy đơn.")
    return booking_dict(booking)


def cancel_user_booking(db, booking_id, user_id):
    with db.begin_nested():
        lock_writes(db)
        sweep(db)
        booking = lock_booking_for_owner(db, booking_id, user_id)
        if not booking:
            fail(404, "Không tìm thấy đơn.")
        schedule = db.get(Schedule, booking.schedule_id)
        if booking.status == "CANCELLED":
            return booking_dict(booking)
        if booking.status != "PENDING_PAYMENT":
            fail(409, "Không thể tự hủy đơn đã thanh toán hoặc hết hạn.")
        if utc(schedule.departure_at) <= now() + timedelta(hours=72):
            fail(409, "Đã qua hạn hủy 72 giờ.")
        booking.status = "CANCELLED"
        schedule.reserved_seats -= booking.seats_held
        if schedule.reserved_seats < 0:
            raise RuntimeError("Inventory invariant violated")
    db.commit()
    return booking_dict(booking)


def confirm_customer_payment(db, booking_id, reference, user):
    with db.begin_nested():
        lock_writes(db)
        sweep(db)
        booking = lock_booking_for_owner(db, booking_id, user.id)
        if not booking:
            booking = lock_booking_by_reference_for_owner(db, booking_id, user.id)
        if not booking:
            fail(404, "Không tìm thấy đơn.")
        if booking.status == "PAID":
            return booking_dict(booking)
        if booking.status != "PENDING_PAYMENT":
            fail(409, "Đơn không còn chờ thanh toán.")
        if payment_reference_used(db, reference, except_booking_id=booking.id):
            fail(409, "Mã giao dịch đã được sử dụng cho đơn khác.")
        booking.status = "PAID"
        booking.payment_evidence = reference
        booking.payment_confirmed_at = now()
        audit(
            db,
            user,
            "PAYMENT_CONFIRMED",
            booking.id,
            {"proofReference": reference, "amount": booking.total_price},
        )
    db.commit()
    return booking_dict(booking)


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
        "paymentEvidence": b.payment_evidence,
        "paymentConfirmedAt": iso(b.payment_confirmed_at),
        "expiresAt": iso(b.expires_at),
        "createdAt": iso(b.created_at),
    }
