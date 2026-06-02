"""multi-user, alerts, exchange rate history, transaction notes/tags

Revision ID: 0003
Revises: 0002
Create Date: 2024-01-03 00:00:00.000000

- Adds is_active, read_only_mode, invited_by_id to users
- Creates invitations table
- Adds user_id FK to: funds, pen_wallet, transactions, categories, projection_params
- Assigns existing rows to the admin user (role='admin')
- Creates alerts table
- Creates exchange_rate_history table
- Adds notes, tags columns to transactions
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Extend users ──────────────────────────────────────────────────────
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users", sa.Column("read_only_mode", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("invited_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))

    # ── Invitations table ─────────────────────────────────────────────────
    op.create_table(
        "invitations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(36), nullable=False, unique=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("used_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── Add user_id (nullable) to tenant tables ───────────────────────────
    for table in ("funds", "pen_wallet", "transactions", "categories", "projection_params"):
        op.add_column(
            table,
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        )

    # ── Assign existing data to the admin user ────────────────────────────
    for table in ("funds", "pen_wallet", "transactions", "categories", "projection_params"):
        op.execute(f"""
            UPDATE {table}
            SET user_id = (
                SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1
            )
            WHERE user_id IS NULL
              AND (SELECT COUNT(*) FROM users WHERE role = 'admin') > 0
        """)

    # ── Make user_id NOT NULL ─────────────────────────────────────────────
    # Safe: on fresh install tables are empty; on existing deploy rows are updated above.
    for table in ("funds", "pen_wallet", "transactions", "categories", "projection_params"):
        op.alter_column(table, "user_id", nullable=False)

    # ── Notes and tags on transactions ────────────────────────────────────
    op.add_column("transactions", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column("transactions", sa.Column("tags", sa.JSON(), nullable=True))

    # ── Alerts table ──────────────────────────────────────────────────────
    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("threshold", sa.Numeric(14, 2), nullable=False),
        sa.Column("period", sa.String(16), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_triggered", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── Exchange rate history table ───────────────────────────────────────
    op.create_table(
        "exchange_rate_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("rate", sa.Numeric(10, 4), nullable=False),
        sa.Column("date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── Backfill exchange_rate_history from existing currency_exchange txs ─
    op.execute("""
        INSERT INTO exchange_rate_history (user_id, rate, date, source, created_at)
        SELECT user_id, exchange_rate, transaction_date, 'migration', NOW()
        FROM transactions
        WHERE type = 'currency_exchange' AND exchange_rate IS NOT NULL
    """)


def downgrade() -> None:
    op.drop_table("exchange_rate_history")
    op.drop_table("alerts")
    op.drop_column("transactions", "tags")
    op.drop_column("transactions", "notes")
    for table in ("funds", "pen_wallet", "transactions", "categories", "projection_params"):
        op.drop_column(table, "user_id")
    op.drop_table("invitations")
    op.drop_column("users", "invited_by_id")
    op.drop_column("users", "read_only_mode")
    op.drop_column("users", "is_active")
