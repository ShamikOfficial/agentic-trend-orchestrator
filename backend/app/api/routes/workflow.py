from datetime import UTC, date, datetime
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from backend.app.models.workflow import Milestone, MilestoneStatus, WorkflowItem, WorkflowStage
from backend.app.services.workflow import service

router = APIRouter()

_workflow_items: dict[str, WorkflowItem] = {}
_milestones: dict[str, Milestone] = {}
_workflow_activity_logs: list[dict] = []
_uploads_dir = Path("uploads")
_uploads_dir.mkdir(parents=True, exist_ok=True)


class CreateWorkflowItemRequest(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""
    owner: str | None = None
    linked_trend: str | None = None
    project: str = "General"
    stage: WorkflowStage = "Idea"
    due_date: date | None = None
    comments: list[str] = Field(default_factory=list)
    links: list[str] = Field(default_factory=list)
    attachments: list[str] = Field(default_factory=list)


class ListWorkflowItemsResponse(BaseModel):
    items: list[WorkflowItem]


class WorkflowActivityLog(BaseModel):
    log_id: str
    action: str
    item_id: str | None = None
    item_title: str | None = None
    details: str
    actor: str = "default_user"
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ListWorkflowActivityResponse(BaseModel):
    items: list[WorkflowActivityLog]


class UpdateWorkflowStageRequest(BaseModel):
    to_stage: WorkflowStage
    note: str | None = None


class UpdateWorkflowStageResponse(BaseModel):
    item_id: str
    from_stage: WorkflowStage
    to_stage: WorkflowStage
    updated: bool


class UpdateWorkflowItemRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1)
    description: str | None = None
    owner: str | None = None
    linked_trend: str | None = None
    project: str | None = None
    due_date: date | None = None
    comments: list[str] | None = None
    links: list[str] | None = None
    attachments: list[str] | None = None


class UploadAttachmentResponse(BaseModel):
    name: str
    url: str


class CreateMilestoneRequest(BaseModel):
    item_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    owner: str | None = None
    due_date: date | None = None
    criteria: list[str] = Field(default_factory=list)


class UpdateMilestoneRequest(BaseModel):
    status: MilestoneStatus | None = None
    owner: str | None = None
    due_date: date | None = None
    notes: str | None = None


def _append_activity(
    action: str,
    details: str,
    item_id: str | None = None,
    item_title: str | None = None,
) -> None:
    _workflow_activity_logs.insert(
        0,
        WorkflowActivityLog(
            log_id=service._make_id("log"),
            action=action,
            item_id=item_id,
            item_title=item_title,
            details=details,
        ).model_dump(),
    )


@router.post("/workflow/items")
def create_workflow_item(payload: CreateWorkflowItemRequest) -> dict:
    item = service.create_workflow_item(
        title=payload.title,
        description=payload.description,
        owner=payload.owner,
        linked_trend=payload.linked_trend,
        project=payload.project,
        stage=payload.stage,
        due_date=payload.due_date,
        comments=payload.comments,
        links=payload.links,
        attachments=payload.attachments,
    )
    _workflow_items[item.item_id] = item
    _append_activity(
        action="create_item",
        details=f"Created item in {item.stage}",
        item_id=item.item_id,
        item_title=item.title,
    )
    return {"item_id": item.item_id, "stage": item.stage}


@router.post("/workflow/uploads")
async def upload_workflow_attachment(file: UploadFile = File(...)) -> UploadAttachmentResponse:
    extension = Path(file.filename or "").suffix
    saved_name = f"{service._make_id('att')}{extension}"
    destination = _uploads_dir / saved_name
    content = await file.read()
    destination.write_bytes(content)
    return UploadAttachmentResponse(name=file.filename or saved_name, url=f"/uploads/{saved_name}")


@router.get("/workflow/items")
def list_workflow_items() -> ListWorkflowItemsResponse:
    return ListWorkflowItemsResponse(items=list(_workflow_items.values()))


@router.get("/workflow/items/{item_id}")
def get_workflow_item(item_id: str) -> WorkflowItem:
    item = _workflow_items.get(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Workflow item not found: {item_id}")
    return item


@router.get("/workflow/logs")
def list_workflow_logs() -> ListWorkflowActivityResponse:
    return ListWorkflowActivityResponse(items=[WorkflowActivityLog(**row) for row in _workflow_activity_logs])


@router.patch("/workflow/items/{item_id}")
def update_workflow_item(item_id: str, payload: UpdateWorkflowItemRequest) -> dict:
    existing = _workflow_items.get(item_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Workflow item not found: {item_id}")

    data = existing.model_dump()
    updates = payload.model_dump(exclude_none=True)
    data.update(updates)
    updated = WorkflowItem(**data)
    _workflow_items[item_id] = updated
    _append_activity(
        action="update_item",
        details="Updated workflow item fields",
        item_id=item_id,
        item_title=updated.title,
    )
    return {"item_id": item_id, "updated": True}


@router.delete("/workflow/items/{item_id}")
def delete_workflow_item(item_id: str) -> dict:
    removed = _workflow_items.pop(item_id, None)
    if removed is None:
        raise HTTPException(status_code=404, detail=f"Workflow item not found: {item_id}")

    for milestone_id, milestone in list(_milestones.items()):
        if milestone.item_id == item_id:
            _milestones.pop(milestone_id, None)
    _append_activity(
        action="delete_item",
        details="Deleted workflow item",
        item_id=item_id,
        item_title=removed.title,
    )
    return {"item_id": item_id, "deleted": True}


@router.patch("/workflow/items/{item_id}/stage")
def update_workflow_stage(item_id: str, payload: UpdateWorkflowStageRequest) -> UpdateWorkflowStageResponse:
    existing = _workflow_items.get(item_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Workflow item not found: {item_id}")

    from_stage = existing.stage
    try:
        updated = service.move_stage(existing, to_stage=payload.to_stage, note=payload.note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    _workflow_items[item_id] = updated
    _append_activity(
        action="move_stage",
        details=f"Moved stage {from_stage} -> {updated.stage}",
        item_id=item_id,
        item_title=updated.title,
    )
    return UpdateWorkflowStageResponse(
        item_id=item_id,
        from_stage=from_stage,
        to_stage=updated.stage,
        updated=True,
    )


@router.post("/workflow/milestones")
def create_milestone(payload: CreateMilestoneRequest) -> dict:
    if payload.item_id not in _workflow_items:
        raise HTTPException(status_code=404, detail=f"Workflow item not found: {payload.item_id}")

    milestone = service.create_milestone(
        item_id=payload.item_id,
        title=payload.title,
        owner=payload.owner,
        due_date=payload.due_date,
        criteria=payload.criteria,
    )
    _milestones[milestone.milestone_id] = milestone
    _append_activity(
        action="create_milestone",
        details=f'Created milestone "{milestone.title}"',
        item_id=payload.item_id,
    )
    return {"milestone_id": milestone.milestone_id, "status": milestone.status}


@router.patch("/workflow/milestones/{milestone_id}")
def update_milestone(milestone_id: str, payload: UpdateMilestoneRequest) -> dict:
    existing = _milestones.get(milestone_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Milestone not found: {milestone_id}")

    updated = service.update_milestone(existing, **payload.model_dump())
    _milestones[milestone_id] = updated
    _append_activity(
        action="update_milestone",
        details="Updated milestone fields",
        item_id=updated.item_id,
    )
    return {"milestone_id": milestone_id, "updated": True}
