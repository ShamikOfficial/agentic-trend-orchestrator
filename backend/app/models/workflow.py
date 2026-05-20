from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Literal

from pydantic import BaseModel, Field


WorkflowStage = Literal["Idea", "Brief", "Production", "Review", "Publish"]
VALID_WORKFLOW_STAGES: set[str] = {"Idea", "Brief", "Production", "Review", "Publish"}
MilestoneStatus = Literal["open", "in_progress", "completed", "blocked"]


class WorkflowItem(BaseModel):
    item_id: str
    title: str
    description: str = ""
    owner: str | None = None
    linked_trend: str | None = None
    source_chat_key: str | None = None
    source_message_batch_index: int | None = None
    source_message_ids: list[str] = Field(default_factory=list)
    source_first_message_id: str | None = None
    source_last_message_id: str | None = None
    project: str = "General"
    stage: WorkflowStage = "Idea"
    due_date: date | None = None
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    comments: list[str] = Field(default_factory=list)
    links: list[str] = Field(default_factory=list)
    attachments: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Milestone(BaseModel):
    milestone_id: str
    item_id: str
    title: str
    owner: str | None = None
    due_date: date | None = None
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    criteria: list[str] = Field(default_factory=list)
    status: MilestoneStatus = "open"
    notes: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
