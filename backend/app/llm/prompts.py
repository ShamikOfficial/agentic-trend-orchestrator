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

