from datetime import UTC, date, datetime

from backend.app.models.workflow import WorkflowItem
from backend.app.services.chat.task_dedupe import collapse_updates_per_item, filter_novel_suggestions


def test_skips_redundant_update():
    existing = WorkflowItem(
        item_id="item_1",
        title="Meeting with Ram",
        due_date=date(2026, 5, 18),
        scheduled_start=datetime(2026, 5, 18, 10, 0, tzinfo=UTC),
        scheduled_end=datetime(2026, 5, 18, 11, 0, tzinfo=UTC),
    )
    suggestions = [
        {
            "action": "update",
            "existing_item_id": "item_1",
            "update_fields": {
                "due_date": "2026-05-18",
                "scheduled_start": "2026-05-18T10:00:00+00:00",
                "scheduled_end": "2026-05-18T11:00:00+00:00",
            },
        }
    ]
    assert filter_novel_suggestions(suggestions, [existing]) == []


def test_keeps_meaningful_update():
    existing = WorkflowItem(
        item_id="item_1",
        title="Meeting with Ram",
        due_date=date(2026, 5, 18),
    )
    suggestions = [
        {
            "action": "update",
            "existing_item_id": "item_1",
            "update_fields": {"due_date": "2026-05-25"},
        }
    ]
    out = filter_novel_suggestions(suggestions, [existing])
    assert len(out) == 1


def test_skips_rephrased_description_same_schedule():
    existing = WorkflowItem(
        item_id="wf_1",
        title="Consultant interview",
        description="Set up consultant interview on 2026-05-21.",
        due_date=date(2026, 5, 21),
        scheduled_start=datetime(2026, 5, 21, 17, 0, tzinfo=UTC),
        scheduled_end=datetime(2026, 5, 21, 18, 0, tzinfo=UTC),
        source_last_message_id="msg_10",
        source_message_ids=["msg_10"],
    )
    suggestions = [
        {
            "action": "update",
            "existing_item_id": "wf_1",
            "source_message_id": "msg_10",
            "update_fields": {
                "description": "Set up an event for a consultant interview on 2026-05-21.",
                "due_date": "2026-05-21",
                "scheduled_start": "2026-05-21T17:00:00+00:00",
                "scheduled_end": "2026-05-21T18:00:00+00:00",
            },
        }
    ]
    order = {"msg_10": 5, "msg_11": 6}
    assert filter_novel_suggestions(suggestions, [existing], message_order=order) == []


def test_collapse_keeps_last_update_per_item():
    suggestions = [
        {"action": "update", "existing_item_id": "wf_ram", "update_fields": {"description": "Monday"}},
        {"action": "update", "existing_item_id": "wf_ram", "update_fields": {"description": "Tuesday"}},
        {"action": "update", "existing_item_id": "wf_ram", "update_fields": {"description": "Wednesday"}},
    ]
    out = collapse_updates_per_item(suggestions)
    assert len(out) == 1
    assert "Wednesday" in out[0]["update_fields"]["description"]


def test_skips_update_on_publish_stage():
    existing = WorkflowItem(
        item_id="wf_pub",
        title="Pewdiepie meet",
        stage="Publish",
        description="Done",
    )
    suggestions = [
        {
            "action": "update",
            "existing_item_id": "wf_pub",
            "update_fields": {"description": "Schedule for tomorrow"},
        }
    ]
    assert filter_novel_suggestions(suggestions, [existing]) == []


def test_skips_when_due_date_and_description_already_saved():
    existing = WorkflowItem(
        item_id="wf_d8375c12",
        title="Consultant interview",
        due_date=date(2026, 5, 21),
        description="Set up an event for a consultant interview on 2026-05-21.",
    )
    suggestions = [
        {
            "action": "update",
            "existing_item_id": "wf_d8375c12",
            "description": "Set up an event for a consultant interview on 2026-05-21.",
            "update_fields": {
                "due_date": "2026-05-21",
                "scheduled_start": "2026-05-21T17:00:00+00:00",
                "scheduled_end": "2026-05-21T18:00:00+00:00",
            },
        }
    ]
    assert filter_novel_suggestions(suggestions, [existing]) == []


def test_skips_update_when_same_message_already_applied():
    existing = WorkflowItem(
        item_id="wf_2",
        title="Pewdiepie meeting",
        description="Schedule meeting with Pewdiepie for tomorrow.",
        due_date=date(2026, 5, 21),
        source_last_message_id="msg_20",
        source_message_ids=["msg_20"],
    )
    suggestions = [
        {
            "action": "update",
            "existing_item_id": "wf_2",
            "source_message_id": "msg_20",
            "update_fields": {
                "description": "Schedule a meeting with Pewdiepie for tomorrow.",
                "due_date": "2026-05-21",
            },
        }
    ]
    assert filter_novel_suggestions(suggestions, [existing]) == []


def test_drop_updates_when_close_present():
    existing = WorkflowItem(item_id="wf_ram", title="Ram meet")
    suggestions = [
        {"action": "close", "existing_item_id": "wf_ram"},
        {"action": "update", "existing_item_id": "wf_ram", "update_fields": {"description": "x"}},
    ]
    out = filter_novel_suggestions(suggestions, [existing])
    assert len(out) == 1
    assert out[0]["action"] == "close"
