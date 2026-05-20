from datetime import UTC, date, datetime

from backend.app.services.chat.message_timing import reference_datetime_for_suggestion
from backend.app.services.chat.schedule_extract import parse_date_from_text


def test_tomorrow_relative_to_message_sent_time():
    sent = datetime(2026, 5, 19, 7, 26, tzinfo=UTC)
    messages = [
        {
            "message_id": "msg_a",
            "created_at": sent.isoformat(),
            "content": "schedule pewdiepie tomorrow",
        }
    ]
    ref = reference_datetime_for_suggestion(
        {"source_message_ids": ["msg_a"]},
        messages,
    )
    assert ref == sent
    parsed = parse_date_from_text("tomorrow", now=ref)
    assert parsed == date(2026, 5, 20)
