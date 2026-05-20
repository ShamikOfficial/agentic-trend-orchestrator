"""Suggest non-overlapping time slots from work items, milestones, and external busy blocks."""

from __future__ import annotations

import re
from datetime import UTC, date, datetime, timedelta
from typing import Any

from backend.app.models.workflow import Milestone, WorkflowItem

WORK_START_HOUR = 9
WORK_END_HOUR = 18
SLOT_STEP_MINUTES = 30
DEFAULT_DURATION_MINUTES = 60
MAX_SLOTS = 6
HORIZON_DAYS = 10

_TIME_KEYWORDS = re.compile(
    r"\b(tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|"
    r"deadline|due|schedule|scheduled|meeting|call|sync|at\s+\d{1,2}|"
    r"\d{1,2}(:\d{2})?\s*(am|pm)|by\s+\w+\s+\d{1,2}|eod|eow)\b",
    re.IGNORECASE,
)

_AVAILABILITY_KEYWORDS = re.compile(
    r"\b("
    r"free\s+(slot|time|window)|"
    r"open\s+(slot|time|window)|"
    r"availability|available|"
    r"when\s+(can|could|should)\s+(we|i)\s+meet|"
    r"do\s+i\s+have\s+(any\s+)?(free|open)|"
    r"any\s+(free|open)\s+(slot|time)|"
    r"find\s+(a\s+)?time|"
    r"schedule\s+a\s+meet|"
    r"next\s+week|this\s+week|"
    r"time\s+to\s+meet|"
    r"busy\s+or\s+free"
    r")\b",
    re.IGNORECASE,
)


def message_needs_scheduling(text: str) -> bool:
    if not text or not text.strip():
        return False
    return bool(_TIME_KEYWORDS.search(text)) or bool(_AVAILABILITY_KEYWORDS.search(text))


def is_availability_question(text: str) -> bool:
    """Questions about free/busy time should use the schedule engine, not transcript-only Q&A."""
    if not text or not text.strip():
        return False
    q = text.lower()
    if _AVAILABILITY_KEYWORDS.search(q):
        return True
    if "free" in q and any(w in q for w in ("slot", "time", "meet", "calendar", "week")):
        return True
    if "available" in q and any(w in q for w in ("meet", "call", "week", "tomorrow", "when")):
        return True
    return False


def _next_week_date_range(now: datetime | None = None) -> tuple[date, date]:
    now = now or datetime.now(UTC)
    today = now.date()
    days_until_monday = (7 - today.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    start = today + timedelta(days=days_until_monday)
    end = start + timedelta(days=6)
    return start, end


def _filter_slots_to_range(slots: list[dict[str, Any]], start: date, end: date) -> list[dict[str, Any]]:
    filtered: list[dict[str, Any]] = []
    for slot in slots:
        day = slot["start"][:10]
        try:
            d = date.fromisoformat(day)
        except ValueError:
            continue
        if start <= d <= end:
            filtered.append(slot)
    return filtered


def format_availability_answer(question: str, schedule_result: dict[str, Any]) -> str:
    q = question.lower()
    all_slots = schedule_result.get("slots") or []
    free_slots = [s for s in all_slots if not s.get("conflict")]

    if "next week" in q:
        week_start, week_end = _next_week_date_range()
        free_slots = _filter_slots_to_range(free_slots, week_start, week_end)
        window_label = f"next week ({week_start.isoformat()} to {week_end.isoformat()})"
    elif "this week" in q:
        today = datetime.now(UTC).date()
        week_end = today + timedelta(days=(6 - today.weekday()))
        free_slots = _filter_slots_to_range(free_slots, today, week_end)
        window_label = "this week"
    else:
        window_label = "the next several days"

    busy = schedule_result.get("busy_blocks") or []
    schedule_clear = schedule_result.get("schedule_clear", False) or len(busy) == 0

    if schedule_clear:
        lines = [
            f"Your schedule looks clear for {window_label} — no work items or calendar events are blocking time (work hours 9am–6pm).",
        ]
    else:
        lines = [
            f"Checked your work items and calendar commitments for {window_label} (work hours 9am–6pm).",
        ]

    if not free_slots:
        if schedule_clear:
            lines.append(
                "Pick a time below — all standard work-hour slots are available unless you add calendar sync in the details panel."
            )
        else:
            lines.append(
                "I don't see conflict-free meeting slots in that window. "
                "Sync Google/Apple calendar in the chat details panel for a fuller picture."
            )
            lines.append(f"\n{len(busy)} scheduled block(s) are on your calendar.")
        return "\n".join(lines)

    if schedule_clear:
        lines.append("Here are suggested times (your calendar is open):")
    else:
        lines.append("Here are open slots that avoid overlaps with your existing tasks and events:")
    for slot in free_slots[:8]:
        marker = " (recommended)" if slot.get("recommended") else ""
        lines.append(f"• {slot['label']}{marker}")

    if len(free_slots) > 8:
        lines.append(f"• …and {len(free_slots) - 8} more. Use the Schedule panel on the right to pick a custom time.")

    lines.append("\nUse the time picker below to confirm a slot or choose a custom time.")
    return "\n".join(lines)


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    raw = value.strip()
    if not raw:
        return None
    try:
        if len(raw) == 10:
            d = date.fromisoformat(raw)
            return datetime(d.year, d.month, d.day, WORK_START_HOUR, 0, tzinfo=UTC)
        normalized = raw.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC)
    except ValueError:
        return None


