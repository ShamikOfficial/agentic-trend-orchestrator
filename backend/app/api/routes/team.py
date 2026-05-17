from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.app.api.deps import current_user_id
from backend.app.llm import LlmError, LlmQuotaError
from backend.app.models.team import SourceType, Task, TaskStatus
from backend.app.persistence import team_repo
from backend.app.services.team import service

router = APIRouter()


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


def _llm_http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, LlmQuotaError):
        return HTTPException(
            status_code=429,
            detail={
                "detail": str(exc),
                "tokens_used": exc.tokens_used,
                "token_budget": exc.token_budget,
            },
        )
    if isinstance(exc, LlmError):
        return HTTPException(status_code=503, detail=str(exc))
    raise exc


@router.post("/team/summaries")
def summarize_team_content(payload: SummarizeTeamContentRequest, request: Request) -> dict:
    user_id = current_user_id(request)
    try:
        _, _, summary, tasks = service.process_input_unified(
            content=payload.content,
            source_type=payload.source_type,
            title=payload.title,
            owner_candidates=[],
            default_due_days=3,
            user_id=user_id,
        )
    except (LlmError, LlmQuotaError) as exc:
        raise _llm_http_error(exc) from exc
    team_repo.save_summary(summary.model_dump())
    for task in tasks:
        team_repo.save_task(task)
    return summary.model_dump()


@router.post("/team/tasks/extract")
def extract_tasks(payload: ExtractTasksRequest, request: Request) -> dict:
    user_id = current_user_id(request)
    content = payload.content
    if not content and payload.source_ref:
        source = team_repo.get_summary(payload.source_ref)
        if source:
            content = source.get("summary")
    if not content:
        raise HTTPException(status_code=400, detail="content or valid source_ref is required.")

    try:
        _, _, _, tasks = service.process_input_unified(
            content=content,
            source_type="meeting",
            title=None,
            owner_candidates=payload.owner_candidates,
            default_due_days=payload.default_due_days,
            user_id=user_id,
        )
    except (LlmError, LlmQuotaError) as exc:
        raise _llm_http_error(exc) from exc
    for task in tasks:
        team_repo.save_task(task)
    return {"tasks": [task.model_dump(mode="json") for task in tasks]}


@router.post("/team/process")
def process_team_input(payload: ProcessTeamInputRequest, request: Request) -> dict:
    user_id = current_user_id(request)
    try:
        category, category_result, summary, tasks = service.process_input_unified(
            content=payload.content,
            source_type=payload.source_type,
            title=payload.title,
            owner_candidates=payload.owner_candidates,
            default_due_days=payload.default_due_days,
            user_id=user_id,
        )
    except (LlmError, LlmQuotaError) as exc:
        raise _llm_http_error(exc) from exc
    note_log = TeamNoteLog(
        note_id=service._make_id("note"),
        raw_text=payload.content,
        category=category,
        category_result=category_result,
        source_type=payload.source_type,
    )
    team_repo.prepend_note_log(note_log.model_dump(mode="json"))
    team_repo.save_summary(summary.model_dump())
    for task in tasks:
        team_repo.save_task(task)
    return {
        "note_log": note_log.model_dump(mode="json"),
        "summary": summary.model_dump(mode="json"),
        "tasks": [task.model_dump(mode="json") for task in tasks],
    }


@router.get("/team/notes/logs")
def list_team_notes_logs(request: Request) -> ListTeamNotesResponse:
    current_user_id(request)
    return ListTeamNotesResponse(items=[TeamNoteLog(**item) for item in team_repo.list_note_logs()])


@router.get("/team/tasks")
def list_tasks(request: Request) -> dict:
    current_user_id(request)
    items = [task.model_dump(mode="json") for task in team_repo.list_tasks()]
    return {"items": items, "total": len(items)}


@router.patch("/team/tasks/{task_id}")
def update_task(task_id: str, payload: UpdateTeamTaskRequest, request: Request) -> dict:
    current_user_id(request)
    existing = team_repo.get_task(task_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Task not found: {task_id}")

    updates = payload.model_dump(exclude_none=True)
    if "due_date" in updates and updates["due_date"]:
        updates["due_date"] = datetime.fromisoformat(f"{updates['due_date']}T00:00:00+00:00").date()

    updated = service.update_task(existing, **updates)
    team_repo.save_task(updated)
    return {"task_id": task_id, "updated": True}


@router.post("/team/reminders/run")
def run_deadline_reminders(payload: RunTeamRemindersRequest, request: Request) -> dict:
    current_user_id(request)
    scope = team_repo.list_tasks()
    if payload.task_ids:
        scope = [task for task in scope if task.task_id in set(payload.task_ids)]
    reminders = service.run_deadline_reminders(scope, window_hours=payload.window_hours)
    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "reminders": [item.model_dump(mode="json") for item in reminders],
    }
