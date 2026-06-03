"""platform_links: link users to Telegram/WhatsApp chat IDs

Revision ID: 0005
Revises: 0004
Create Date: 2024-01-05 00:00:00.000000

- Creates platform_links table
- Migrates existing admin Telegram link (chat_id 59414146)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "platform_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("platform", sa.String(16), nullable=False),
        sa.Column("platform_chat_id", sa.String(128), nullable=False),
        sa.Column("last_token_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("platform", "platform_chat_id", name="uq_platform_chat_id"),
    )

    # Migrate existing admin Telegram link
    op.execute("""
        INSERT INTO platform_links (user_id, platform, platform_chat_id, created_at)
        SELECT id, 'telegram', '59414146', NOW()
        FROM users
        WHERE role = 'admin'
        ORDER BY id
        LIMIT 1
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table("platform_links")
