from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select

from backend.app.models.team import Task
from backend.app.persistence.db import session_scope
from backend.app.persistence.models import TeamNoteLogRow, TeamSummaryRow, TeamTaskRow


def save_summary(summary: dict) -> None:
    with session_scope() as session:
        session.merge(TeamSummaryRow(summary_id=summary["summary_id"], payload=summary))


def get_summary(summary_id: str) -> dict | None:
    with session_scope() as session:
        row = session.get(TeamSummaryRow, summary_id)
        return row.payload if row else None


def save_task(task: Task) -> None:
    payload = task.model_dump(mode="json")
    with session_scope() as session:
        session.merge(TeamTaskRow(task_id=task.task_id, payload=payload))


def list_tasks() -> list[Task]:
    with session_scope() as session:
        rows = session.scalars(select(TeamTaskRow)).all()
        return [Task(**row.payload) for row in rows]


def get_task(task_id: str) -> Task | None:
    with session_scope() as session:
        row = session.get(TeamTaskRow, task_id)
        if not row:
            return None
        return Task(**row.payload)


def prepend_note_log(note: dict) -> None:
    with session_scope() as session:
        session.add(
            TeamNoteLogRow(
                note_id=note["note_id"],
                payload=note,
                created_at=datetime.fromisoformat(note["created_at"])
                if isinstance(note.get("created_at"), str)
                else note.get("created_at") or datetime.now(UTC),
            )
        )


def list_note_logs() -> list[dict]:
    with session_scope() as session:
        rows = session.scalars(
            select(TeamNoteLogRow).order_by(TeamNoteLogRow.created_at.desc())
        ).all()
        return [row.payload for row in rows]
