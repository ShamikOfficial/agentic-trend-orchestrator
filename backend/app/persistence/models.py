from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import JSON


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str | None] = mapped_column(String(320), unique=True, nullable=True)
    username: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(256))
    password_hash: Mapped[str | None] = mapped_column(String(256), nullable=True)
    oauth_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    oauth_subject: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("oauth_provider", "oauth_subject", name="uq_users_oauth"),
    )


class SessionToken(Base):
    __tablename__ = "sessions"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.user_id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class DmMessage(Base):
    __tablename__ = "dm_messages"

    message_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_a: Mapped[str] = mapped_column(String(64), index=True)
    user_b: Mapped[str] = mapped_column(String(64), index=True)
    sender_id: Mapped[str] = mapped_column(String(64))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (Index("ix_dm_thread", "user_a", "user_b", "created_at"),)


class Group(Base):
    __tablename__ = "groups"

    group_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(256))
    description: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class GroupMember(Base):
    __tablename__ = "group_members"

    group_id: Mapped[str] = mapped_column(String(64), ForeignKey("groups.group_id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)


class GroupJoinRequest(Base):
    __tablename__ = "group_join_requests"

    group_id: Mapped[str] = mapped_column(String(64), ForeignKey("groups.group_id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)


class GroupMessage(Base):
    __tablename__ = "group_messages"

    message_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    group_id: Mapped[str] = mapped_column(String(64), ForeignKey("groups.group_id"), index=True)
    sender_id: Mapped[str] = mapped_column(String(64))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ChatAnalysisState(Base):
    __tablename__ = "chat_analysis_state"

    chat_key: Mapped[str] = mapped_column(String(256), primary_key=True)
    last_message_id: Mapped[str | None] = mapped_column(String(64), nullable=True)


class WorkflowItemRow(Base):
    __tablename__ = "workflow_items"

    item_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)


class MilestoneRow(Base):
    __tablename__ = "milestones"

    milestone_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)


class WorkflowActivityRow(Base):
    __tablename__ = "workflow_activity_logs"

    log_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class FileAsset(Base):
    __tablename__ = "file_assets"

    asset_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    path: Mapped[str] = mapped_column(String(512))
    mime: Mapped[str | None] = mapped_column(String(128), nullable=True)
    size: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TeamSummaryRow(Base):
    __tablename__ = "team_summaries"

    summary_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)


class TeamTaskRow(Base):
    __tablename__ = "team_tasks"

    task_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)


class TeamNoteLogRow(Base):
    __tablename__ = "team_note_logs"

    note_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class LlmUsageEvent(Base):
    __tablename__ = "llm_usage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    feature: Mapped[str] = mapped_column(String(64))
    model: Mapped[str] = mapped_column(String(128))
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class UserLlmQuota(Base):
    __tablename__ = "user_llm_quota"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    period_start: Mapped[date] = mapped_column(Date)
    token_budget: Mapped[int] = mapped_column(BigInteger)
    tokens_used: Mapped[int] = mapped_column(BigInteger, default=0)
    max_requests_per_day: Mapped[int] = mapped_column(Integer, default=50)
    requests_today: Mapped[int] = mapped_column(Integer, default=0)
    requests_day: Mapped[date | None] = mapped_column(Date, nullable=True)