def _busy_from_work_item(item: WorkflowItem) -> list[tuple[datetime, datetime, str]]:
    blocks: list[tuple[datetime, datetime, str]] = []
    start = _parse_dt(item.due_date.isoformat() if item.due_date else None)
    if item.scheduled_start:
        s = item.scheduled_start
        if s.tzinfo is None:
            s = s.replace(tzinfo=UTC)
        e = item.scheduled_end or (s + timedelta(minutes=DEFAULT_DURATION_MINUTES))
        if e.tzinfo is None:
            e = e.replace(tzinfo=UTC)
        blocks.append((s, e, item.title))
        return blocks
    if start:
        blocks.append(
            (
                start,
                start + timedelta(hours=2),
                item.title,
            )
        )
    return blocks


def _busy_from_milestone(ms: Milestone) -> list[tuple[datetime, datetime, str]]:
    if ms.scheduled_start:
        s = ms.scheduled_start
        if s.tzinfo is None:
            s = s.replace(tzinfo=UTC)
        e = ms.scheduled_end or (s + timedelta(minutes=DEFAULT_DURATION_MINUTES))
        if e.tzinfo is None:
            e = e.replace(tzinfo=UTC)
        return [(s, e, ms.title)]
    start = _parse_dt(ms.due_date.isoformat() if ms.due_date else None)
    if start:
        return [(start, start + timedelta(hours=1), ms.title)]
    return []


def _busy_from_external(events: list[dict[str, Any]]) -> list[tuple[datetime, datetime, str]]:
    blocks: list[tuple[datetime, datetime, str]] = []
    for ev in events:
        start = _parse_dt(str(ev.get("start", "")))
        end = _parse_dt(str(ev.get("end", ""))) or (
            start + timedelta(minutes=DEFAULT_DURATION_MINUTES) if start else None
        )
        if start and end:
            blocks.append((start, end, str(ev.get("summary") or "Busy")))
    return blocks


def _overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end


def collect_busy_blocks(
    items: list[WorkflowItem],
    milestones: list[Milestone],
    external_events: list[dict[str, Any]],
) -> list[dict[str, str]]:
    raw: list[tuple[datetime, datetime, str]] = []
    for item in items:
        raw.extend(_busy_from_work_item(item))
    for ms in milestones:
        raw.extend(_busy_from_milestone(ms))
    raw.extend(_busy_from_external(external_events))
    raw.sort(key=lambda row: row[0])
    return [
        {
            "start": s.isoformat(),
            "end": e.isoformat(),
            "title": title,
        }
        for s, e, title in raw
    ]


def _task_nature_hint(title: str, description: str = "") -> str:
    text = f"{title} {description}".lower()
    if any(w in text for w in ("review", "approve", "sign-off", "feedback")):
        return "review"
    if any(w in text for w in ("meet", "call", "sync", "standup", "interview")):
        return "meeting"
    if any(w in text for w in ("deadline", "due", "submit", "launch", "ship")):
        return "deadline"
    if any(w in text for w in ("film", "shoot", "record", "edit", "produce")):
        return "production"
    return "task"


