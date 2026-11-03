"""Models with one shared SQLAlchemy metadata object."""
from datetime import datetime
from sqlalchemy import ForeignKey, Integer, BigInteger, String, Boolean, DateTime, CheckConstraint, UniqueConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, now


class Schedule(Base):
    __tablename__ = 'schedules'
    __table_args__ = (UniqueConstraint('tour_id', 'departure_at', name='uq_tour_departure'),
                      CheckConstraint('total_seats > 0 AND reserved_seats >= 0 AND reserved_seats <= total_seats',name='ck_inventory'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tour_id: Mapped[str] = mapped_column(ForeignKey('tours.id', ondelete='RESTRICT'), index=True)
    departure_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    total_seats: Mapped[int] = mapped_column(Integer)
    reserved_seats: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
