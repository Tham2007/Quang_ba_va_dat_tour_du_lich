"""Private tour cost breakdown and publishable, day-by-day itinerary."""

from datetime import time

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class TourCostItem(Base):
    __tablename__ = "tour_cost_items"
    __table_args__ = (
        CheckConstraint("amount_per_person >= 0", name="ck_tour_cost_nonnegative"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tour_id: Mapped[str] = mapped_column(
        ForeignKey("tours.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[str] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(150))
    notes: Mapped[str] = mapped_column(Text, default="")
    amount_per_person: Mapped[int] = mapped_column(BigInteger)


class ItineraryItem(Base):
    __tablename__ = "itinerary_items"
    __table_args__ = (
        UniqueConstraint(
            "tour_id", "day_number", "sequence", name="uq_itinerary_tour_day_sequence"
        ),
        CheckConstraint("day_number > 0", name="ck_itinerary_day_positive"),
        CheckConstraint("sequence > 0", name="ck_itinerary_sequence_positive"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tour_id: Mapped[str] = mapped_column(
        ForeignKey("tours.id", ondelete="CASCADE"), index=True
    )
    day_number: Mapped[int] = mapped_column(Integer)
    sequence: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(String(180), default="")
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
