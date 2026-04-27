from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.app.models.team import SourceType, Task, TaskStatus
from backend.app.services.team import service

router = APIRouter()

_summaries: dict[str, dict] = {}
_tasks: dict[str, Task] = {}
_note_logs: list[dict] = []


class SummarizeTeamContentRequest(BaseModel):
    source_type: SourceType
    content: str
    title: str | None = None


class ExtractTasksRequest(BaseModel):
    source_ref: str | None = None
    content: str | None = None
    owner_candidates: list[str] = Field(default_factory=list)
    default_due_days: int = 3


class UpdateTeamTaskRequest(BaseModel):
    owner: str | None = None
    status: TaskStatus | None = None
    due_date: str | None = None
    notes: str | None = None


class RunTeamRemindersRequest(BaseModel):
    window_hours: int = 24
    task_ids: list[str] = Field(default_factory=list)


class ProcessTeamInputRequest(BaseModel):
    source_type: SourceType = "meeting"
    content: str
    title: str | None = None
    owner_candidates: list[str] = Field(default_factory=list)
    default_due_days: int = 3


class TeamNoteLog(BaseModel):
    note_id: str
    raw_text: str
    category: str = "Notes"
    category_result: str = "unknown"
    source_type: SourceType = "meeting"
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ListTeamNotesResponse(BaseModel):
    items: list[TeamNoteLog]

@router.post("/team/summaries")
def summarize_team_content(payload: SummarizeTeamContentRequest) -> dict:
    _, _, summary, tasks = service.process_input_unified(
        content=payload.content,
        source_type=payload.source_type,
        title=payload.title,
        owner_candidates=[],
        default_due_days=3,
    )
    _summaries[summary.summary_id] = summary.model_dump()
    for task in tasks:
        _tasks[task.task_id] = task
    return summary.model_dump()


@router.post("/team/tasks/extract")
def extract_tasks(payload: ExtractTasksRequest) -> dict:
    content = payload.content
    if not content and payload.source_ref:
        source = _summaries.get(payload.source_ref)
        if source:
            content = source.get("summary")
    if not content:
        raise HTTPException(status_code=400, detail="content or valid source_ref is required.")

    _, _, _, tasks = service.process_input_unified(
        content=content,
        source_type="meeting",
        title=None,
        owner_candidates=payload.owner_candidates,
        default_due_days=payload.default_due_days,
    )
    for task in tasks:
        _tasks[task.task_id] = task
    return {"tasks": [task.model_dump(mode="json") for task in tasks]}


@router.post("/team/process")
def process_team_input(payload: ProcessTeamInputRequest) -> dict:
    category, category_result, summary, tasks = service.process_input_unified(
        content=payload.content,
        source_type=payload.source_type,
        title=payload.title,
        owner_candidates=payload.owner_candidates,
        default_due_days=payload.default_due_days,
    )
    note_log = TeamNoteLog(
        note_id=service._make_id("note"),
        raw_text=payload.content,
        category=category,
        category_result=category_result,
        source_type=payload.source_type,
    )
    _note_logs.insert(0, note_log.model_dump(mode="json"))

    _summaries[summary.summary_id] = summary.model_dump()
    for task in tasks:
        _tasks[task.task_id] = task
    return {
        "note_log": note_log.model_dump(mode="json"),
        "summary": summary.model_dump(mode="json"),
        "tasks": [task.model_dump(mode="json") for task in tasks],
    }


@router.get("/team/notes/logs")
def list_team_notes_logs() -> ListTeamNotesResponse:
    return ListTeamNotesResponse(items=[TeamNoteLog(**item) for item in _note_logs])


@router.get("/team/tasks")
def list_tasks() -> dict:
    items = [task.model_dump(mode="json") for task in _tasks.values()]
    return {"items": items, "total": len(items)}


@router.patch("/team/tasks/{task_id}")
def update_task(task_id: str, payload: UpdateTeamTaskRequest) -> dict:
    existing = _tasks.get(task_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Task not found: {task_id}")

    updates = payload.model_dump(exclude_none=True)
    if "due_date" in updates and updates["due_date"]:
        # Keep date parsing simple and explicit.
        updates["due_date"] = datetime.fromisoformat(f"{updates['due_date']}T00:00:00+00:00").date()

    updated = service.update_task(existing, **updates)
    _tasks[task_id] = updated
    return {"task_id": task_id, "updated": True}


@router.post("/team/reminders/run")
def run_deadline_reminders(payload: RunTeamRemindersRequest) -> dict:
    scope = list(_tasks.values())
    if payload.task_ids:
        scope = [task for task in scope if task.task_id in set(payload.task_ids)]
    reminders = service.run_deadline_reminders(scope, window_hours=payload.window_hours)
    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "reminders": [item.model_dump(mode="json") for item in reminders],
    }
