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


class Audit(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    actor_id: Mapped[str] = mapped_column(String(36), index=True)
    event_type: Mapped[str] = mapped_column(String(60))
    subject_id: Mapped[str] = mapped_column(String(36))
    details: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
