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


class Tour(Base):
    __tablename__ = "tours"
    __table_args__ = (
        CheckConstraint("price > 0 AND original_price > 0", name="ck_positive_prices"),
    )
    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    slug: Mapped[str] = mapped_column(String(150), unique=True)
    title: Mapped[str] = mapped_column(String(255))
    region: Mapped[str] = mapped_column(String(20))
    duration: Mapped[str] = mapped_column(String(30))
    departure: Mapped[str] = mapped_column(String(255))
    transport: Mapped[str] = mapped_column(String(255))
    image: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default="")
    itinerary_json: Mapped[str] = mapped_column(Text, default="[]")
    price: Mapped[int] = mapped_column(BigInteger)
    original_price: Mapped[int] = mapped_column(BigInteger)
    flash_sale: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now
    )