def smart_reply_message(nature: str, has_conflict: bool) -> str:
    base = {
        "review": "This looks like a review — here are open afternoon slots that avoid your calendar.",
        "meeting": "Scheduling a meeting — these slots keep buffer time around your other events.",
        "deadline": "Deadline-style task — earlier slots this week are suggested first.",
        "production": "Production work — longer morning blocks are prioritized.",
        "task": "Pick a time that fits your schedule, or choose a custom slot below.",
    }.get(nature, "Pick a time that fits your schedule, or choose a custom slot below.")
    if has_conflict:
        return f"{base} Some nearby times conflict with existing events — alternatives are highlighted."
    return base


def _preferred_hour_window(nature: str) -> tuple[int, int]:
    if nature == "review":
        return (13, 17)
    if nature == "meeting":
        return (10, 15)
    if nature == "deadline":
        return (9, 12)
    if nature == "production":
        return (9, 13)
    return (10, 16)


def suggest_time_slots(
    *,
    task_title: str,
    task_description: str = "",
    duration_minutes: int = DEFAULT_DURATION_MINUTES,
    preferred_date: str | None = None,
    items: list[WorkflowItem],
    milestones: list[Milestone],
    external_events: list[dict[str, Any]] | None = None,
    max_slots: int = MAX_SLOTS,
) -> dict[str, Any]:
    duration = max(15, min(duration_minutes, 240))
    nature = _task_nature_hint(task_title, task_description)
    win_start, win_end = _preferred_hour_window(nature)
    busy_raw: list[tuple[datetime, datetime, str]] = []
    for item in items:
        busy_raw.extend(_busy_from_work_item(item))
    for ms in milestones:
        busy_raw.extend(_busy_from_milestone(ms))
    busy_raw.extend(_busy_from_external(external_events or []))
    schedule_clear = len(busy_raw) == 0

    now = datetime.now(UTC)
    horizon_end = now + timedelta(days=HORIZON_DAYS)
    pref = _parse_dt(preferred_date)

    candidates: list[dict[str, Any]] = []
    day_cursor = now.date()
    end_date = horizon_end.date()

    while day_cursor <= end_date and len(candidates) < max_slots * 4:
        for hour in range(WORK_START_HOUR, WORK_END_HOUR):
            for minute in (0, 30):
                slot_start = datetime(
                    day_cursor.year,
                    day_cursor.month,
                    day_cursor.day,
                    hour,
                    minute,
                    tzinfo=UTC,
                )
                if slot_start < now:
                    continue
                slot_end = slot_start + timedelta(minutes=duration)
                if slot_end.hour > WORK_END_HOUR or (
                    slot_end.hour == WORK_END_HOUR and slot_end.minute > 0
                ):
                    continue

                conflict = (
                    False
                    if schedule_clear
                    else any(_overlaps(slot_start, slot_end, b0, b1) for b0, b1, _ in busy_raw)
                )
                in_preferred = win_start <= hour < win_end
                pref_bonus = 2.0 if pref and slot_start.date() == pref.date() else 0.0
                if pref and slot_start.date() == pref.date():
                    pref_bonus += 1.5
                nature_bonus = 1.0 if in_preferred else 0.0
                soon_bonus = max(0, 3.0 - (slot_start - now).total_seconds() / 86400)
                score = nature_bonus + pref_bonus + soon_bonus - (3.0 if conflict else 0)

                label = slot_start.strftime("%a %b %d · %I:%M %p").replace(" 0", " ")
                candidates.append(
                    {
                        "start": slot_start.isoformat(),
                        "end": slot_end.isoformat(),
                        "label": label,
                        "score": round(score, 2),
                        "conflict": conflict,
                        "recommended": in_preferred and not conflict,
                    }
                )

        day_cursor += timedelta(days=1)

    non_conflict = [c for c in candidates if not c["conflict"]]
    pool = non_conflict if len(non_conflict) >= max_slots else candidates
    pool.sort(key=lambda row: row["score"], reverse=True)
    slots = pool[:max_slots]
    has_conflict = any(c["conflict"] for c in candidates[:20])

    return {
        "nature": nature,
        "smart_reply": smart_reply_message(nature, has_conflict and not schedule_clear),
        "duration_minutes": duration,
        "slots": slots,
        "busy_blocks": collect_busy_blocks(items, milestones, external_events or []),
        "schedule_clear": schedule_clear,
    }
