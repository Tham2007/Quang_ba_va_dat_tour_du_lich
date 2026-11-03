"""Models with one shared SQLAlchemy metadata object."""
from datetime import datetime
from sqlalchemy import ForeignKey, Integer, BigInteger, String, Boolean, DateTime, CheckConstraint, UniqueConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, now


class Favorite(Base):
    __tablename__='favorites'
    __table_args__ = (UniqueConstraint('user_id','tour_id',name='uq_favorite'),)
    id: Mapped[str] = mapped_column(String(36),primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True)
    tour_id: Mapped[str] = mapped_column(ForeignKey('tours.id',ondelete='CASCADE'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
