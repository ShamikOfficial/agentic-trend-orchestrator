"""Extract actionable tasks from chat messages and compare against existing workflow items."""

from __future__ import annotations

import json
import re
from typing import Any

from backend.app.llm import LlmError, generate_text, generate_text_guarded, load_llm_config
from backend.app.llm.prompts import CHAT_TASK_EXTRACT_PROMPT
from backend.app.models.workflow import WorkflowItem
from backend.app.services.chat.assistant import format_transcript
from backend.app.services.chat.task_dedupe import dedupe_suggestions


def _serialize_workflow_items(items: list[WorkflowItem]) -> str:
    if not items:
        return "(none)"
    lines: list[str] = []
    for item in items:
        sched = ""
        if item.scheduled_start:
            sched = f" | scheduled={item.scheduled_start.isoformat()}"
        elif item.due_date:
            sched = f" | due_date={item.due_date.isoformat()}"
        lines.append(
            f"- id={item.item_id} | title={item.title} | stage={item.stage} "
            f"| owner={item.owner or ''}{sched} | description={item.description[:120]}"
        )
    return "\n".join(lines)


def _extract_json_array(raw: str) -> list[dict[str, Any]]:
    """Best-effort extraction of a JSON array from LLM output."""
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = cleaned.strip()
    parsed = json.loads(cleaned)
    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict) and "suggestions" in parsed:
        return parsed["suggestions"]
    return []


_VALID_ACTIONS = {"create", "update", "comment", "close"}


def _validate_suggestion(item: dict[str, Any]) -> dict[str, Any] | None:
    action = item.get("action", "")
    if action not in _VALID_ACTIONS:
        return None
    result: dict[str, Any] = {
        "action": action,
        "reasoning": str(item.get("reasoning", "")),
        "title": str(item.get("title", "")),
        "description": str(item.get("description", "")),
        "owner": str(item.get("owner", "")),
        "priority": str(item.get("priority", "medium")),
        "existing_item_id": str(item.get("existing_item_id", "")),
        "update_fields": item.get("update_fields") if isinstance(item.get("update_fields"), dict) else {},
        "comment": str(item.get("comment", "")),
    }
    if action == "create" and not result["title"]:
        return None
    if action in ("update", "comment", "close") and not result["existing_item_id"]:
        return None
    return result


def extract_tasks_from_chat(
    messages: list[dict],
    existing_items: list[WorkflowItem],
    *,
    user_id: str | None = None,
) -> list[dict[str, Any]]:
    """Run LLM task extraction on chat messages, comparing against existing workflow items."""
    transcript = format_transcript(messages)
    if not transcript.strip():
        return []

    items_text = _serialize_workflow_items(existing_items)
    user_prompt = CHAT_TASK_EXTRACT_PROMPT.render(
        messages=transcript,
        existing_items=items_text,
    )

    cfg = load_llm_config()
    if user_id:
        raw = generate_text_guarded(
            user_id,
            "task_extract",
            user_prompt,
            system_prompt=CHAT_TASK_EXTRACT_PROMPT.system,
            config=cfg,
            response_mime_json=True,
        )
    else:
        raw = generate_text(
            user_prompt,
            system_prompt=CHAT_TASK_EXTRACT_PROMPT.system,
            config=cfg,
            response_mime_json=True,
        )

    try:
        raw_items = _extract_json_array(raw)
    except (json.JSONDecodeError, KeyError, TypeError):
        return []

    suggestions = []
    for item in raw_items:
        validated = _validate_suggestion(item)
        if validated:
            suggestions.append(validated)
    return dedupe_suggestions(suggestions, existing_items)
