"""Core team assistant logic with no API coupling."""

from __future__ import annotations

import re
import uuid
from datetime import UTC, date, datetime, timedelta

from backend.app.models.team import Reminder, Task, TeamSummary

ACTION_PREFIXES = ("action:", "todo:", "-", "*")


def _make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def summarize_content(
    content: str,
    source_type: str = "meeting",
    title: str | None = None,
) -> TeamSummary:
    lines = [ln.strip() for ln in content.splitlines() if ln.strip()]
    if not lines:
        lines = ["No content provided."]

    summary_text = " ".join(lines[:3])
    action_items = []
    for line in lines:
        if line.lower().startswith(ACTION_PREFIXES):
            action_items.append(line.lstrip("-* ").split(":", 1)[-1].strip())
        if len(action_items) >= 5:
            break

    return TeamSummary(
        summary_id=_make_id("sum"),
        source_type=source_type,  # type: ignore[arg-type]
        title=title,
        summary=summary_text,
        action_items_preview=action_items,
    )


def extract_tasks(
    content: str,
    owner_candidates: list[str] | None = None,
    default_due_days: int = 3,
) -> list[Task]:
    lines = [ln.strip() for ln in content.splitlines() if ln.strip()]
    candidates = owner_candidates or []
    tasks: list[Task] = []
    owner_idx = 0

    for line in lines:
        lowered = line.lower()
        if not lowered.startswith(ACTION_PREFIXES):
            continue

        text = line.lstrip("-* ").split(":", 1)[-1].strip()
        owner = _detect_owner(text, candidates)
        if owner is None and candidates:
            owner = candidates[owner_idx % len(candidates)]
            owner_idx += 1

        due = _detect_due_date(text, default_due_days)
        priority = _detect_priority(text)

        tasks.append(
            Task(
                task_id=_make_id("tsk"),
                title=text[:80],
                description=text,
                owner=owner,
                due_date=due,
                priority=priority,
                status="todo",
            )
        )

    return tasks


def update_task(task: Task, **changes: object) -> Task:
    data = task.model_dump()
    for key, value in changes.items():
        if key in data and value is not None:
            data[key] = value
    data["updated_at"] = datetime.now(UTC)
    return Task(**data)


def run_deadline_reminders(tasks: list[Task], window_hours: int = 24) -> list[Reminder]:
    reminders: list[Reminder] = []
    today = date.today()
    due_soon_days = max(1, (window_hours + 23) // 24)
    due_soon_threshold = today + timedelta(days=due_soon_days)

    for task in tasks:
        if task.status == "done" or task.due_date is None:
            continue
        if task.due_date < today:
            reminders.append(
                Reminder(
                    task_id=task.task_id,
                    owner=task.owner,
                    due_date=task.due_date,
                    severity="overdue",
                    message="Task is overdue.",
                )
            )
        elif task.due_date <= due_soon_threshold:
            reminders.append(
                Reminder(
                    task_id=task.task_id,
                    owner=task.owner,
                    due_date=task.due_date,
                    severity="due_soon",
                    message=f"Task is due within {window_hours} hours.",
                )
            )
    return reminders


def _detect_owner(text: str, candidates: list[str]) -> str | None:
    for candidate in candidates:
        if re.search(rf"\b{re.escape(candidate)}\b", text, flags=re.IGNORECASE):
            return candidate
    return None


def _detect_due_date(text: str, default_due_days: int) -> date:
    lowered = text.lower()
    if "today" in lowered:
        return date.today()
    if "tomorrow" in lowered:
        return date.today() + timedelta(days=1)
    return date.today() + timedelta(days=default_due_days)


def _detect_priority(text: str) -> str:
    lowered = text.lower()
    if "urgent" in lowered or "asap" in lowered:
        return "high"
    if "low" in lowered:
        return "low"
    return "medium"
