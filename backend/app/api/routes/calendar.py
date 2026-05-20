from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any
from urllib.error import URLError
from urllib.request import Request as UrlRequest, urlopen

from fastapi import APIRouter, Header, HTTPException, Request
from icalendar import Calendar
from pydantic import BaseModel, Field

from backend.app import auth_state

router = APIRouter()

_MAX_ICS_BYTES = 2 * 1024 * 1024
_FETCH_TIMEOUT_SEC = 15


class FetchIcsRequest(BaseModel):
    ics_url: str | None = Field(default=None, max_length=2048)
    ics_text: str | None = Field(default=None, max_length=_MAX_ICS_BYTES)


def _legacy_user(x_auth_token: str | None, request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return str(user_id)
    if not x_auth_token:
        raise HTTPException(status_code=401, detail="Missing auth token.")
    resolved = auth_state.resolve_user_from_token(x_auth_token)
    if not resolved:
        raise HTTPException(status_code=401, detail="Invalid or expired auth token.")
    return resolved


def _normalize_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if hasattr(value, "dt"):
        value = value.dt
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
    return None


def _parse_ics_bytes(raw: bytes) -> list[dict[str, str]]:
    cal = Calendar.from_ical(raw)
    events: list[dict[str, str]] = []
    for component in cal.walk():
        if component.name != "VEVENT":
            continue
        start = _normalize_dt(component.get("dtstart"))
        end = _normalize_dt(component.get("dtend")) or start
        if not start:
            continue
        summary = str(component.get("summary") or "Busy").strip() or "Busy"
        events.append(
            {
                "summary": summary[:200],
                "start": start.isoformat(),
                "end": (end or start).isoformat(),
                "all_day": "T" if start.hour == 0 and start.minute == 0 and not component.get("dtend") else "F",
            }
        )
    events.sort(key=lambda row: row["start"])
    return events


def _load_ics_text(payload: FetchIcsRequest) -> str:
    if payload.ics_text and payload.ics_text.strip():
        return payload.ics_text.strip()
    url = (payload.ics_url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="Provide ics_url or ics_text.")
    if not re.match(r"^https?://", url, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="ics_url must be http or https.")
    try:
        req = UrlRequest(url, headers={"User-Agent": "TrendPilot-Calendar/1.0"})
        with urlopen(req, timeout=_FETCH_TIMEOUT_SEC) as response:
            raw = response.read(_MAX_ICS_BYTES + 1)
    except URLError as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch calendar URL: {exc}") from exc
    if len(raw) > _MAX_ICS_BYTES:
        raise HTTPException(status_code=413, detail="Calendar feed too large.")
    return raw.decode("utf-8", errors="replace")


@router.post("/calendar/fetch-ics")
def fetch_ics(
    payload: FetchIcsRequest,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    _legacy_user(x_auth_token, request)
    text = _load_ics_text(payload)
    try:
        events = _parse_ics_bytes(text.encode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid ICS calendar: {exc}") from exc
    return {"event_count": len(events), "events": events}
