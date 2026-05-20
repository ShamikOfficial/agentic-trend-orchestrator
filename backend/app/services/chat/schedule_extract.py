"""Parse dates/times from task text and normalize LLM schedule fields on suggestions."""

from __future__ import annotations

import os
import re
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from backend.app.services.chat.message_timing import reference_datetime_for_suggestion

DEFAULT_MEETING_HOUR = 10
DEFAULT_MEETING_MINUTE = 0
DEFAULT_DURATION_MINUTES = 60


def _default_schedule_timezone() -> ZoneInfo:
    name = os.getenv("APP_TIMEZONE", "").strip()
    if name:
        try:
            return ZoneInfo(name)
        except Exception:
            pass
    local = datetime.now().astimezone().tzinfo
    if isinstance(local, ZoneInfo):
        return local
    return ZoneInfo("UTC")

_WEEKDAYS = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

_TIME_AT = re.compile(
    r"\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b",
    re.IGNORECASE,
)
_TIME_24 = re.compile(r"\b([01]?\d|2[0-3]):([0-5]\d)\b")
_ISO_DATE = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")
_ON_NEXT_WEEKDAY = re.compile(
    r"\bon\s+next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
    re.IGNORECASE,
)
_NEXT_WEEKDAY = re.compile(
    r"\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
    re.IGNORECASE,
)
_THIS_WEEKDAY = re.compile(
    r"\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
    re.IGNORECASE,
)
_ON_WEEKDAY = re.compile(
    r"\bon\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
    re.IGNORECASE,
)
_PLAIN_WEEKDAY = re.compile(
    r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
    re.IGNORECASE,
)


def _parse_iso_datetime(raw: str, *, schedule_tz: ZoneInfo | None = None) -> datetime | None:
    if not raw or not str(raw).strip():
        return None
    text = str(raw).strip()
    for candidate in (
        text,
        text.replace("Z", "+00:00"),
        text.replace(" ", "T") + "+00:00" if "T" not in text and len(text) >= 10 else text,
    ):
        try:
            if len(candidate) == 10:
                day = date.fromisoformat(candidate)
                tz = schedule_tz or _default_schedule_timezone()
                dt = datetime(
                    day.year,
                    day.month,
                    day.day,
                    DEFAULT_MEETING_HOUR,
                    DEFAULT_MEETING_MINUTE,
                    tzinfo=tz,
                ).astimezone(UTC)
            else:
                dt = datetime.fromisoformat(candidate)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            return dt.astimezone(UTC)
        except ValueError:
            continue
    return None


def _parse_time_from_text(text: str) -> tuple[int, int] | None:
    match = _TIME_AT.search(text)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        ampm = match.group(3).lower()
        if ampm == "pm" and hour != 12:
            hour += 12
        elif ampm == "am" and hour == 12:
            hour = 0
        return hour, minute
    match24 = _TIME_24.search(text)
    if match24:
        return int(match24.group(1)), int(match24.group(2))
    return None


def _resolve_weekday(name: str, today: date, *, force_next: bool) -> date:
    weekday = _WEEKDAYS[name.lower()]
    days_ahead = (weekday - today.weekday()) % 7
    if force_next or days_ahead == 0:
        if days_ahead == 0:
            days_ahead = 7
    return today + timedelta(days=days_ahead)


def parse_date_from_text(text: str, *, now: datetime | None = None) -> date | None:
    """Best-effort relative/absolute date from natural language."""
    if not text or not text.strip():
        return None
    now = now or datetime.now(UTC)
    today = now.date()
    lower = text.lower()

    iso = _ISO_DATE.search(text)
    if iso:
        try:
            return date.fromisoformat(iso.group(1))
        except ValueError:
            pass

    if re.search(r"\btoday\b", lower):
        return today
    if re.search(r"\btomorrow\b", lower):
        return today + timedelta(days=1)
    if re.search(r"\btonight\b", lower):
        return today

    for pattern, force_next in (
        (_ON_NEXT_WEEKDAY, True),
        (_NEXT_WEEKDAY, True),
        (_THIS_WEEKDAY, False),
        (_ON_WEEKDAY, False),
    ):
        match = pattern.search(text)
        if match:
            return _resolve_weekday(match.group(1), today, force_next=force_next)

    match = _PLAIN_WEEKDAY.search(text)
    if match:
        return _resolve_weekday(match.group(1), today, force_next=False)

    return None


