"""Narrow additive schema upgrades for the local SQLite demo."""

from sqlalchemy import inspect
from sqlalchemy.engine import Engine


def migrate_booking_identity(db_engine: Engine):
    if db_engine.dialect.name != "sqlite":
        return
    inspector = inspect(db_engine)
    if not inspector.has_table("bookings"):
        return
    columns = {column["name"] for column in inspector.get_columns("bookings")}
    if "customer_identity" not in columns:
        with db_engine.begin() as connection:
            connection.exec_driver_sql(
                "ALTER TABLE bookings ADD COLUMN customer_identity VARCHAR(12)"
            )
