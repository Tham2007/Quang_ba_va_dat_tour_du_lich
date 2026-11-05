"""Restricted administration: changes require verified admin session."""

import json
from datetime import timedelta, timezone
from fastapi import Depends
from sqlalchemy import delete, select, func
from sqlalchemy.orm import Session
from api.core import admin, audit, db_session, fail, iso, new_id, utc
from api.services.tour_service import (
    admin_tour_details,
    availability,
    public_tour,
)
from api.services.booking_service import booking_dict, sweep
from api.services.admin_service import admin_booking_record
from api.services.payment_service import payment_reference_used
from api.models import (
    User,
    Tour,
    TourCostItem,
    ItineraryItem,
    Schedule,
    Booking,
    Audit,
    lock_writes,
    now,
)
from api.schemas import (
    TourCreate,
    TourPatch,
    ScheduleCreate,
    SchedulePatch,
    PaymentEvidence,
    TourDetailsReplace,
)


def admin_tour_create(
    body: TourCreate, user=Depends(admin), db: Session = Depends(db_session)
):
    data = body.model_dump(exclude_none=True)
    images = data.pop("images", None)
    if images is not None:
        data["image"] = json.dumps(images, ensure_ascii=False)
    data.setdefault("description", "")
    data.setdefault("flash_sale", False)
    data.setdefault("active", True)
    with db.begin_nested():
        lock_writes(db)
        if db.get(Tour, body.id):
            fail(409, "Mã tour đã tồn tại.")
        t = Tour(**data)
        db.add(t)
        audit(db, user, "TOUR_CREATED", t.id)
    db.commit()
    return public_tour(t)


def admin_tour_patch(
    tour_id: str,
    body: TourPatch,
    user=Depends(admin),
    db: Session = Depends(db_session),
):
    patch = body.model_dump(exclude_unset=True)
    if any(v is None for v in patch.values()):
        fail(422, "Không được gán null.")
    images = patch.pop("images", None)
    if images is not None:
        patch["image"] = json.dumps(images, ensure_ascii=False)
    with db.begin_nested():
        lock_writes(db)
        t = db.scalar(select(Tour).where(Tour.id == tour_id).with_for_update())
        if not t:
            fail(404, "Không tìm thấy tour.")
        if "price" in patch:
            base_cost = db.scalar(
                select(func.coalesce(func.sum(TourCostItem.amount_per_person), 0)).where(
                    TourCostItem.tour_id == tour_id
                )
            )
            if patch["price"] <= base_cost:
                fail(422, "Giá bán phải cao hơn tổng giá gốc.")
        for key, value in patch.items():
            setattr(t, key, value)
        audit(db, user, "TOUR_UPDATED", t.id, {"fields": list(patch.keys())})
    db.commit()
    return public_tour(t)


def get_admin_tour_details(
    tour_id: str, user=Depends(admin), db: Session = Depends(db_session)
):
    tour = db.get(Tour, tour_id)
    if not tour:
        fail(404, "Không tìm thấy tour.")
    return admin_tour_details(db, tour)


def replace_admin_tour_details(
    tour_id: str,
    body: TourDetailsReplace,
    user=Depends(admin),
    db: Session = Depends(db_session),
):
    with db.begin_nested():
        lock_writes(db)
        tour = db.scalar(select(Tour).where(Tour.id == tour_id).with_for_update())
        if not tour:
            fail(404, "Không tìm thấy tour.")
        base_cost = sum(item.amount_per_person for item in body.cost_items)
        if body.price <= base_cost:
            fail(422, "Giá bán phải cao hơn tổng giá gốc.")
        tour.price = body.price
        db.execute(delete(TourCostItem).where(TourCostItem.tour_id == tour_id))
        db.execute(delete(ItineraryItem).where(ItineraryItem.tour_id == tour_id))
        db.add_all(
            TourCostItem(
                id=new_id(),
                tour_id=tour_id,
                category=item.category,
                name=item.name,
                notes=item.notes,
                amount_per_person=item.amount_per_person,
            )
            for item in body.cost_items
        )
        db.add_all(
            ItineraryItem(
                id=new_id(),
                tour_id=tour_id,
                day_number=item.day_number,
                sequence=item.sequence,
                category=item.category,
                title=item.title,
                description=item.description,
                location=item.location,
                start_time=item.start_time,
            )
            for item in body.itinerary
        )
        audit(
            db,
            user,
            "TOUR_DETAILS_REPLACED",
            tour_id,
            {
                "price": body.price,
                "costItemCount": len(body.cost_items),
                "itineraryItemCount": len(body.itinerary),
            },
        )
    db.commit()
    return admin_tour_details(db, tour)


def admin_tour_delete(
    tour_id: str,
    user=Depends(admin),
    db: Session = Depends(db_session),
):
    """Soft-delete the catalog record without destroying booking history.

    A previously booked tour remains in storage for referential integrity and
    audit, but is hidden from public catalog queries. Repeated DELETE is safe.
    Requires an authenticated ADMIN and valid CSRF token.
    """
    with db.begin_nested():
        lock_writes(db)
        tour = db.scalar(select(Tour).where(Tour.id == tour_id).with_for_update())
        if tour is None:
            fail(404, "Không tìm thấy tour.")
        if tour.active:
            tour.active = False
            audit(db, user, "TOUR_SOFT_DELETED", tour.id)
    db.commit()
    return {"id": tour.id, "active": False, "deleted": True}


