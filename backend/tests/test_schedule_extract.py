from datetime import UTC, datetime

from backend.app.services.chat.schedule_extract import (
    enrich_suggestion_schedule,
    parse_date_from_text,
    suggestion_has_complete_schedule,
)


def test_parse_next_monday_from_friday():
    # 2026-05-15 is Friday
    ref = datetime(2026, 5, 15, 12, 0, tzinfo=UTC)
    assert parse_date_from_text("schedule a meeting on next monday", now=ref) == datetime(
        2026, 5, 18, tzinfo=UTC
    ).date()


def test_parse_next_monday_when_today_is_monday():
    ref = datetime(2026, 5, 18, 12, 0, tzinfo=UTC)  # Monday
    assert parse_date_from_text("next monday", now=ref) == datetime(2026, 5, 25, tzinfo=UTC).date()


def test_enrich_meeting_without_explicit_time():
    ref = datetime(2026, 5, 15, 12, 0, tzinfo=UTC)
    raw = {
        "action": "create",
        "title": "Meeting with Ram — new project plan v3",
        "description": "Discuss new project plan v3",
        "reasoning": "User asked to schedule a meeting with Ram on next Monday",
        "update_fields": {},
    }
    out = enrich_suggestion_schedule(
        raw,
        message_context="schedule a meeting with ram on next monday for discussing new project plan v3",
        now=ref,
    )
    assert suggestion_has_complete_schedule(out)
    uf = out["update_fields"]
    assert uf["due_date"] == "2026-05-18"
    assert uf["scheduled_start"].startswith("2026-05-18T10:00:00")


def test_parse_on_next_tuesday():
    ref = datetime(2026, 5, 18, 12, 0, tzinfo=UTC)  # Monday
    assert parse_date_from_text("on next Tuesday", now=ref) == datetime(2026, 5, 19, tzinfo=UTC).date()


def test_enrich_from_update_fields_description():
    ref = datetime(2026, 5, 15, 12, 0, tzinfo=UTC)
    raw = {
        "action": "update",
        "existing_item_id": "item_1",
        "reasoning": "User moved meeting to next Monday",
        "update_fields": {
            "description": "Schedule a meeting with Ram on next Monday for discussing new project plan v3.",
        },
    }
    out = enrich_suggestion_schedule(raw, now=ref)
    assert suggestion_has_complete_schedule(out)
    assert out["update_fields"]["due_date"] == "2026-05-18"


def test_enrich_respects_explicit_time():
    ref = datetime(2026, 5, 15, 12, 0, tzinfo=UTC)
    raw = {
        "action": "create",
        "title": "Sync with Ram",
        "description": "tomorrow at 3pm",
        "update_fields": {},
    }
    out = enrich_suggestion_schedule(raw, now=ref)
    uf = out["update_fields"]
    assert uf["due_date"] == "2026-05-16"
    assert "T15:00:00" in uf["scheduled_start"]
