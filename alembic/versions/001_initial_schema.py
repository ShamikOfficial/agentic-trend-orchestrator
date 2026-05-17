"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-16

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("user_id", sa.String(64), primary_key=True),
        sa.Column("email", sa.String(320), nullable=True, unique=True),
        sa.Column("username", sa.String(128), nullable=False, unique=True),
        sa.Column("display_name", sa.String(256), nullable=False),
        sa.Column("password_hash", sa.String(256), nullable=True),
        sa.Column("oauth_provider", sa.String(32), nullable=True),
        sa.Column("oauth_subject", sa.String(256), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("oauth_provider", "oauth_subject", name="uq_users_oauth"),
    )
    op.create_index("ix_users_username", "users", ["username"])

    op.create_table(
        "sessions",
        sa.Column("token", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])

    op.create_table(
        "dm_messages",
        sa.Column("message_id", sa.String(64), primary_key=True),
        sa.Column("user_a", sa.String(64), nullable=False),
        sa.Column("user_b", sa.String(64), nullable=False),
        sa.Column("sender_id", sa.String(64), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_dm_thread", "dm_messages", ["user_a", "user_b", "created_at"])

    op.create_table("groups", sa.Column("group_id", sa.String(64), primary_key=True), sa.Column("name", sa.String(256), nullable=False), sa.Column("description", sa.Text(), nullable=False), sa.Column("created_by", sa.String(64), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("group_members", sa.Column("group_id", sa.String(64), sa.ForeignKey("groups.group_id"), primary_key=True), sa.Column("user_id", sa.String(64), primary_key=True))
    op.create_table("group_join_requests", sa.Column("group_id", sa.String(64), sa.ForeignKey("groups.group_id"), primary_key=True), sa.Column("user_id", sa.String(64), primary_key=True))
    op.create_table("group_messages", sa.Column("message_id", sa.String(64), primary_key=True), sa.Column("group_id", sa.String(64), sa.ForeignKey("groups.group_id"), nullable=False), sa.Column("sender_id", sa.String(64), nullable=False), sa.Column("content", sa.Text(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_group_messages_group_id", "group_messages", ["group_id"])

    op.create_table("chat_analysis_state", sa.Column("chat_key", sa.String(256), primary_key=True), sa.Column("last_message_id", sa.String(64), nullable=True))

    op.create_table("workflow_items", sa.Column("item_id", sa.String(64), primary_key=True), sa.Column("payload", sa.JSON(), nullable=False))
    op.create_table("milestones", sa.Column("milestone_id", sa.String(64), primary_key=True), sa.Column("payload", sa.JSON(), nullable=False))
    op.create_table("workflow_activity_logs", sa.Column("log_id", sa.String(64), primary_key=True), sa.Column("payload", sa.JSON(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_workflow_activity_created", "workflow_activity_logs", ["created_at"])

    op.create_table("file_assets", sa.Column("asset_id", sa.String(64), primary_key=True), sa.Column("owner_id", sa.String(64), nullable=True), sa.Column("path", sa.String(512), nullable=False), sa.Column("mime", sa.String(128), nullable=True), sa.Column("size", sa.Integer(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))

    op.create_table("team_summaries", sa.Column("summary_id", sa.String(64), primary_key=True), sa.Column("payload", sa.JSON(), nullable=False))
    op.create_table("team_tasks", sa.Column("task_id", sa.String(64), primary_key=True), sa.Column("payload", sa.JSON(), nullable=False))
    op.create_table("team_note_logs", sa.Column("note_id", sa.String(64), primary_key=True), sa.Column("payload", sa.JSON(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))

    op.create_table(
        "llm_usage_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.String(64), nullable=False),
        sa.Column("feature", sa.String(64), nullable=False),
        sa.Column("model", sa.String(128), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("total_tokens", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_llm_usage_user_id", "llm_usage_events", ["user_id"])

    op.create_table(
        "user_llm_quota",
        sa.Column("user_id", sa.String(64), primary_key=True),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("token_budget", sa.BigInteger(), nullable=False),
        sa.Column("tokens_used", sa.BigInteger(), nullable=False),
        sa.Column("max_requests_per_day", sa.Integer(), nullable=False),
        sa.Column("requests_today", sa.Integer(), nullable=False),
        sa.Column("requests_day", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    for table in (
        "user_llm_quota",
        "llm_usage_events",
        "team_note_logs",
        "team_tasks",
        "team_summaries",
        "file_assets",
        "workflow_activity_logs",
        "milestones",
        "workflow_items",
        "chat_analysis_state",
        "group_messages",
        "group_join_requests",
        "group_members",
        "groups",
        "dm_messages",
        "sessions",
        "users",
    ):
        op.drop_table(table)
