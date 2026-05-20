"""Add chat_task_analysis_batches for sectioned task extraction."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "002_chat_task_batches"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_task_analysis_batches",
        sa.Column("chat_key", sa.String(256), primary_key=True),
        sa.Column("batch_index", sa.Integer(), primary_key=True),
        sa.Column("first_message_id", sa.String(64), nullable=False),
        sa.Column("last_message_id", sa.String(64), nullable=False),
        sa.Column("message_ids", sa.JSON(), nullable=False),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("chat_task_analysis_batches")
