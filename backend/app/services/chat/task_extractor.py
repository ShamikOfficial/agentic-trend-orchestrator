"""Extract actionable tasks from chat messages and compare against existing workflow items."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from typing import Any

from backend.app.llm import LlmError, generate_text, generate_text_guarded, load_llm_config
from backend.app.llm.prompts import CHAT_TASK_EXTRACT_PROMPT
from backend.app.models.workflow import WorkflowItem
from backend.app.services.chat.assistant import format_transcript
from backend.app.services.chat.message_timing import (
    format_reference_label,
    reference_datetime_for_suggestion,
)
from backend.app.services.chat.task_dedupe import (
    collapse_updates_per_item,
    drop_updates_when_close_present,
    filter_novel_suggestions,
)


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
        src = ""
        if item.source_last_message_id:
            src = f" | linked_message={item.source_last_message_id}"
        lines.append(
            f"- id={item.item_id} | title={item.title} | stage={item.stage} "
            f"| owner={item.owner or ''}{sched}{src} | description={item.description[:120]}"
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


def _merge_schedule_fields(item: dict[str, Any], update_fields: dict[str, Any]) -> dict[str, Any]:
    uf = dict(update_fields)
    sched = item.get("schedule")
    if isinstance(sched, dict):
        for key in ("due_date", "scheduled_start", "scheduled_end"):
            val = sched.get(key)
            if val is not None and str(val).strip():
                uf[key] = str(val).strip()
    for key in ("due_date", "scheduled_start", "scheduled_end"):
        top = item.get(key)
        if top and str(top).strip() and not uf.get(key):
            uf[key] = str(top).strip()
    return uf


def _validate_suggestion(item: dict[str, Any]) -> dict[str, Any] | None:
    action = item.get("action", "")
    if action not in _VALID_ACTIONS:
        return None
    update_fields = item.get("update_fields") if isinstance(item.get("update_fields"), dict) else {}
    update_fields = _merge_schedule_fields(item, dict(update_fields))
    result: dict[str, Any] = {
        "action": action,
        "source_message_id": str(item.get("source_message_id", "")).strip(),
        "reasoning": str(item.get("reasoning", "")),
        "title": str(item.get("title", "")),
        "description": str(item.get("description", "")),
        "owner": str(item.get("owner", "")),
        "priority": str(item.get("priority", "medium")),
        "existing_item_id": str(item.get("existing_item_id", "")),
        "update_fields": update_fields,
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
    client_timezone: str | None = None,
) -> list[dict[str, Any]]:
    """Run LLM task extraction on chat messages, comparing against existing workflow items."""
    transcript = format_transcript(messages, client_timezone=client_timezone)
    if not transcript.strip():
        return []

    items_text = _serialize_workflow_items(existing_items)
    ref = reference_datetime_for_suggestion(
        {"source_message_ids": [str(m.get("message_id")) for m in messages if m.get("message_id")]},
        messages,
    )
    user_prompt = CHAT_TASK_EXTRACT_PROMPT.render(
        messages=transcript,
        existing_items=items_text,
        reference_datetime=format_reference_label(ref, client_timezone),
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
    return suggestions


def finalize_task_suggestions(
    suggestions: list[dict[str, Any]],
    existing_items: list[WorkflowItem],
    *,
    batch_messages: list[dict],
    all_messages: list[dict] | None = None,
    client_timezone: str | None = None,
) -> list[dict[str, Any]]:
    """Enrich schedules from batch text, then drop redundant/no-op suggestions."""
    from backend.app.services.chat.schedule_extract import enrich_suggestions_schedules
    from backend.app.services.chat.task_analysis_batches import message_order_index

    from zoneinfo import ZoneInfo

    schedule_tz = None
    if client_timezone:
        try:
            schedule_tz = ZoneInfo(client_timezone)
        except Exception:
            schedule_tz = None
    suggestions = drop_updates_when_close_present(collapse_updates_per_item(suggestions))
    transcript = format_transcript(batch_messages, client_timezone=client_timezone)
    enriched = enrich_suggestions_schedules(
        suggestions,
        message_context=transcript,
        batch_messages=batch_messages,
        schedule_tz=schedule_tz,
    )
    order = message_order_index(all_messages or batch_messages)
    return filter_novel_suggestions(enriched, existing_items, message_order=order)
