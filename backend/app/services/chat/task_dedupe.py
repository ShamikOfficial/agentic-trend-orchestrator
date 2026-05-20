"""Remove duplicate or no-op task suggestions before showing in the UI."""

from __future__ import annotations

import re
from datetime import date, datetime, timezone
from typing import Any

from backend.app.models.workflow import VALID_WORKFLOW_STAGES, WorkflowItem

_ISO_DATE = re.compile(r"\b20\d{2}-\d{2}-\d{2}\b")
_RELATIVE = re.compile(r"\b(today|tomorrow|tonight|next|this)\b", re.IGNORECASE)
_WEEKDAY = re.compile(
    r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
    re.IGNORECASE,
)


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


def collapse_updates_per_item(suggestions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep only the last update/comment/close per item in this LLM response."""
    last_index: dict[tuple[str, str], int] = {}
    for i, raw in enumerate(suggestions):
        action = str(raw.get("action", ""))
        if action not in ("update", "comment", "close"):
            continue
        eid = str(raw.get("existing_item_id", "")).strip()
        if eid:
            last_index[(eid, action)] = i
    if not last_index:
        return suggestions
    keep = set(last_index.values())
    out: list[dict[str, Any]] = []
    for i, raw in enumerate(suggestions):
        action = str(raw.get("action", ""))
        if action in ("update", "comment", "close"):
            if i in keep:
                out.append(raw)
        else:
            out.append(raw)
    return out


def drop_updates_when_close_present(suggestions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    closed_ids = {
        str(s.get("existing_item_id", "")).strip()
        for s in suggestions
        if s.get("action") == "close" and s.get("existing_item_id")
    }
    if not closed_ids:
        return suggestions
    return [
        s
        for s in suggestions
        if not (s.get("action") == "update" and str(s.get("existing_item_id", "")).strip() in closed_ids)
    ]


def _normalize_description(text: str) -> str:
    t = (text or "").lower().strip()
    t = _ISO_DATE.sub(" ", t)
    t = _WEEKDAY.sub(" ", t)
    t = _RELATIVE.sub(" ", t)
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return " ".join(t.split())


def _weekday_hint(text: str) -> str | None:
    match = _WEEKDAY.search(text or "")
    return match.group(1).lower() if match else None


def _descriptions_meaningfully_different(old: str, new: str) -> bool:
    o = _normalize_description(old)
    n = _normalize_description(new)
    if not n:
        return False
    if o == n:
        return False
    old_day = _weekday_hint(old)
    new_day = _weekday_hint(new)
    if old_day and new_day and old_day == new_day:
        o_rest, n_rest = o.replace(old_day, ""), n.replace(new_day, "")
        if o_rest == n_rest or (o_rest in n_rest or n_rest in o_rest):
            return False
    if o and (o in n or n in o):
        o_tokens = set(o.split())
        n_tokens = set(n.split())
        if o_tokens and n_tokens:
            overlap = len(o_tokens & n_tokens) / max(len(o_tokens), len(n_tokens))
            if overlap >= 0.72:
                return False
    return True


def _parse_instant(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp())
    text = str(value).strip()
    if not text:
        return None
    for candidate in (text, text.replace("Z", "+00:00")):
        try:
            dt = datetime.fromisoformat(candidate)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return int(dt.timestamp())
        except ValueError:
            continue
    return None


def _dates_equal(old: Any, new_s: str) -> bool:
    if isinstance(old, date) and not isinstance(old, datetime):
        return old.isoformat()[:10] == new_s[:10]
    if isinstance(old, datetime):
        return old.date().isoformat()[:10] == new_s[:10]
    return str(old or "").strip()[:10] == new_s[:10]


def _schedule_instant_equal(old: Any, new_s: str, *, tolerance_seconds: int = 60) -> bool:
    old_ts = _parse_instant(old)
    new_ts = _parse_instant(new_s)
    if old_ts is None or new_ts is None:
        return False
    return abs(old_ts - new_ts) <= tolerance_seconds


def _effective_due_date(existing: WorkflowItem) -> str | None:
    if existing.due_date:
        return existing.due_date.isoformat()[:10]
    if existing.scheduled_start:
        return existing.scheduled_start.date().isoformat()[:10]
    return None


def _proposed_due_date(update_fields: dict[str, Any]) -> str | None:
    raw_due = update_fields.get("due_date")
    if raw_due:
        return str(raw_due).strip()[:10]
    raw_start = update_fields.get("scheduled_start")
    if raw_start:
        ts = _parse_instant(raw_start)
        if ts is not None:
            return datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
    return None


def _item_linked_to_message(existing: WorkflowItem, message_id: str) -> bool:
    mid = (message_id or "").strip()
    if not mid:
        return False
    if existing.source_last_message_id == mid:
        return True
    return mid in (existing.source_message_ids or [])


def _already_handled_for_message(
    existing: WorkflowItem,
    raw: dict[str, Any],
) -> bool:
    """Skip if this chat line is already linked on the workflow item (accepted before)."""
    mid = str(raw.get("source_message_id") or "").strip()
    if not mid:
        ids = raw.get("source_message_ids") or []
        mid = str(ids[-1]) if ids else ""
    if not mid:
        return False
    return _item_linked_to_message(existing, mid)


def _calendar_already_captured(
    existing: WorkflowItem,
    update_fields: dict[str, Any],
    raw: dict[str, Any],
) -> bool:
    prop_due = _proposed_due_date(update_fields)
    ex_due = _effective_due_date(existing)
    if not prop_due or not ex_due or prop_due != ex_due:
        return False
    desc = str(raw.get("description") or update_fields.get("description") or "").strip()
    if _descriptions_meaningfully_different(existing.description, desc):
        return False
    if existing.scheduled_start:
        start_raw = str(update_fields.get("scheduled_start") or "")
        if start_raw and not _schedule_instant_equal(existing.scheduled_start, start_raw):
            return False
    return True


def _update_fields_meaningful(
    existing: WorkflowItem,
    update_fields: dict[str, Any],
) -> bool:
    if not update_fields:
        return False
    for key, raw_new in update_fields.items():
        if raw_new is None:
            continue
        new_s = str(raw_new).strip()
        if not new_s:
            continue
        old = getattr(existing, key, None)
        if key == "due_date":
            if not _dates_equal(old, new_s):
                return True
        elif key in ("scheduled_start", "scheduled_end"):
            if not _schedule_instant_equal(old, new_s):
                return True
        elif key == "stage":
            if str(old or "").strip() != new_s:
                return True
        elif key in ("description", "owner", "title", "project"):
            if key == "description":
                if _descriptions_meaningfully_different(str(old or ""), new_s):
                    return True
            elif str(old or "").strip().lower() != new_s.lower():
                return True
        else:
            if str(old or "").strip() != new_s:
                return True
    return False


def _skip_update_on_published_item(existing: WorkflowItem, raw: dict[str, Any]) -> bool:
    if existing.stage != "Publish":
        return False
    uf = raw.get("update_fields") if isinstance(raw.get("update_fields"), dict) else {}
    new_stage = str(uf.get("stage") or "").strip()
    if new_stage in VALID_WORKFLOW_STAGES and new_stage != "Publish":
        return False
    return True


def _create_is_duplicate(existing_items: list[WorkflowItem], raw: dict[str, Any]) -> bool:
    title = str(raw.get("title", "")).strip()
    uf = raw.get("update_fields") if isinstance(raw.get("update_fields"), dict) else {}
    prop_due = _proposed_due_date(uf)
    desc = str(raw.get("description") or uf.get("description") or "").strip()
    for ex in existing_items:
        if not titles_similar(title, ex.title):
            continue
        if prop_due and _effective_due_date(ex) == prop_due:
            if not _descriptions_meaningfully_different(ex.description, desc):
                return True
        if not prop_due and not _descriptions_meaningfully_different(ex.description, desc):
            return True
    return False


def filter_novel_suggestions(
    suggestions: list[dict[str, Any]],
    existing_items: list[WorkflowItem],
    *,
    message_order: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
    _ = message_order
    suggestions = drop_updates_when_close_present(collapse_updates_per_item(suggestions))
    by_id = {item.item_id: item for item in existing_items}
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
            if _create_is_duplicate(existing_items, raw):
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
            existing = by_id.get(eid)
            if not existing:
                continue
            if action == "update":
                if _skip_update_on_published_item(existing, raw):
                    continue
                if _already_handled_for_message(existing, raw):
                    continue
                uf = raw.get("update_fields") if isinstance(raw.get("update_fields"), dict) else {}
                top_desc = str(raw.get("description") or "").strip()
                if top_desc and "description" not in uf:
                    uf = {**uf, "description": top_desc}
                if _calendar_already_captured(existing, uf, raw):
                    continue
                if not _update_fields_meaningful(existing, uf):
                    continue
            if action == "comment":
                comment = str(raw.get("comment", "")).strip()
                if not comment:
                    continue
                prior = " ".join((existing.comments or [])).lower()
                if comment.lower() in prior:
                    continue
            seen_item_actions.add(dedupe_key)
            out.append(raw)

    return out


def dedupe_suggestions(
    suggestions: list[dict[str, Any]],
    existing_items: list[WorkflowItem],
    *,
    message_order: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
    return filter_novel_suggestions(suggestions, existing_items, message_order=message_order)
