from __future__ import annotations

import os
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import delete, select

from backend.app.models.workflow import Milestone, WorkflowItem
from backend.app.persistence.db import session_scope
from backend.app.persistence.models import FileAsset, MilestoneRow, WorkflowActivityRow, WorkflowItemRow


def upload_root() -> Path:
    root = Path(os.environ.get("UPLOAD_ROOT", "uploads"))
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_workflow_item(item: WorkflowItem) -> WorkflowItem:
    payload = item.model_dump(mode="json")
    with session_scope() as session:
        session.merge(WorkflowItemRow(item_id=item.item_id, payload=payload))
    return item


def get_workflow_item(item_id: str) -> WorkflowItem | None:
    with session_scope() as session:
        row = session.get(WorkflowItemRow, item_id)
        if not row:
            return None
        return WorkflowItem(**row.payload)


def list_workflow_items() -> list[WorkflowItem]:
    with session_scope() as session:
        rows = session.scalars(select(WorkflowItemRow)).all()
        return [WorkflowItem(**row.payload) for row in rows]


def delete_workflow_item(item_id: str) -> WorkflowItem | None:
    existing = get_workflow_item(item_id)
    if not existing:
        return None
    with session_scope() as session:
        session.execute(delete(WorkflowItemRow).where(WorkflowItemRow.item_id == item_id))
    delete_milestones_for_item(item_id)
    return existing


def save_milestone(milestone: Milestone) -> Milestone:
    payload = milestone.model_dump(mode="json")
    with session_scope() as session:
        session.merge(MilestoneRow(milestone_id=milestone.milestone_id, payload=payload))
    return milestone


def get_milestone(milestone_id: str) -> Milestone | None:
    with session_scope() as session:
        row = session.get(MilestoneRow, milestone_id)
        if not row:
            return None
        return Milestone(**row.payload)


def list_milestones_for_item(item_id: str) -> list[str]:
    with session_scope() as session:
        rows = session.scalars(select(MilestoneRow)).all()
        return [row.milestone_id for row in rows if row.payload.get("item_id") == item_id]


def delete_milestones_for_item(item_id: str) -> None:
    with session_scope() as session:
        rows = session.scalars(select(MilestoneRow)).all()
        for row in rows:
            if row.payload.get("item_id") == item_id:
                session.delete(row)


def prepend_activity(log: dict) -> None:
    with session_scope() as session:
        session.add(
            WorkflowActivityRow(
                log_id=log["log_id"],
                payload=log,
                created_at=datetime.fromisoformat(log["created_at"])
                if isinstance(log.get("created_at"), str)
                else log.get("created_at") or datetime.now(UTC),
            )
        )


def list_activity_logs() -> list[dict]:
    with session_scope() as session:
        rows = session.scalars(
            select(WorkflowActivityRow).order_by(WorkflowActivityRow.created_at.desc())
        ).all()
        return [row.payload for row in rows]


def register_file_asset(
    asset_id: str,
    *,
    owner_id: str | None,
    path: str,
    mime: str | None,
    size: int,
) -> None:
    with session_scope() as session:
        session.add(
            FileAsset(
                asset_id=asset_id,
                owner_id=owner_id,
                path=path,
                mime=mime,
                size=size,
                created_at=datetime.now(UTC),
            )
        )
