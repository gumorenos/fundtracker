"""funds + pen_wallet + transaction types

Revision ID: 0002
Revises: 0001
Create Date: 2024-01-02 00:00:00.000000

Replaces fund_config with two funds (Emergencia / Personal),
adds pen_wallet, and adds type + fund_id columns to transactions.
Existing transactions are migrated: those with exchange_rate → currency_exchange,
the rest → usd_expense. All are assigned to the Emergencia fund.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Create funds table ─────────────────────────────────────────────────
    op.create_table(
        "funds",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("initial_balance_usd", sa.Numeric(10, 2), nullable=False),
        sa.Column("current_balance_usd", sa.Numeric(10, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── Migrate fund_config data into two funds ────────────────────────────
    # If fund_config has a row, split it 50/50; otherwise use 15000 defaults.
    op.execute("""
        INSERT INTO funds (name, initial_balance_usd, current_balance_usd, created_at, updated_at)
        SELECT
            'Emergencia',
            COALESCE((SELECT initial_balance_usd / 2 FROM fund_config LIMIT 1), 15000),
            COALESCE((SELECT current_balance_usd  / 2 FROM fund_config LIMIT 1), 15000),
            NOW(), NOW()
    """)
    op.execute("""
        INSERT INTO funds (name, initial_balance_usd, current_balance_usd, created_at, updated_at)
        SELECT
            'Personal',
            COALESCE((SELECT initial_balance_usd / 2 FROM fund_config LIMIT 1), 15000),
            COALESCE((SELECT current_balance_usd  / 2 FROM fund_config LIMIT 1), 15000),
            NOW(), NOW()
    """)

    # ── Create pen_wallet table ────────────────────────────────────────────
    op.create_table(
        "pen_wallet",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("balance_pen", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.execute("INSERT INTO pen_wallet (balance_pen, updated_at) VALUES (0, NOW())")

    # ── Modify transactions ────────────────────────────────────────────────
    # Make amount_usd and category_id nullable (expense type has no amount_usd)
    op.alter_column("transactions", "amount_usd", nullable=True)
    op.alter_column("transactions", "category_id", nullable=True)

    # Add type column (default expense for safety; we'll update below)
    op.add_column(
        "transactions",
        sa.Column("type", sa.String(32), nullable=False, server_default="usd_expense"),
    )

    # Add fund_id FK
    op.add_column(
        "transactions",
        sa.Column("fund_id", sa.Integer(), sa.ForeignKey("funds.id"), nullable=True),
    )

    # Migrate existing transaction types based on presence of exchange_rate
    op.execute("""
        UPDATE transactions
        SET type = 'currency_exchange'
        WHERE exchange_rate IS NOT NULL
    """)
    # Remaining rows keep 'usd_expense' from server_default

    # Assign all existing transactions to the Emergencia fund
    op.execute("""
        UPDATE transactions
        SET fund_id = (SELECT id FROM funds WHERE name = 'Emergencia' LIMIT 1)
        WHERE fund_id IS NULL
    """)

    # ── Drop old fund_config ───────────────────────────────────────────────
    op.drop_table("fund_config")


def downgrade() -> None:
    op.create_table(
        "fund_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("initial_balance_usd", sa.Numeric(14, 2), nullable=False, server_default="30000"),
        sa.Column("current_balance_usd", sa.Numeric(14, 2), nullable=False, server_default="30000"),
        sa.Column("start_date", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.execute("""
        INSERT INTO fund_config (initial_balance_usd, current_balance_usd, start_date, updated_at)
        SELECT
            COALESCE((SELECT SUM(initial_balance_usd) FROM funds), 30000),
            COALESCE((SELECT SUM(current_balance_usd) FROM funds), 30000),
            NOW(), NOW()
    """)

    op.drop_column("transactions", "fund_id")
    op.drop_column("transactions", "type")
    op.alter_column("transactions", "amount_usd", nullable=False)
    op.alter_column("transactions", "category_id", nullable=False)
    op.drop_table("pen_wallet")
    op.drop_table("funds")
