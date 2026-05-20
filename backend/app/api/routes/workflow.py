from datetime import UTC, date, datetime
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from backend.app.api.deps import current_user_id
from backend.app.models.workflow import Milestone, MilestoneStatus, WorkflowItem, WorkflowStage
from backend.app.persistence import workflow_repo
from backend.app.services.workflow import service

router = APIRouter()


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
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    comments: list[str] | None = None
    links: list[str] | None = None
    attachments: list[str] | None = None


class UploadAttachmentResponse(BaseModel):
    name: str
    url: str


class AddCommentRequest(BaseModel):
    text: str = Field(min_length=1)


class AddCommentResponse(BaseModel):
    item_id: str
    comment_index: int
    total_comments: int


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
    workflow_repo.prepend_activity(
        WorkflowActivityLog(
            log_id=service._make_id("log"),
            action=action,
            item_id=item_id,
            item_title=item_title,
            details=details,
        ).model_dump(mode="json")
    )


@router.post("/workflow/items")
def create_workflow_item(payload: CreateWorkflowItemRequest, request: Request) -> dict:
    current_user_id(request)
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
    workflow_repo.save_workflow_item(item)
    _append_activity(
        action="create_item",
        details=f"Created item in {item.stage}",
        item_id=item.item_id,
        item_title=item.title,
    )
    return {"item_id": item.item_id, "stage": item.stage}


@router.post("/workflow/uploads")
async def upload_workflow_attachment(
    request: Request,
    file: UploadFile = File(...),
) -> UploadAttachmentResponse:
    user_id = current_user_id(request)
    extension = Path(file.filename or "").suffix
    asset_id = service._make_id("att")
    saved_name = f"{asset_id}{extension}"
    destination = workflow_repo.upload_root() / saved_name
    content = await file.read()
    destination.write_bytes(content)
    workflow_repo.register_file_asset(
        asset_id,
        owner_id=user_id,
        path=str(destination),
        mime=file.content_type,
        size=len(content),
    )
    return UploadAttachmentResponse(name=file.filename or saved_name, url=f"/uploads/{saved_name}")


@router.get("/workflow/items")
def list_workflow_items(request: Request) -> ListWorkflowItemsResponse:
    current_user_id(request)
    return ListWorkflowItemsResponse(items=workflow_repo.list_workflow_items())


@router.get("/workflow/items/{item_id}")
def get_workflow_item(item_id: str, request: Request) -> WorkflowItem:
    current_user_id(request)
    item = workflow_repo.get_workflow_item(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Workflow item not found: {item_id}")
    return item


@router.get("/workflow/logs")
def list_workflow_logs(request: Request) -> ListWorkflowActivityResponse:
    current_user_id(request)
    return ListWorkflowActivityResponse(
        items=[WorkflowActivityLog(**row) for row in workflow_repo.list_activity_logs()]
    )


@router.patch("/workflow/items/{item_id}")
def update_workflow_item(item_id: str, payload: UpdateWorkflowItemRequest, request: Request) -> dict:
    current_user_id(request)
    existing = workflow_repo.get_workflow_item(item_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Workflow item not found: {item_id}")

    data = existing.model_dump()
    updates = payload.model_dump(exclude_none=True)
    data.update(updates)
    updated = WorkflowItem(**data)
    workflow_repo.save_workflow_item(updated)
    _append_activity(
        action="update_item",
        details="Updated workflow item fields",
        item_id=item_id,
        item_title=updated.title,
    )
    return {"item_id": item_id, "updated": True}


@router.post("/workflow/items/{item_id}/comments")
def add_workflow_comment(item_id: str, payload: AddCommentRequest, request: Request) -> AddCommentResponse:
    current_user_id(request)
    existing = workflow_repo.get_workflow_item(item_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Workflow item not found: {item_id}")

    data = existing.model_dump()
    comments = list(data.get("comments", []))
    comments.append(payload.text)
    data["comments"] = comments
    data["updated_at"] = datetime.now(UTC)
    updated = WorkflowItem(**data)
    workflow_repo.save_workflow_item(updated)

    _append_activity(
        action="add_comment",
        details=f"Comment: {payload.text[:80]}",
        item_id=item_id,
        item_title=updated.title,
    )
    return AddCommentResponse(
        item_id=item_id,
        comment_index=len(comments) - 1,
        total_comments=len(comments),
    )


@router.delete("/workflow/items/{item_id}")
def delete_workflow_item(item_id: str, request: Request) -> dict:
    current_user_id(request)
    removed = workflow_repo.delete_workflow_item(item_id)
    if removed is None:
        raise HTTPException(status_code=404, detail=f"Workflow item not found: {item_id}")

    _append_activity(
        action="delete_item",
        details="Deleted workflow item",
        item_id=item_id,
        item_title=removed.title,
    )
    return {"item_id": item_id, "deleted": True}


@router.patch("/workflow/items/{item_id}/stage")
def update_workflow_stage(
    item_id: str,
    payload: UpdateWorkflowStageRequest,
    request: Request,
) -> UpdateWorkflowStageResponse:
    current_user_id(request)
    existing = workflow_repo.get_workflow_item(item_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Workflow item not found: {item_id}")

    from_stage = existing.stage
    try:
        updated = service.move_stage(existing, to_stage=payload.to_stage, note=payload.note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    workflow_repo.save_workflow_item(updated)
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
def create_milestone(payload: CreateMilestoneRequest, request: Request) -> dict:
    current_user_id(request)
    if workflow_repo.get_workflow_item(payload.item_id) is None:
        raise HTTPException(status_code=404, detail=f"Workflow item not found: {payload.item_id}")

    milestone = service.create_milestone(
        item_id=payload.item_id,
        title=payload.title,
        owner=payload.owner,
        due_date=payload.due_date,
        criteria=payload.criteria,
    )
    workflow_repo.save_milestone(milestone)
    _append_activity(
        action="create_milestone",
        details=f'Created milestone "{milestone.title}"',
        item_id=payload.item_id,
    )
    return {"milestone_id": milestone.milestone_id, "status": milestone.status}


@router.patch("/workflow/milestones/{milestone_id}")
def update_milestone(milestone_id: str, payload: UpdateMilestoneRequest, request: Request) -> dict:
    current_user_id(request)
    existing = workflow_repo.get_milestone(milestone_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Milestone not found: {milestone_id}")

    updated = service.update_milestone(existing, **payload.model_dump())
    workflow_repo.save_milestone(updated)
    _append_activity(
        action="update_milestone",
        details="Updated milestone fields",
        item_id=updated.item_id,
    )
    return {"milestone_id": milestone_id, "updated": True}
