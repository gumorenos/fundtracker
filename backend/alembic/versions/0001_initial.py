"""initial schema

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(256), nullable=False),
        sa.Column("role", sa.String(16), nullable=False, server_default="viewer"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "fund_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "initial_balance_usd",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="30000",
        ),
        sa.Column(
            "current_balance_usd",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="30000",
        ),
        sa.Column(
            "start_date",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("color", sa.String(7), nullable=False, server_default="#94a3b8"),
        sa.Column("is_default", sa.Boolean(), server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("amount_usd", sa.Numeric(14, 2), nullable=False),
        sa.Column("amount_pen", sa.Numeric(14, 2), nullable=True),
        sa.Column("exchange_rate", sa.Numeric(10, 4), nullable=True),
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey("categories.id"),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "transaction_date",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "projection_params",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "adjustment_percentage",
            sa.Numeric(8, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("transactions")
    op.drop_table("projection_params")
    op.drop_table("categories")
    op.drop_table("fund_config")
    op.drop_table("users")
