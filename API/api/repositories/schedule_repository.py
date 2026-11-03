"""Per-schedule inventory lock query."""

from sqlalchemy import select
from api.models import Schedule


def lock_schedule(db, schedule_id: str):
    return db.scalar(
        select(Schedule).where(Schedule.id == schedule_id).with_for_update()
    )
