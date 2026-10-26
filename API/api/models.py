"""Delta Travel persistence. Amounts are integer VND, UTC timestamps only."""
import os
from datetime import datetime, timezone
from sqlalchemy import (create_engine, ForeignKey, Integer, BigInteger, String, Boolean, DateTime, CheckConstraint,
                        UniqueConstraint, Text, event)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


def now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = 'users'
    __table_args__ = (CheckConstraint("role IN ('CUSTOMER', 'ADMIN')",name='ck_user_role'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(16), default='CUSTOMER')
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class SessionToken(Base):
    __tablename__ = 'sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Tour(Base):
    __tablename__ = 'tours'
    __table_args__ = (CheckConstraint('price > 0 AND original_price > 0',name='ck_positive_prices'),)
    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    slug: Mapped[str] = mapped_column(String(150), unique=True)
    title: Mapped[str] = mapped_column(String(255))
    region: Mapped[str] = mapped_column(String(20))
    duration: Mapped[str] = mapped_column(String(30))
    departure: Mapped[str] = mapped_column(String(255))
    transport: Mapped[str] = mapped_column(String(255))
    image: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default='')
    itinerary_json: Mapped[str] = mapped_column(Text, default='[]')
    price: Mapped[int] = mapped_column(BigInteger)
    original_price: Mapped[int] = mapped_column(BigInteger)
    flash_sale: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


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


class Booking(Base):
    __tablename__ = 'bookings'
    __table_args__ = (UniqueConstraint('user_id', 'idempotency_key', name='uq_user_booking_key'),
                      CheckConstraint("status IN ('PENDING_PAYMENT','PAID','CONFIRMED','COMPLETED','CANCELLED','EXPIRED')",name='ck_booking_status'),
                      CheckConstraint('adults >= 1 AND children >= 0 AND infants >= 0 AND seats_held >= 1 AND total_price >= 0',name='ck_booking_counts'))
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    reference: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='RESTRICT'), index=True)
    schedule_id: Mapped[str] = mapped_column(ForeignKey('schedules.id', ondelete='RESTRICT'))
    idempotency_key: Mapped[str] = mapped_column(String(36))
    payload_fingerprint: Mapped[str] = mapped_column(String(64))
    tour_title: Mapped[str] = mapped_column(String(255))
    customer_name: Mapped[str] = mapped_column(String(120))
    customer_phone: Mapped[str] = mapped_column(String(20))
    customer_email: Mapped[str] = mapped_column(String(254))
    note: Mapped[str] = mapped_column(String(500), default='')
    adults: Mapped[int] = mapped_column(Integer)
    children: Mapped[int] = mapped_column(Integer)
    infants: Mapped[int] = mapped_column(Integer)
    seats_held: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[int] = mapped_column(BigInteger)
    total_price: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(24), default='PENDING_PAYMENT')
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    payment_evidence: Mapped[str | None] = mapped_column(String(250), nullable=True)
    payment_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Favorite(Base):
    __tablename__='favorites'
    __table_args__ = (UniqueConstraint('user_id','tour_id',name='uq_favorite'),)
    id: Mapped[str] = mapped_column(String(36),primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True)
    tour_id: Mapped[str] = mapped_column(ForeignKey('tours.id',ondelete='CASCADE'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Audit(Base):
    __tablename__ = 'audit_events'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    actor_id: Mapped[str] = mapped_column(String(36), index=True)
    event_type: Mapped[str] = mapped_column(String(60))
    subject_id: Mapped[str] = mapped_column(String(36))
    details: Mapped[str] = mapped_column(Text, default='{}')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


def make_engine(url=None):
    url = url or os.getenv('DATABASE_URL', 'sqlite:///./delta_dev.db')
    # The legacy ORM uses a different schema than Tham's 12-table SQL Server.
    # Refuse accidental table creation on her SQL Server; use the separate
    # api.tham_sqlserver_app read-only bridge with THAM_SQLSERVER_URL instead.
    if url.startswith(('mssql:', 'mssql+')):
        raise RuntimeError(
            'Legacy ORM cannot use Tham SQL Server. '
            'Run api.tham_sqlserver_app with THAM_SQLSERVER_URL.'
        )
    is_sqlite = url.startswith('sqlite')
    eng = create_engine(url, connect_args={'check_same_thread': False, 'timeout': 30} if is_sqlite else {},
                        pool_pre_ping=True)
    if is_sqlite:
        @event.listens_for(eng, 'connect')
        def pragmas(conn, _):
            cur = conn.cursor()
            cur.execute('PRAGMA foreign_keys=ON')
            cur.execute('PRAGMA busy_timeout=30000')
            cur.execute('PRAGMA journal_mode=WAL')
            cur.close()
    if is_sqlite:
        @event.listens_for(eng, 'begin')
        def sqlite_begin(connection):
            # Development-only serialized transactions. PostgreSQL uses row locks.
            connection.exec_driver_sql('BEGIN IMMEDIATE')
    return eng


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def lock_writes(db):
    """SQLite serializes reads+writes early; PG uses per-row FOR UPDATE below."""
    # BEGIN IMMEDIATE is installed as the SQLite engine's begin event.
    # Explicit BEGIN inside a nested savepoint would raise an OperationalError.
    return None
