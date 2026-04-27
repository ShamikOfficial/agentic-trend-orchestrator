"""Core workflow and milestones logic with no API coupling."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from backend.app.models.workflow import Milestone, WorkflowItem, WorkflowStage

STAGES: list[WorkflowStage] = ["Idea", "Brief", "Production", "Review", "Publish"]


def _make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def can_transition(from_stage: WorkflowStage, to_stage: WorkflowStage) -> bool:
    # Dashboard drag-and-drop supports direct moves across any stage.
    return from_stage != to_stage


def create_workflow_item(
    title: str,
    description: str = "",
    owner: str | None = None,
    linked_trend: str | None = None,
    project: str = "General",
    stage: WorkflowStage = "Idea",
    due_date: date | None = None,
    comments: list[str] | None = None,
    links: list[str] | None = None,
    attachments: list[str] | None = None,
) -> WorkflowItem:
    return WorkflowItem(
        item_id=_make_id("wf"),
        title=title,
        description=description,
        owner=owner,
        linked_trend=linked_trend,
        project=project,
        stage=stage,
        due_date=due_date,
        comments=comments or [],
        links=links or [],
        attachments=attachments or [],
    )


def move_stage(item: WorkflowItem, to_stage: WorkflowStage, note: str | None = None) -> WorkflowItem:
    if not can_transition(item.stage, to_stage):
        raise ValueError(f"Invalid transition: {item.stage} -> {to_stage}")

    data = item.model_dump()
    data["stage"] = to_stage
    data["updated_at"] = datetime.now(UTC)
    if note:
        data["description"] = f"{data['description']}\nTransition note: {note}".strip()
    return WorkflowItem(**data)


def create_milestone(
    item_id: str,
    title: str,
    owner: str | None = None,
    due_date=None,
    criteria: list[str] | None = None,
) -> Milestone:
    return Milestone(
        milestone_id=_make_id("ms"),
        item_id=item_id,
        title=title,
        owner=owner,
        due_date=due_date,
        criteria=criteria or [],
        status="open",
    )


def update_milestone(milestone: Milestone, **changes: object) -> Milestone:
    data = milestone.model_dump()
    for key, value in changes.items():
        if key in data and value is not None:
            data[key] = value
    data["updated_at"] = datetime.now(UTC)
    return Milestone(**data)
