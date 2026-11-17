from datetime import date, timedelta
from unittest.mock import patch

from backend.app.models.team import Task
from backend.app.services.team.service import (
    process_input_unified,
    run_deadline_reminders,
)
from backend.app.services.workflow.service import (
    create_milestone,
    create_workflow_item,
    move_stage,
)


def test_process_input_unified_fallback_without_llm() -> None:
    content = """
    We reviewed the weekly plan.
    Action: Draft concept brief tomorrow
    TODO: Finalize shot list ASAP
    """
    with patch(
        "backend.app.services.team.service.generate_text",
        side_effect=RuntimeError("no llm in ci"),
    ):
        category, category_result, summary, tasks = process_input_unified(
            content,
            source_type="meeting",
            title="Weekly sync",
            owner_candidates=["Shamik", "Batu"],
            default_due_days=3,
        )
    assert category
    assert category_result
    assert summary.summary
    assert isinstance(tasks, list)


def test_deadline_reminders_include_due_soon() -> None:
    task = Task(task_id="t1", title="Do thing", due_date=date.today() + timedelta(days=1))
    reminders = run_deadline_reminders([task], window_hours=24)
    assert len(reminders) == 1
    assert reminders[0].severity in {"due_soon", "overdue"}


def test_workflow_move_stage_and_milestone() -> None:
    item = create_workflow_item(title="Draft reel")
    moved = move_stage(item, "Brief")
    assert moved.stage == "Brief"

    milestone = create_milestone(item_id=moved.item_id, title="Script lock")
    assert milestone.item_id == moved.item_id
