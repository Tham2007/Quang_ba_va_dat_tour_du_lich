"""Public tours and schedules."""

import math
from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from api.core import db_session, fail
from api.services.tour_service import public_tour, availability, itinerary_items
from api.services.booking_service import sweep
from api.repositories.tour_repository import search_public_tours
from api.models import Tour, Schedule, lock_writes, now
from api.schemas import TourSearch


def tours(
    filters: TourSearch = Depends(),
    db: Session = Depends(db_session),
):
    if (
        filters.min_price is not None
        and filters.max_price is not None
        and filters.min_price > filters.max_price
    ):
        fail(422, "Giá tối thiểu không được lớn hơn giá tối đa.")
    tours, schedules_by_tour, total = search_public_tours(db, filters)
    return {
        "items": [
            {
                **public_tour(tour),
                "schedules": [
                    availability(schedule)
                    for schedule in schedules_by_tour.get(tour.id, [])
                ],
            }
            for tour in tours
        ],
        "total": total,
        "page": filters.page,
        "pageSize": filters.page_size,
        "totalPages": math.ceil(total / filters.page_size),
    }


def tour_one(tour_id: str, db: Session = Depends(db_session)):
    t = db.get(Tour, tour_id)
    if not t or not t.active:
        fail(404, "Không tìm thấy tour.")
    return public_tour(t)


def tour_itinerary(tour_id: str, db: Session = Depends(db_session)):
    t = db.get(Tour, tour_id)
    if not t or not t.active:
        fail(404, "Không tìm thấy tour.")
    return itinerary_items(db, tour_id)


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
