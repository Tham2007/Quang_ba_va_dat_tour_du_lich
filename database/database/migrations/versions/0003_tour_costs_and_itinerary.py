"""Add private tour cost lines and structured itinerary activities.

Revision ID: 0003_tour_costs_and_itinerary
Revises: 0002_payment_evidence_unique
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_tour_costs_and_itinerary"
down_revision = "0002_payment_evidence_unique"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tour_cost_items",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tour_id", sa.String(length=30), nullable=False),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("amount_per_person", sa.BigInteger(), nullable=False),
        sa.CheckConstraint(
            "amount_per_person >= 0", name="ck_tour_cost_nonnegative"
        ),
        sa.ForeignKeyConstraint(["tour_id"], ["tours.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tour_cost_items_tour_id", "tour_cost_items", ["tour_id"])
    op.create_table(
        "itinerary_items",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tour_id", sa.String(length=30), nullable=False),
        sa.Column("day_number", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=180), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.CheckConstraint("day_number > 0", name="ck_itinerary_day_positive"),
        sa.CheckConstraint("sequence > 0", name="ck_itinerary_sequence_positive"),
        sa.ForeignKeyConstraint(["tour_id"], ["tours.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tour_id", "day_number", "sequence",
            name="uq_itinerary_tour_day_sequence",
        ),
    )
    op.create_index("ix_itinerary_items_tour_id", "itinerary_items", ["tour_id"])


def downgrade() -> None:
    op.drop_index("ix_itinerary_items_tour_id", table_name="itinerary_items")
    op.drop_table("itinerary_items")
    op.drop_index("ix_tour_cost_items_tour_id", table_name="tour_cost_items")
    op.drop_table("tour_cost_items")
