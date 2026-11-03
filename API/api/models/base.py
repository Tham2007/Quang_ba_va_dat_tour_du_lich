"""Delta Travel persistence. Amounts are integer VND, UTC timestamps only."""

import os
from datetime import datetime, timezone
from sqlalchemy import (
    create_engine,
    ForeignKey,
    Integer,
    BigInteger,
    String,
    Boolean,
    DateTime,
    CheckConstraint,
    UniqueConstraint,
    Text,
    event,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
    sessionmaker,
)


def now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


def make_engine(url=None):
    url = url or os.getenv("DATABASE_URL", "sqlite:///./delta_dev.db")
    # The legacy ORM uses a different schema than Tham's 12-table SQL Server.
    # Refuse accidental table creation on her SQL Server; use the separate
    # api.tham_sqlserver_app read-only bridge with THAM_SQLSERVER_URL instead.
    if url.startswith(("mssql:", "mssql+")):
        raise RuntimeError(
            "Legacy ORM cannot use Tham SQL Server. "
            "Run api.tham_sqlserver_app with THAM_SQLSERVER_URL."
        )
    # Render provides postgresql:// URLs; use psycopg v3 consistently.
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://") :]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    is_sqlite = url.startswith("sqlite")
    eng = create_engine(
        url,
        connect_args={"check_same_thread": False, "timeout": 30} if is_sqlite else {},
        pool_pre_ping=True,
    )
    if is_sqlite:

        @event.listens_for(eng, "connect")
        def pragmas(conn, _):
            cur = conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA busy_timeout=30000")
            cur.execute("PRAGMA journal_mode=WAL")
            cur.close()

    if is_sqlite:

        @event.listens_for(eng, "begin")
        def sqlite_begin(connection):
            # Development-only serialized transactions. PostgreSQL uses row locks.
            connection.exec_driver_sql("BEGIN IMMEDIATE")

    return eng


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def lock_writes(db):
    """SQLite serializes reads+writes early; PG uses per-row FOR UPDATE below."""
    # BEGIN IMMEDIATE is installed as the SQLite engine's begin event.
    # Explicit BEGIN inside a nested savepoint would raise an OperationalError.
    return None
