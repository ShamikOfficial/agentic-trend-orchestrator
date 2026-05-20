"""Message timestamps for relative scheduling and task-extract context."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo


def parse_message_created_at(raw: Any, *, fallback: datetime | None = None) -> datetime:
    """Parse message created_at to UTC-aware datetime."""
    fallback = fallback or datetime.now(UTC)
    if raw is None or raw == "":
        return fallback
    if isinstance(raw, datetime):
        dt = raw
        return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)
    text = str(raw).strip()
    if not text:
        return fallback
    for candidate in (text, text.replace("Z", "+00:00")):
        try:
            dt = datetime.fromisoformat(candidate)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            return dt.astimezone(UTC)
        except ValueError:
            continue
    return fallback


def reference_datetime_for_suggestion(
    suggestion: dict[str, Any],
    batch_messages: list[dict] | None,
    *,
    fallback: datetime | None = None,
) -> datetime:
    """
    Use the latest source message's sent time as 'today' for relative phrases
    (tomorrow, next Tuesday, etc.) tied to that suggestion.
    """
    fallback = fallback or datetime.now(UTC)
    if not batch_messages:
        return fallback
    by_id = {str(m.get("message_id")): m for m in batch_messages if m.get("message_id")}
    candidates: list[datetime] = []
    for mid in suggestion.get("source_message_ids") or []:
        row = by_id.get(str(mid))
        if row:
            candidates.append(parse_message_created_at(row.get("created_at"), fallback=fallback))
    if not candidates and batch_messages:
        for row in batch_messages:
            candidates.append(parse_message_created_at(row.get("created_at"), fallback=fallback))
    return max(candidates) if candidates else fallback


def format_reference_label(dt: datetime, client_timezone: str | None = None) -> str:
    tz = ZoneInfo("UTC")
    if client_timezone:
        try:
            tz = ZoneInfo(client_timezone)
        except Exception:
            pass
    local = dt.astimezone(tz)
    return f"{local.isoformat(timespec='seconds')} ({local.strftime('%A')}, {local.tzname()})"
