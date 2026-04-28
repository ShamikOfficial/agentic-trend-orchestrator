"""Core team assistant logic with no API coupling."""

from __future__ import annotations

import json
import re
import uuid
from datetime import UTC, date, datetime, timedelta

from backend.app.llm import LlmError, generate_text
from backend.app.llm.prompts import TEAM_UNIFIED_PROCESS_PROMPT
from backend.app.models.team import Reminder, Task, TeamSummary


def _make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def process_input_unified(
    content: str,
    source_type: str = "meeting",
    title: str | None = None,
    owner_candidates: list[str] | None = None,
    default_due_days: int = 3,
) -> tuple[str, str, TeamSummary, list[Task]]:
    owners = owner_candidates or []
    prompt = TEAM_UNIFIED_PROCESS_PROMPT.render(
        content=content.strip() or "No content provided.",
        owner_candidates=", ".join(owners) if owners else "none",
    )
    print(
        "[team-debug] unified_process start "
        f"content_chars={len(content)} owner_candidates={len(owners)}"
    )
    try:
        raw = generate_text(
            prompt,
            system_prompt=TEAM_UNIFIED_PROCESS_PROMPT.system,
            response_mime_json=True,
        )
        print(f"[team-debug] llm_raw_preview={raw[:500]!r}")
        data = _extract_json(raw)
        print(
            "[team-debug] llm_json_parsed "
            f"category={data.get('category')} tasks_count={len(data.get('tasks', [])) if isinstance(data.get('tasks'), list) else 0}"
        )
    except LlmError as exc:
        print(f"[team-debug] llm_error encountered ({exc}); using fallback payload")
        data = _fallback_payload(content)
    except Exception as exc:
        print(f"[team-debug] parse_error={exc}; using fallback payload")
        data = _fallback_payload(content)

    category = _clean_category(str(data.get("category", "Notes")))
    category_result = str(data.get("category_result", "unknown")).strip() or "unknown"
    action_items_preview = _as_string_list(data.get("action_items_preview"))
    summary_text = str(data.get("summary", "")).strip() or "No summary generated."

    summary = TeamSummary(
        summary_id=_make_id("sum"),
        source_type=source_type,  # type: ignore[arg-type]
        title=title,
        summary=summary_text,
        action_items_preview=action_items_preview,
    )
    tasks = _build_tasks_from_payload(
        raw_tasks=data.get("tasks"),
        owner_candidates=owners,
        default_due_days=default_due_days,
    )
    print(f"[team-debug] output summary_chars={len(summary.summary)} tasks={len(tasks)} category={category}")
    return category, category_result, summary, tasks

def _build_tasks_from_payload(
    *,
    raw_tasks: object,
    owner_candidates: list[str],
    default_due_days: int,
) -> list[Task]:
    items = raw_tasks if isinstance(raw_tasks, list) else []
    tasks: list[Task] = []
    owner_idx = 0
    for item in items:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        description = str(item.get("description", "")).strip()
        if not title and description:
            title = description[:80]
        if not title:
            continue
        owner = str(item.get("owner", "")).strip() or None
        if owner is None and owner_candidates:
            owner = owner_candidates[owner_idx % len(owner_candidates)]
            owner_idx += 1
        priority = str(item.get("priority", "medium")).strip().lower()
        if priority not in {"low", "medium", "high"}:
            priority = "medium"
        due_date = _parse_due_date(str(item.get("due_date", "")).strip(), default_due_days)
        tasks.append(
            Task(
                task_id=_make_id("tsk"),
                title=title[:80],
                description=description or title,
                owner=owner,
                due_date=due_date,
                priority=priority,  # type: ignore[arg-type]
                status="todo",
                notes=str(item.get("notes", "")).strip(),
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


def _extract_json(raw: str) -> dict:
    content = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", content, re.IGNORECASE)
    if fence:
        content = fence.group(1).strip()
    # Whole response is often valid JSON when using responseMimeType application/json.
    if content.startswith("{"):
        try:
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
    decoder = json.JSONDecoder()
    for i, ch in enumerate(content):
        if ch != "{":
            continue
        try:
            obj, _ = decoder.raw_decode(content, i)
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            continue
    raise ValueError("No JSON object found in LLM output.")


def _parse_due_date(raw_due: str, default_due_days: int) -> date:
    if raw_due:
        try:
            return datetime.fromisoformat(f"{raw_due}T00:00:00+00:00").date()
        except ValueError:
            pass
    return date.today() + timedelta(days=default_due_days)


def _as_string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _clean_category(raw: str) -> str:
    normalized = raw.strip().lower()
    if "meeting" in normalized:
        return "Meeting Notes"
    if "chat" in normalized:
        return "Chat Logs"
    if "call" in normalized:
        return "Call Log"
    if "note" in normalized:
        return "Notes"
    return "Other"


def _fallback_payload(content: str) -> dict:
    excerpt = content.strip()[:400] or "No content provided."
    return {
        "category": "Notes",
        "category_result": "unknown",
        "summary": (
            "Automated summary and tasks were unavailable (LLM error or parse failure). "
            f"Pasted excerpt:\n{excerpt}"
        ),
        "action_items_preview": [],
        "tasks": [],
    }
