from datetime import date, timedelta

from backend.app.models.team import Task
from backend.app.services.team.service import (
    extract_tasks,
    run_deadline_reminders,
    summarize_content,
)
from backend.app.services.workflow.service import (
    create_milestone,
    create_workflow_item,
    move_stage,
)


def test_summarize_content_has_preview_items() -> None:
    content = """
    We reviewed the weekly plan.
    Action: Draft concept brief tomorrow
    TODO: Finalize shot list ASAP
    """
    summary = summarize_content(content, source_type="meeting", title="Weekly sync")
    assert summary.summary
    assert len(summary.action_items_preview) == 2


def test_extract_tasks_assigns_owner_and_due_date() -> None:
    content = """
    Action: Shamik prepare trend shortlist tomorrow
    - finalize storyboard ASAP
    """
    tasks = extract_tasks(content, owner_candidates=["Shamik", "Batu"], default_due_days=3)
    assert len(tasks) == 2
    assert tasks[0].owner == "Shamik"
    assert tasks[1].priority == "high"


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
