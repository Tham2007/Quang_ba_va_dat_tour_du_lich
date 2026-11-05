"""Parameterized catalog and departure-schedule queries."""

from datetime import datetime, time, timedelta, timezone

from sqlalchemy import exists, func, or_, select

from api.models import Schedule, Tour, now


AUDIENCE_TERMS = {
    "family": ("gia đình", "trẻ em", "thiếu nhi"),
    "couple": ("cặp đôi", "lãng mạn", "tuần trăng mật"),
    "friends": ("nhóm bạn", "bạn bè", "team building"),
}


def _pattern(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _schedule_conditions(filters):
    conditions = [
        Schedule.active.is_(True),
        Schedule.departure_at > now(),
    ]
    if filters.departure_date:
        start = datetime.combine(
            filters.departure_date, time.min, tzinfo=timezone.utc
        )
        conditions.extend(
            (Schedule.departure_at >= start, Schedule.departure_at < start + timedelta(days=1))
        )
    if filters.availability == "available":
        conditions.append(Schedule.total_seats > Schedule.reserved_seats)
    elif filters.availability == "sold_out":
        conditions.append(Schedule.total_seats <= Schedule.reserved_seats)
    return conditions


def search_public_tours(db, filters):
    conditions = [Tour.active.is_(True)]
    if filters.region != "all":
        conditions.append(Tour.region == filters.region)
    for value, columns in (
        (
            filters.q,
            (Tour.title, Tour.description, Tour.departure, Tour.transport),
        ),
        (
            filters.destination,
            (Tour.title, Tour.description, Tour.region),
        ),
        (filters.departure_location, (Tour.departure,)),
        (filters.duration, (Tour.duration,)),
        (filters.transport, (Tour.transport,)),
    ):
        if value:
            pattern = _pattern(value)
            conditions.append(
                or_(*(column.ilike(pattern, escape="\\") for column in columns))
            )
    if filters.min_price is not None:
        conditions.append(Tour.price >= filters.min_price)
    if filters.max_price is not None:
        conditions.append(Tour.price <= filters.max_price)
    if filters.tour_type == "domestic":
        conditions.append(Tour.region.in_(("north", "central", "south")))
    elif filters.tour_type == "international":
        conditions.append(Tour.region.not_in(("north", "central", "south")))
    if filters.audience:
        terms = AUDIENCE_TERMS[filters.audience]
        conditions.append(
            or_(
                *(
                    column.ilike(_pattern(term), escape="\\")
                    for column in (Tour.title, Tour.description, Tour.itinerary_json)
                    for term in terms
                )
            )
        )

    schedule_conditions = _schedule_conditions(filters)
    matching_schedule = select(Schedule.id).where(
        Schedule.tour_id == Tour.id, *schedule_conditions
    )
    if filters.departure_date or filters.availability == "available":
        conditions.append(exists(matching_schedule))
    elif filters.availability == "sold_out":
        conditions.append(exists(matching_schedule))

    query = select(Tour).where(*conditions)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    if filters.sort_by == "price_asc":
        query = query.order_by(Tour.price.asc(), Tour.id.asc())
    elif filters.sort_by == "price_desc":
        query = query.order_by(Tour.price.desc(), Tour.id.asc())
    elif filters.sort_by == "newest":
        query = query.order_by(Tour.updated_at.desc(), Tour.id.asc())
    elif filters.sort_by == "departure_soonest":
        departure = (
            select(func.min(Schedule.departure_at))
            .where(Schedule.tour_id == Tour.id, *schedule_conditions)
            .correlate(Tour)
            .scalar_subquery()
        )
        query = query.order_by(departure.asc(), Tour.id.asc())
    else:
        query = query.order_by(Tour.id.asc())
    tours = db.scalars(
        query.offset((filters.page - 1) * filters.page_size).limit(filters.page_size)
    ).all()
    tour_ids = [tour.id for tour in tours]
    schedules = (
        db.scalars(
            select(Schedule)
            .where(Schedule.tour_id.in_(tour_ids), *schedule_conditions)
            .order_by(Schedule.departure_at, Schedule.id)
        ).all()
        if tour_ids
        else []
    )
    schedules_by_tour = {}
    for schedule in schedules:
        schedules_by_tour.setdefault(schedule.tour_id, []).append(schedule)
    return tours, schedules_by_tour, total
