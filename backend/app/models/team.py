from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Literal

from pydantic import BaseModel, Field


TaskStatus = Literal["todo", "in_progress", "blocked", "done"]
TaskPriority = Literal["low", "medium", "high"]
SourceType = Literal["chat", "meeting"]


class TeamSummary(BaseModel):
    summary_id: str
    source_type: SourceType
    title: str | None = None
    summary: str
    action_items_preview: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Task(BaseModel):
    task_id: str
    title: str
    description: str = ""
    owner: str | None = None
    due_date: date | None = None
    priority: TaskPriority = "medium"
    status: TaskStatus = "todo"
    notes: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Reminder(BaseModel):
    task_id: str
    owner: str | None = None
    due_date: date | None = None
    severity: Literal["overdue", "due_soon"]
    message: str
