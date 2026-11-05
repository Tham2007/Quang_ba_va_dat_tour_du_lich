"""Models with one shared SQLAlchemy metadata object."""

from datetime import datetime
from sqlalchemy import (
    ForeignKey,
    Integer,
    BigInteger,
    String,
    Boolean,
    DateTime,
    CheckConstraint,
    UniqueConstraint,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, now


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_user_booking_key"),
        UniqueConstraint("payment_evidence", name="uq_booking_payment_evidence"),
        CheckConstraint(
            "status IN ('PENDING_PAYMENT','PAID','CONFIRMED','COMPLETED','CANCELLED','EXPIRED')",
            name="ck_booking_status",
        ),
        CheckConstraint(
            "adults >= 1 AND children >= 0 AND infants >= 0 AND seats_held = adults + children + infants AND seats_held <= 20 AND unit_price >= 0 AND total_price >= 0",
            name="ck_booking_counts",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    reference: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    schedule_id: Mapped[str] = mapped_column(
        ForeignKey("schedules.id", ondelete="RESTRICT")
    )
    idempotency_key: Mapped[str] = mapped_column(String(36))
    payload_fingerprint: Mapped[str] = mapped_column(String(64))
    tour_title: Mapped[str] = mapped_column(String(255))
    customer_name: Mapped[str] = mapped_column(String(120))
    customer_phone: Mapped[str] = mapped_column(String(20))
    customer_email: Mapped[str] = mapped_column(String(254))
    customer_identity: Mapped[str | None] = mapped_column(String(12), nullable=True)
    note: Mapped[str] = mapped_column(String(500), default="")
    adults: Mapped[int] = mapped_column(Integer)
    children: Mapped[int] = mapped_column(Integer)
    infants: Mapped[int] = mapped_column(Integer)
    seats_held: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[int] = mapped_column(BigInteger)
    total_price: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(24), default="PENDING_PAYMENT")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now
    )
    payment_evidence: Mapped[str | None] = mapped_column(String(250), nullable=True)
    payment_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
