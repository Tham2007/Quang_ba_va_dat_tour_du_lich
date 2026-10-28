"""Public tours and schedules."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from api.core import db_session, fail
from api.logic import public_tour, availability, sweep
from api.models import Tour, Schedule, lock_writes, now

router = APIRouter()


@router.get("/api/v1/tours")
def tours(
    q: str = "",
    region: str = "",
    flash: bool = False,
    max_price: int | None = None,
    db: Session = Depends(db_session),
):
    stmt = select(Tour).where(Tour.active.is_(True))
    if region:
        stmt = stmt.where(Tour.region == region)
    if flash:
        stmt = stmt.where(Tour.flash_sale.is_(True))
    if max_price is not None:
        stmt = stmt.where(Tour.price <= max_price)
    if q:
        stmt = stmt.where(
            Tour.title.ilike(
                "%" + q.replace("%", "\\%").replace("_", "\\_") + "%", escape="\\"
            )
        )
    return [public_tour(t) for t in db.scalars(stmt.order_by(Tour.id)).all()]


@router.get("/api/v1/tours/{tour_id}")
def tour_one(tour_id: str, db: Session = Depends(db_session)):
    t = db.get(Tour, tour_id)
    if not t or not t.active:
        fail(404, "Không tìm thấy tour.")
    return public_tour(t)


@router.get("/api/v1/tours/{tour_id}/schedules")
def schedules(tour_id: str, db: Session = Depends(db_session)):
    t = db.get(Tour, tour_id)
    if not t or not t.active:
        fail(404, "Không tìm thấy tour.")
    with db.begin_nested():
        lock_writes(db)
        sweep(db)
    db.commit()
    return [
        availability(s)
        for s in db.scalars(
            select(Schedule)
            .where(
                Schedule.tour_id == tour_id,
                Schedule.active.is_(True),
                Schedule.departure_at > now(),
            )
            .order_by(Schedule.departure_at)
        ).all()
    ]
