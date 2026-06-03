"""funds redesign: drop pen_wallet, add balance_pen/currency_mode, per-fund projections

Revision ID: 0004
Revises: 0003
Create Date: 2024-01-04 00:00:00.000000

Changes:
- Rename funds.current_balance_usd → balance_usd
- Add funds.balance_pen, initial_balance_pen, currency_mode
- Migrate pen_wallet.balance_pen → Emergencia fund's balance_pen
- Drop pen_wallet table
- Add projection_params.fund_id, adjustment_amount_pen
- Create per-fund projection_params entries for existing funds
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Rename current_balance_usd → balance_usd ──────────────────────────
    op.alter_column("funds", "current_balance_usd", new_column_name="balance_usd")

    # ── Add new columns to funds ──────────────────────────────────────────
    op.add_column("funds", sa.Column("balance_pen", sa.Numeric(10, 2), nullable=False, server_default="0"))
    op.add_column("funds", sa.Column("initial_balance_pen", sa.Numeric(10, 2), nullable=False, server_default="0"))
    op.add_column("funds", sa.Column("currency_mode", sa.String(16), nullable=False, server_default="both"))

    # ── Migrate pen_wallet balance to Emergencia fund ────────────────────
    # On existing deployments: copy PEN balance to the Emergencia fund per user
    op.execute("""
        UPDATE funds f
        SET balance_pen = COALESCE(
            (SELECT pw.balance_pen FROM pen_wallet pw
             WHERE pw.user_id = f.user_id LIMIT 1),
            0
        )
        WHERE f.name = 'Emergencia'
    """)

    # ── Drop pen_wallet ───────────────────────────────────────────────────
    # Safe: table might not exist on fresh install (was created in 0003 only
    # if migrating from 0002 which had pen_wallet).
    # Use a safe drop.
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT FROM information_schema.tables
                       WHERE table_name = 'pen_wallet') THEN
                DROP TABLE pen_wallet;
            END IF;
        END$$
    """)

    # ── Add fund_id and adjustment_amount_pen to projection_params ────────
    op.add_column(
        "projection_params",
        sa.Column("fund_id", sa.Integer(), sa.ForeignKey("funds.id"), nullable=True),
    )
    op.add_column(
        "projection_params",
        sa.Column("adjustment_amount_pen", sa.Numeric(10, 2), nullable=True),
    )

    # Existing projection_params rows are global (fund_id stays null)

    # ── Create per-fund projection_params for each existing fund ──────────
    op.execute("""
        INSERT INTO projection_params (user_id, fund_id, adjustment_percentage, updated_at)
        SELECT f.user_id, f.id, 0, NOW()
        FROM funds f
        WHERE NOT EXISTS (
            SELECT 1 FROM projection_params pp
            WHERE pp.fund_id = f.id
        )
    """)


def downgrade() -> None:
    # Remove per-fund projection_params
    op.execute("DELETE FROM projection_params WHERE fund_id IS NOT NULL")
    op.drop_column("projection_params", "adjustment_amount_pen")
    op.drop_column("projection_params", "fund_id")

    # Recreate pen_wallet from Emergencia fund's balance_pen
    op.create_table(
        "pen_wallet",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("balance_pen", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.execute("""
        INSERT INTO pen_wallet (user_id, balance_pen, updated_at)
        SELECT f.user_id, f.balance_pen, NOW()
        FROM funds f
        WHERE f.name = 'Emergencia'
    """)

    op.drop_column("funds", "currency_mode")
    op.drop_column("funds", "initial_balance_pen")
    op.drop_column("funds", "balance_pen")
    op.alter_column("funds", "balance_usd", new_column_name="current_balance_usd")