def build_schedule_fields(
    day: date,
    *,
    hour: int = DEFAULT_MEETING_HOUR,
    minute: int = DEFAULT_MEETING_MINUTE,
    duration_minutes: int = DEFAULT_DURATION_MINUTES,
    schedule_tz: ZoneInfo | None = None,
) -> dict[str, str]:
    tz = schedule_tz or _default_schedule_timezone()
    start = datetime(day.year, day.month, day.day, hour, minute, tzinfo=tz).astimezone(UTC)
    end = start + timedelta(minutes=duration_minutes)
    return {
        "due_date": day.isoformat(),
        "scheduled_start": start.isoformat(),
        "scheduled_end": end.isoformat(),
    }


def _is_meeting_like(text: str) -> bool:
    lower = text.lower()
    return any(
        w in lower
        for w in ("meet", "call", "sync", "standup", "interview", "schedule", "appointment")
    )


def _has_date_hint(text: str) -> bool:
    lower = text.lower()
    if parse_date_from_text(text):
        return True
    return bool(
        _TIME_AT.search(text)
        or _PLAIN_WEEKDAY.search(lower)
        or re.search(r"\b(today|tomorrow|tonight|next week)\b", lower)
    )


def _combined_suggestion_text(
    suggestion: dict[str, Any],
    extra_context: str = "",
    *,
    batch_messages: list[dict] | None = None,
) -> str:
    parts = [
        str(suggestion.get("title") or ""),
        str(suggestion.get("description") or ""),
        str(suggestion.get("reasoning") or ""),
        extra_context,
    ]
    uf = suggestion.get("update_fields")
    if isinstance(uf, dict):
        for key, val in uf.items():
            if val is not None and str(val).strip():
                parts.append(str(val))
    if batch_messages:
        by_id = {str(m.get("message_id")): m for m in batch_messages if m.get("message_id")}
        for mid in suggestion.get("source_message_ids") or []:
            row = by_id.get(str(mid))
            if row:
                parts.append(str(row.get("content") or ""))
    return " ".join(p for p in parts if p).strip()


def suggestion_has_complete_schedule(suggestion: dict[str, Any]) -> bool:
    uf = suggestion.get("update_fields")
    if not isinstance(uf, dict):
        return False
    start = _parse_iso_datetime(str(uf.get("scheduled_start") or ""))
    end = _parse_iso_datetime(str(uf.get("scheduled_end") or ""))
    return start is not None and end is not None and end > start


def enrich_suggestion_schedule(
    suggestion: dict[str, Any],
    *,
    message_context: str = "",
    batch_messages: list[dict] | None = None,
    now: datetime | None = None,
    schedule_tz: ZoneInfo | None = None,
) -> dict[str, Any]:
    """Fill update_fields with due_date / scheduled_start / end when text mentions a date."""
    if suggestion.get("action") not in ("create", "update"):
        return suggestion

    ref_now = reference_datetime_for_suggestion(
        suggestion,
        batch_messages,
        fallback=now or datetime.now(UTC),
    )
    out = dict(suggestion)
    uf = dict(out.get("update_fields") or {}) if isinstance(out.get("update_fields"), dict) else {}

    text = _combined_suggestion_text(
        out,
        message_context,
        batch_messages=batch_messages,
    )
    parsed_day: date | None = None
    if uf.get("due_date"):
        try:
            parsed_day = date.fromisoformat(str(uf["due_date"])[:10])
        except ValueError:
            parsed_day = None
    if not parsed_day:
        parsed_day = parse_date_from_text(text, now=ref_now)

    if not parsed_day:
        out["update_fields"] = uf
        return out

    hour, minute = DEFAULT_MEETING_HOUR, DEFAULT_MEETING_MINUTE
    parsed_time = _parse_time_from_text(text)
    if parsed_time:
        hour, minute = parsed_time
    elif _is_meeting_like(text) or _has_date_hint(text):
        hour, minute = DEFAULT_MEETING_HOUR, DEFAULT_MEETING_MINUTE

    fields = build_schedule_fields(parsed_day, hour=hour, minute=minute, schedule_tz=schedule_tz)
    uf.update(fields)
    out["update_fields"] = uf
    return out


def enrich_suggestions_schedules(
    suggestions: list[dict[str, Any]],
    *,
    message_context: str = "",
    batch_messages: list[dict] | None = None,
    now: datetime | None = None,
    schedule_tz: ZoneInfo | None = None,
) -> list[dict[str, Any]]:
    return [
        enrich_suggestion_schedule(
            s,
            message_context=message_context,
            batch_messages=batch_messages,
            now=now,
            schedule_tz=schedule_tz,
        )
        for s in suggestions
    ]
