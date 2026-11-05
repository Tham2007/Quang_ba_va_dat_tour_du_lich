"""Store the required booking identity number.

Revision ID: 0004_booking_customer_identity
Revises: 0003_tour_costs_and_itinerary
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_booking_customer_identity"
down_revision = "0003_tour_costs_and_itinerary"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "bookings",
        sa.Column("customer_identity", sa.String(length=12), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("bookings", "customer_identity")
