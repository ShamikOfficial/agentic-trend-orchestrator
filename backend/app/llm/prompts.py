"""Centralized prompt templates for all LLM tasks."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PromptTemplate:
    name: str
    system: str
    user_template: str

    def render(self, **kwargs: str) -> str:
        return self.user_template.format(**kwargs)


CHAT_TASK_EXTRACT_PROMPT = PromptTemplate(
    name="chat_task_extract",
    system=(
        "You are a task extraction agent for a content production team. "
        "You read chat messages and identify actionable tasks. "
        "You also compare extracted tasks against existing workflow items to avoid duplicates. "
        "Return valid JSON only."
    ),
    user_template=(
        "Analyze the following NEW chat messages and extract actionable tasks.\n"
        "Then compare each extracted task against the EXISTING workflow items below.\n\n"
        "For each task you find, decide one action:\n"
        '- "create": no related existing item exists — propose a new workflow item.\n'
        '- "update": a related existing item exists and its fields (stage, description, owner) '
        "should change based on the new information.\n"
        '- "comment": a related existing item exists but only needs a new comment or note '
        "appended, no field changes needed.\n"
        '- "close": a related existing item is finished/completed/done and should be closed '
        "(moved to Publish stage).\n\n"
        "Return a JSON array with this schema (return [] if no actionable items):\n"
        "[\n"
        "  {{\n"
        '    "action": "create|update|comment|close",\n'
        '    "source_message_id": "message_id from the NEW CHAT MESSAGES line that triggered this",\n'
        '    "reasoning": "why this action was chosen",\n'
        '    "title": "task title (for create)",\n'
        '    "description": "task description (for create)",\n'
        '    "owner": "person name or empty string (for create)",\n'
        '    "priority": "low|medium|high (for create)",\n'
        '    "existing_item_id": "item_id of matching workflow item (for update/comment, empty for create)",\n'
        '    "schedule": {{\n'
        '      "due_date": "YYYY-MM-DD or empty",\n'
        '      "scheduled_start": "ISO-8601 with timezone or empty",\n'
        '      "scheduled_end": "ISO-8601 with timezone or empty"\n'
        "    }},\n"
        '    "update_fields": {{"stage": "Idea|Brief|Production|Review|Publish", "description": "...", '
        '"owner": "name"}},\n'
        '    "comment": "comment text (for comment action)"\n'
        "  }}\n"
        "]\n\n"
        "Rules:\n"
        "- Output JSON array only, no markdown fences, no extra text.\n"
        "- Only extract from NEW CHAT MESSAGES — never re-suggest tasks already reflected in EXISTING WORKFLOW ITEMS.\n"
        "- \"schedule meet tomorrow\" and \"schedule meet on <that calendar date>\" are the SAME — return [].\n"
        "- At most ONE suggestion per source_message_id and per existing_item_id.\n"
        "- Only extract genuinely actionable tasks, not greetings or general chat.\n"
        "- Return [] if the new messages only repeat information already captured in EXISTING WORKFLOW ITEMS.\n"
        "- If an existing item is semantically related, prefer update or comment over create — never create a duplicate.\n"
        '- Do NOT emit "update" unless at least one field in update_fields actually changes the existing item.\n'
        "- If nothing new was said about an existing task (same schedule, same owner, same status), omit it entirely.\n"
        '- If a task is reported as finished/completed/done, use "close" action.\n'
        '- If a done/published item should be reopened, use update with stage change.\n'
        "- Valid stage values are ONLY: Idea, Brief, Production, Review, Publish. Do NOT use any other stage names.\n"
        "- For create, leave existing_item_id as empty string.\n"
        "- CURRENT DATETIME (fallback clock): {reference_datetime}\n"
        "- Each chat line includes message_id= and sent_at= — resolve \"tomorrow\", \"next Tuesday\", etc. "
        "relative to THAT message's sent_at, not the fallback clock, when they differ.\n"
        "- SCHEDULING (critical): When the user mentions a date, day, or time, you MUST set these in update_fields "
        "(not only in description):\n"
        "  due_date (YYYY-MM-DD), scheduled_start (ISO-8601 with timezone), scheduled_end (ISO-8601 with timezone).\n"
        "- Resolve relative phrases using CURRENT DATETIME: \"next Monday\", \"tomorrow\", \"this Friday\", \"at 3pm\", etc.\n"
        "- If only a day is given (no clock time), use 10:00–11:00 local time on that day for meetings "
        "(ISO datetimes must include timezone offset).\n"
        "- scheduled_end must be 60 minutes after scheduled_start unless a duration is stated.\n"
        "- Never put the only copy of the meeting date/time solely in description — always duplicate into due_date and scheduled_*.\n"
        "- For reschedule messages, update due_date and scheduled_start/end to the NEW time; description may summarize but schedule fields are required.\n"
        "- Only omit schedule fields when the message has no date, day, or time hint at all.\n"
        "- Do NOT suggest creating a task that already appears in EXISTING WORKFLOW ITEMS (same or very similar title).\n"
        "- Do NOT output duplicate suggestions in your JSON array (one entry per distinct action).\n"
        "- At most ONE update per existing_item_id — use the latest message only, not every historical reschedule.\n"
        "- Do NOT suggest updates for items already in Publish stage unless reopening them.\n"
        "- Skip items whose schedule and description already match the chat request.\n"
        "- For update/comment, existing_item_id is required.\n"
        "- Return empty array [] if no actionable items found.\n\n"
        "EXISTING WORKFLOW ITEMS:\n{existing_items}\n\n"
        "NEW CHAT MESSAGES:\n{messages}"
    ),
)

TEAM_UNIFIED_PROCESS_PROMPT = PromptTemplate(
    name="team_unified_process",
    system=(
        "You are an operations assistant for product teams. "
        "You must classify input, summarize it, and extract actionable tasks in one pass. "
        "Return valid JSON only."
    ),
    user_template=(
        "Analyze this text and return JSON with this exact schema:\n"
        "{{\n"
        '  "category": "Meeting Notes|Chat Logs|Notes|Call Log|Other",\n'
        '  "category_result": "matched_keywords|inferred_context|unknown",\n'
        '  "summary": "short paragraph",\n'
        '  "action_items_preview": ["item1", "item2"],\n'
        '  "tasks": [\n'
        "    {{\n"
        '      "title": "task title",\n'
        '      "description": "task description",\n'
        '      "owner": "name or empty string",\n'
        '      "due_date": "YYYY-MM-DD or empty string",\n'
        '      "priority": "low|medium|high",\n'
        '      "notes": "supporting notes"\n'
        "    }}\n"
        "  ]\n"
        "}}\n\n"
        "Rules:\n"
        "- Output JSON only, no markdown.\n"
        "- Create tasks only when actionable items are present.\n"
        "- Use due_date when explicit; otherwise leave empty string.\n"
        "- Keep action_items_preview concise.\n\n"
        "Owner candidates: {owner_candidates}\n"
        "Input:\n{content}"
    ),
)

