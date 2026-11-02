"""Prevent two bookings from using the same verified payment reference.

Revision ID: 0002_payment_evidence_unique
Revises: 0001_initial

This migration is non-destructive, but existing duplicate non-null references
must be remediated under review before running against any existing database.
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_payment_evidence_unique"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_booking_payment_evidence", "bookings", ["payment_evidence"]
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_booking_payment_evidence", "bookings", type_="unique"
    )
