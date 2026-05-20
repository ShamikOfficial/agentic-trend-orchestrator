"""Remove duplicate task suggestions before showing in the UI."""

from __future__ import annotations

import re
from typing import Any

from backend.app.models.workflow import WorkflowItem


def normalize_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (title or "").lower()).strip()


def titles_similar(a: str, b: str) -> bool:
    na, nb = normalize_title(a), normalize_title(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    shorter, longer = (na, nb) if len(na) <= len(nb) else (nb, na)
    if len(shorter) < 4:
        return False
    return shorter in longer


def dedupe_suggestions(
    suggestions: list[dict[str, Any]],
    existing_items: list[WorkflowItem],
) -> list[dict[str, Any]]:
    """Drop repeats within the batch and tasks that already exist as work items."""
    seen_create_titles: set[str] = set()
    seen_item_actions: set[tuple[str, str]] = set()
    out: list[dict[str, Any]] = []

    for raw in suggestions:
        action = raw.get("action", "")
        if action == "create":
            title = str(raw.get("title", "")).strip()
            key = normalize_title(title)
            if not key or key in seen_create_titles:
                continue
            if any(titles_similar(title, ex.title) for ex in existing_items):
                continue
            seen_create_titles.add(key)
            out.append(raw)
            continue

        if action in ("update", "comment", "close"):
            eid = str(raw.get("existing_item_id", "")).strip()
            if not eid:
                continue
            dedupe_key = (eid, action)
            if dedupe_key in seen_item_actions:
                continue
            seen_item_actions.add(dedupe_key)
            if action == "update":
                uf = raw.get("update_fields") if isinstance(raw.get("update_fields"), dict) else {}
                if not uf:
                    continue
            out.append(raw)

    return out
