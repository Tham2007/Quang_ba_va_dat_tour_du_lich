"""Public tours and schedules."""

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from api.core import db_session, fail
from api.services.tour_service import public_tour, availability
from api.services.booking_service import sweep
from api.repositories.tour_repository import list_public_tours
from api.models import Tour, Schedule, lock_writes, now


def tours(
    q: str = "",
    region: str = "",
    flash: bool = False,
    max_price: int | None = None,
    db: Session = Depends(db_session),
):
    return [
        public_tour(t)
        for t in list_public_tours(
            db, q=q, region=region, flash=flash, max_price=max_price
        )
    ]


def tour_one(tour_id: str, db: Session = Depends(db_session)):
    t = db.get(Tour, tour_id)
    if not t or not t.active:
        fail(404, "Không tìm thấy tour.")
    return public_tour(t)


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
