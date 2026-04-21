from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Literal

from pydantic import BaseModel, Field


WorkflowStage = Literal["Idea", "Brief", "Production", "Review", "Publish"]
MilestoneStatus = Literal["open", "in_progress", "completed", "blocked"]


class WorkflowItem(BaseModel):
    item_id: str
    title: str
    description: str = ""
    owner: str | None = None
    linked_trend: str | None = None
    stage: WorkflowStage = "Idea"
    due_date: date | None = None
    comments: list[str] = Field(default_factory=list)
    links: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Milestone(BaseModel):
    milestone_id: str
    item_id: str
    title: str
    owner: str | None = None
    due_date: date | None = None
    criteria: list[str] = Field(default_factory=list)
    status: MilestoneStatus = "open"
    notes: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
