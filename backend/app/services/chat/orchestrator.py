"""Route @chat questions to Q&A, task extraction, scheduling, or summarization."""

from __future__ import annotations

import re
from typing import Any, Literal

from backend.app.llm import LlmError, LlmQuotaError
from backend.app.persistence import chat_repo, workflow_repo
from backend.app.services.chat import assistant as chat_assistant
from backend.app.services.chat import schedule_slots, task_analysis_batches, task_extractor

ChatIntent = Literal["ask", "summarize", "extract_tasks", "assign_tasks", "availability"]

_EXTRACT_TASKS = re.compile(
    r"\b(extract|identify|find|list|scan|pull)\b.*\b(tasks?|action\s*items?|todos?|to-?dos?)\b"
    r"|\b(tasks?|action\s*items?)\b.*\b(extract|identify|find|from)\b"
    r"|\bwhat\s+(tasks?|action\s*items?)\b",
    re.I,
)
_ASSIGN_TASKS = re.compile(
    r"\b(assign|reassign|allocate|delegate)\b.*\b(tasks?|items?|owners?)\b"
    r"|\bwho\s+should\s+(own|do|handle)\b",
    re.I,
)
_SUMMARIZE = re.compile(
    r"\b(summarize|summary|recap|overview|catch\s*me\s*up|key\s+decisions?)\b",
    re.I,
)
_CREATE_TASK = re.compile(
    r"\b(create|add|make)\b.*\b(task|todo|action\s*item|work\s*item)\b",
    re.I,
)


def classify_chat_intent(question: str) -> ChatIntent:
    q = question.strip()
    if not q:
        return "ask"
    if schedule_slots.is_availability_question(q):
        return "availability"
    if _ASSIGN_TASKS.search(q):
        return "assign_tasks"
    if _EXTRACT_TASKS.search(q) or _CREATE_TASK.search(q):
        return "extract_tasks"
    if _SUMMARIZE.search(q):
        return "summarize"
    return "ask"


def _linked_items_for_chat(chat_key: str) -> tuple[list, list]:
    items = [
        item
        for item in workflow_repo.list_workflow_items()
        if getattr(item, "source_chat_key", None) == chat_key
        or chat_key.lower() in (item.linked_trend or "").lower()
    ]
    item_ids = {item.item_id for item in items}
    milestones = [ms for ms in workflow_repo.list_milestones() if ms.item_id in item_ids]
    return items, milestones


def run_chat_orchestrator(
    *,
    messages: list[dict],
    question: str,
    user_id: str,
    chat_key: str,
    external_events: list[dict],
) -> dict[str, Any]:
    """Single entry for @chat: answers, extracts tasks, or returns schedule context."""
    intent = classify_chat_intent(question)
    transcript = chat_assistant.format_transcript(messages)
    result: dict[str, Any] = {
        "intent": intent,
        "answer": "",
        "show_schedule_picker": False,
        "task_suggestions": [],
    }

    if intent == "availability":
        linked_items, linked_milestones = _linked_items_for_chat(chat_key)
        schedule_result = schedule_slots.suggest_time_slots(
            task_title="Meeting",
            task_description=question,
            duration_minutes=60,
            items=workflow_repo.list_workflow_items(),
            milestones=linked_milestones,
            external_events=external_events,
        )
        result["answer"] = schedule_slots.format_availability_answer(question, schedule_result)
        result["show_schedule_picker"] = True
        return result

    if intent in ("extract_tasks", "assign_tasks"):
        linked_items = [
            item
            for item in workflow_repo.list_workflow_items()
            if getattr(item, "source_chat_key", None) == chat_key
            or chat_key.lower() in (item.linked_trend or "").lower()
        ]
        last_analyzed_id = chat_repo.get_analysis_state(chat_key)
        next_batch_index = chat_repo.count_analysis_batches(chat_key)
        selected = task_analysis_batches.select_messages_for_extraction(
            messages,
            last_analyzed_id=last_analyzed_id,
            next_batch_index=next_batch_index,
            force=True,
        )
        if selected is None:
            batch_size = task_analysis_batches.task_extract_force_count()
            unanalyzed = task_analysis_batches.messages_after_id(messages, last_analyzed_id)
            need = max(0, batch_size - len(unanalyzed))
            result["answer"] = (
                f"Need {need} more message(s) before the next task section can be analyzed "
                f"({len(unanalyzed)}/{batch_size} in the current section)."
                if need
                else "No new messages to analyze for tasks."
            )
            return result
        batch_messages, batch_meta = selected
        try:
            suggestions = task_extractor.extract_tasks_from_chat(
                batch_messages,
                linked_items,
                user_id=user_id,
            )
        except (LlmError, LlmQuotaError):
            raise
        result["task_suggestions"] = task_analysis_batches.attach_batch_to_suggestions(
            suggestions,
            batch_meta,
        )
        result["analysis_batch"] = batch_meta
        if intent == "assign_tasks":
            result["answer"] = (
                f"Found {len(suggestions)} task suggestion(s). "
                "Set owners and schedule in the task panel, then Accept."
                if suggestions
                else "No tasks to assign from recent messages."
            )
        elif suggestions:
            result["answer"] = (
                f"Found {len(suggestions)} actionable task(s). "
                "Pick a date/time for each in the task panel below, then Accept."
            )
        else:
            result["answer"] = "No actionable tasks found in this conversation."
        return result

    schedule_context: str | None = None
    if schedule_slots.message_needs_scheduling(question):
        schedule_result = schedule_slots.suggest_time_slots(
            task_title=question[:80],
            task_description=question,
            items=workflow_repo.list_workflow_items(),
            milestones=workflow_repo.list_milestones(),
            external_events=external_events,
        )
        schedule_context = schedule_slots.format_availability_answer(question, schedule_result)
        result["show_schedule_picker"] = True

    ask_question = question
    if intent == "summarize":
        ask_question = (
            "Summarize this conversation with key decisions, blockers, and open items. "
            f"User request: {question}"
        )

    answer = chat_assistant.answer_from_transcript(
        transcript,
        ask_question,
        user_id=user_id,
        schedule_context=schedule_context,
    )
    result["answer"] = answer.strip()
    return result