def add_schedule(
    body: ScheduleCreate, user=Depends(admin), db: Session = Depends(db_session)
):
    if body.departure_at.astimezone(timezone.utc) <= now() + timedelta(hours=72):
        fail(422, "Lịch phải cách tối thiểu 72 giờ.")
    with db.begin_nested():
        lock_writes(db)
        t = db.get(Tour, body.tour_id)
        if not t:
            fail(404, "Không tìm thấy tour.")
        s = Schedule(
            id=new_id(),
            tour_id=body.tour_id,
            departure_at=body.departure_at.astimezone(timezone.utc),
            total_seats=body.total_seats,
            reserved_seats=0,
        )
        db.add(s)
        audit(db, user, "SCHEDULE_CREATED", s.id)
    db.commit()
    return availability(s)


def patch_schedule(
    schedule_id: str,
    body: SchedulePatch,
    user=Depends(admin),
    db: Session = Depends(db_session),
):
    patch = body.model_dump(exclude_unset=True)
    if any(v is None for v in patch.values()):
        fail(422, "Không được gán null.")
    with db.begin_nested():
        lock_writes(db)
        sweep(db)
        s = db.scalar(
            select(Schedule).where(Schedule.id == schedule_id).with_for_update()
        )
        if not s:
            fail(404, "Không tìm thấy lịch.")
        if body.total_seats is not None and body.total_seats < s.reserved_seats:
            fail(409, "Không thể giảm dưới số chỗ đã giữ.")
        for k, v in patch.items():
            setattr(s, k, v)
        audit(db, user, "SCHEDULE_UPDATED", s.id, {"fields": list(patch.keys())})
    db.commit()
    return availability(s)


def confirm_payment(
    booking_id: str,
    body: PaymentEvidence,
    user=Depends(admin),
    db: Session = Depends(db_session),
):
    """Offline bank verification MUST be performed by a human before using this endpoint.
    This is NOT an automated payment gateway and does not read a client payment flag.
    """
    with db.begin_nested():
        lock_writes(db)
        sweep(db)
        b = db.scalar(select(Booking).where(Booking.id == booking_id).with_for_update())
        if not b:
            fail(404, "Không tìm thấy đơn.")
        if b.status == "PAID":
            if b.payment_evidence != body.reference:
                fail(409, "Bằng chứng thanh toán không khớp.")
            return booking_dict(b)
        if b.status != "PENDING_PAYMENT":
            fail(
                409,
                "Đơn không còn chờ thanh toán. Cần xử lý hoàn tiền ngoài hệ thống nếu đã chuyển.",
            )
        duplicate = payment_reference_used(db, body.reference, except_booking_id=b.id)
        if duplicate:
            fail(409, "Mã giao dịch đã được sử dụng cho đơn khác.")
        b.status = "PAID"
        b.payment_evidence = body.reference
        b.payment_confirmed_at = now()
        audit(
            db,
            user,
            "PAYMENT_MANUALLY_VERIFIED",
            b.id,
            {"proofReference": body.reference},
        )
    db.commit()
    return booking_dict(b)


def admin_bookings(user=Depends(admin), db: Session = Depends(db_session)):
    with db.begin_nested():
        lock_writes(db)
        sweep(db)
    db.commit()
    result = []
    for b in db.scalars(
        select(Booking).order_by(Booking.created_at.desc()).limit(100)
    ).all():
        record = admin_booking_record(b)
        result.append(record)
    return result


def admin_tours(user=Depends(admin), db: Session = Depends(db_session)):
    return [
        {**public_tour(t), "active": t.active}
        for t in db.scalars(select(Tour).order_by(Tour.id)).all()
    ]


def admin_all_schedules(
    tour_id: str | None = None, user=Depends(admin), db: Session = Depends(db_session)
):
    stmt = select(Schedule)
    if tour_id:
        stmt = stmt.where(Schedule.tour_id == tour_id)
    return [
        availability(s) for s in db.scalars(stmt.order_by(Schedule.departure_at)).all()
    ]


def metrics(user=Depends(admin), db: Session = Depends(db_session)):
    statuses = db.execute(
        select(Booking.status, func.count()).group_by(Booking.status)
    ).all()
    return {
        "users": db.scalar(select(func.count()).select_from(User)),
        "tours": db.scalar(select(func.count()).select_from(Tour)),
        "bookings": dict(statuses),
    }


def audit_list(user=Depends(admin), db: Session = Depends(db_session)):
    return [
        {
            "id": e.id,
            "event": e.event_type,
            "actorId": e.actor_id,
            "subjectId": e.subject_id,
            "details": json.loads(e.details),
            "at": iso(e.created_at),
        }
        for e in db.scalars(
            select(Audit).order_by(Audit.created_at.desc()).limit(100)
        ).all()
    ]
