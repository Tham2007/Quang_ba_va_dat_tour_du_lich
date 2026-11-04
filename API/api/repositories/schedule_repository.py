"""Per-schedule inventory lock query."""

from sqlalchemy import select
from api.models import Schedule, Tour


def lock_schedule(db, schedule_id: str):
    return db.scalar(
        select(Schedule).where(Schedule.id == schedule_id).with_for_update()
    )


def schedule_with_tour(db, schedule_id: str):
    return db.execute(
        select(Schedule, Tour)
        .join(Tour, Tour.id == Schedule.tour_id)
        .where(Schedule.id == schedule_id)
    ).one_or_none()
