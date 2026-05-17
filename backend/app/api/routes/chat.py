from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from backend.app import auth_state
from backend.app.api.deps import current_user_id
from backend.app.llm import LlmError, LlmQuotaError
from backend.app.persistence import auth_repo, chat_repo
from backend.app.persistence import workflow_repo
from backend.app.services.chat import assistant as chat_assistant
from backend.app.services.chat import task_extractor
from backend.app.services.team import service as id_service

router = APIRouter()

TASK_EXTRACT_BATCH_SIZE = int(os.getenv("TASK_EXTRACT_BATCH_SIZE", "5"))
TASK_EXTRACT_FORCE_COUNT = int(os.getenv("TASK_EXTRACT_FORCE_COUNT", "10"))


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3)
    password: str = Field(min_length=3)
    display_name: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class CreateGroupRequest(BaseModel):
    name: str = Field(min_length=2)
    description: str = ""


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1)


class AskChatAiRequest(BaseModel):
    chat_type: Literal["dm", "group"]
    target_id: str = Field(min_length=1)
    question: str = Field(min_length=1, max_length=8000)


class GroupRequestActionRequest(BaseModel):
    requester_user_id: str
    approve: bool = True


class ChatExtractTasksRequest(BaseModel):
    chat_type: Literal["dm", "group"]
    target_id: str = Field(min_length=1)
    force: bool = False


class ApplyTaskActionRequest(BaseModel):
    action: Literal["create", "update", "comment", "close"]
    title: str | None = None
    description: str | None = None
    owner: str | None = None
    priority: str | None = None
    existing_item_id: str | None = None
    update_fields: dict | None = None
    comment: str | None = None


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


@router.post("/auth/register")
def register(payload: RegisterRequest) -> dict:
    try:
        created = auth_state.create_user(
            username=payload.username,
            password=payload.password,
            display_name=payload.display_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"user_id": created["user_id"], "username": created["username"]}


@router.post("/auth/login")
def login(payload: LoginRequest) -> dict:
    result = auth_state.login_user(payload.username, payload.password)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    token, match = result
    return {"token": token, "user": auth_state.safe_user(match["user_id"])}


@router.post("/auth/oauth/sync")
def oauth_sync(request: Request) -> dict:
    claims = getattr(request.state, "jwt_claims", None)
    if not claims:
        raise HTTPException(status_code=401, detail="Valid OAuth JWT required.")
    try:
        user = auth_state.upsert_oauth_from_claims(claims)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    request.state.user_id = user["user_id"]
    return {"user_id": user["user_id"], "user": auth_state.safe_user(user["user_id"])}


@router.get("/auth/me")
def me(request: Request, x_auth_token: str | None = Header(default=None)) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    return {"user": auth_state.safe_user(user_id)}


@router.get("/chat/users")
def list_users(request: Request, x_auth_token: str | None = Header(default=None)) -> dict:
    current = _legacy_user(x_auth_token, request)
    return {"items": auth_state.list_other_users(current)}


@router.post("/chat/dm/{target_user_id}")
def send_dm(
    target_user_id: str,
    payload: SendMessageRequest,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    sender_id = _legacy_user(x_auth_token, request)
    try:
        auth_state.safe_user(target_user_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Target user not found.")
    message = {
        "message_id": id_service._make_id("msg"),
        "sender_id": sender_id,
        "content": payload.content,
        "created_at": datetime.now(UTC).isoformat(),
    }
    return chat_repo.add_dm_message(sender_id, target_user_id, message)


@router.get("/chat/dm/{target_user_id}")
def list_dm(
    target_user_id: str,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    return {"items": chat_repo.list_dm_messages(user_id, target_user_id)}


@router.post("/chat/groups")
def create_group(
    payload: CreateGroupRequest,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    creator_id = _legacy_user(x_auth_token, request)
    group_id = id_service._make_id("grp")
    group = {
        "group_id": group_id,
        "name": payload.name,
        "description": payload.description,
        "created_by": creator_id,
        "members": [creator_id],
        "pending_requests": [],
        "created_at": datetime.now(UTC).isoformat(),
    }
    chat_repo.create_group(group)
    return {**group, "messages": []}


@router.get("/chat/groups")
def list_groups(request: Request, x_auth_token: str | None = Header(default=None)) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    items = []
    for row in chat_repo.list_groups_for_user(user_id):
        items.append(
            {
                "group_id": row["group_id"],
                "name": row["name"],
                "description": row["description"],
                "member_count": row["member_count"],
                "joined": row["joined"],
                "pending": row["pending"],
            }
        )
    return {"items": items}


@router.get("/chat/search")
def search_chat(
    request: Request,
    q: str = "",
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    users = auth_repo.search_users(q, user_id)
    safe_users = [{k: v for k, v in u.items() if k not in ("password", "password_hash")} for u in users]
    groups = chat_repo.search_groups(q, user_id)
    return {"users": safe_users, "groups": groups}


@router.post("/chat/groups/{group_id}/request-join")
def request_join_group(
    group_id: str,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    group = chat_repo.get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    if user_id in group["members"]:
        return {"group_id": group_id, "status": "already_member"}
    chat_repo.request_join(group_id, user_id)
    return {"group_id": group_id, "status": "requested"}


@router.get("/chat/groups/{group_id}/requests")
def list_group_requests(
    group_id: str,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    group = chat_repo.get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    if group["created_by"] != user_id:
        raise HTTPException(status_code=403, detail="Only group admin can view requests.")
    items = [auth_state.safe_user(rid) for rid in chat_repo.list_pending_requests(group_id)]
    return {"items": items}


@router.post("/chat/groups/{group_id}/requests/action")
def handle_group_request(
    group_id: str,
    payload: GroupRequestActionRequest,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    group = chat_repo.get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    if group["created_by"] != user_id:
        raise HTTPException(status_code=403, detail="Only group admin can approve requests.")
    if payload.requester_user_id not in group["pending_requests"]:
        raise HTTPException(status_code=404, detail="Request not found.")
    chat_repo.handle_join_request(group_id, payload.requester_user_id, payload.approve)
    if payload.approve:
        return {"group_id": group_id, "requester_user_id": payload.requester_user_id, "status": "approved"}
    return {"group_id": group_id, "requester_user_id": payload.requester_user_id, "status": "rejected"}


@router.post("/chat/groups/{group_id}/messages")
def send_group_message(
    group_id: str,
    payload: SendMessageRequest,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    group = chat_repo.get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    if user_id not in group["members"]:
        raise HTTPException(status_code=403, detail="Join group before messaging.")
    message = {
        "message_id": id_service._make_id("gmsg"),
        "sender_id": user_id,
        "content": payload.content,
        "created_at": datetime.now(UTC).isoformat(),
    }
    return chat_repo.add_group_message(group_id, message)


@router.get("/chat/groups/{group_id}/messages")
def list_group_messages(
    group_id: str,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    group = chat_repo.get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    if user_id not in group["members"]:
        raise HTTPException(status_code=403, detail="Join group before viewing messages.")
    return {"items": chat_repo.list_group_messages(group_id)}


def _messages_for_ask_ai(user_id: str, payload: AskChatAiRequest) -> list[dict]:
    if payload.chat_type == "dm":
        try:
            auth_state.safe_user(payload.target_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Target user not found.") from None
        raw = chat_repo.list_dm_messages(user_id, payload.target_id)
    else:
        group = chat_repo.get_group(payload.target_id)
        if not group:
            raise HTTPException(status_code=404, detail="Group not found.")
        if user_id not in group["members"]:
            raise HTTPException(status_code=403, detail="Join group before using Ask AI.")
        raw = chat_repo.list_group_messages(payload.target_id)
    return raw[-200:] if len(raw) > 200 else list(raw)


@router.post("/chat/ask-ai")
def ask_chat_ai(
    payload: AskChatAiRequest,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    rows = _messages_for_ask_ai(user_id, payload)
    transcript = chat_assistant.format_transcript(rows)
    try:
        answer = chat_assistant.answer_from_transcript(transcript, payload.question, user_id=user_id)
    except (LlmError, LlmQuotaError) as exc:
        raise _llm_http_error(exc) from exc
    return {"answer": answer.strip()}


def _resolve_chat_key(user_id: str, chat_type: str, target_id: str) -> str:
    if chat_type == "dm":
        pair = tuple(sorted([user_id, target_id]))
        return f"dm:{pair[0]}:{pair[1]}"
    return f"group:{target_id}"


def _get_messages_for_chat(user_id: str, chat_type: str, target_id: str) -> list[dict]:
    if chat_type == "dm":
        try:
            auth_state.safe_user(target_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Target user not found.") from None
        return chat_repo.list_dm_messages(user_id, target_id)
    group = chat_repo.get_group(target_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    if user_id not in group["members"]:
        raise HTTPException(status_code=403, detail="Join group first.")
    return chat_repo.list_group_messages(target_id)


def _messages_after_id(messages: list[dict], last_id: str | None) -> list[dict]:
    if not last_id:
        return list(messages)
    found = False
    result: list[dict] = []
    for msg in messages:
        if found:
            result.append(msg)
        elif msg.get("message_id") == last_id:
            found = True
    if not found:
        return list(messages)
    return result


@router.post("/chat/extract-tasks")
def extract_tasks(
    payload: ChatExtractTasksRequest,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    chat_key = _resolve_chat_key(user_id, payload.chat_type, payload.target_id)
    all_messages = _get_messages_for_chat(user_id, payload.chat_type, payload.target_id)

    if payload.force:
        new_messages = all_messages[-TASK_EXTRACT_FORCE_COUNT:]
    else:
        last_analyzed_id = chat_repo.get_analysis_state(chat_key)
        new_messages = _messages_after_id(all_messages, last_analyzed_id)

    if not payload.force and len(new_messages) < TASK_EXTRACT_BATCH_SIZE:
        return {
            "status": "pending",
            "unanalyzed_count": len(new_messages),
            "threshold": TASK_EXTRACT_BATCH_SIZE,
            "suggestions": [],
        }

    if not new_messages:
        return {"status": "analyzed", "unanalyzed_count": 0, "suggestions": []}

    existing_items = workflow_repo.list_workflow_items()

    try:
        suggestions = task_extractor.extract_tasks_from_chat(
            new_messages,
            existing_items,
            user_id=user_id,
        )
    except (LlmError, LlmQuotaError) as exc:
        raise _llm_http_error(exc) from exc

    latest_msg = new_messages[-1] if new_messages else None
    if latest_msg:
        chat_repo.set_analysis_state(chat_key, latest_msg["message_id"])

    return {
        "status": "analyzed",
        "unanalyzed_count": 0,
        "suggestions": suggestions,
    }


@router.post("/chat/apply-task-action")
def apply_task_action(
    payload: ApplyTaskActionRequest,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    _legacy_user(x_auth_token, request)

    from backend.app.api.routes.workflow import _append_activity
    from backend.app.models.workflow import VALID_WORKFLOW_STAGES, WorkflowItem
    from backend.app.services.workflow import service as wf_service

    if payload.update_fields and "stage" in payload.update_fields:
        raw_stage = payload.update_fields["stage"]
        if raw_stage not in VALID_WORKFLOW_STAGES:
            payload.update_fields.pop("stage")

    if payload.action == "create":
        if not payload.title:
            raise HTTPException(status_code=400, detail="title is required for create action.")
        item = wf_service.create_workflow_item(
            title=payload.title,
            description=payload.description or "",
            owner=payload.owner,
        )
        workflow_repo.save_workflow_item(item)
        _append_activity(
            action="chat_create_item",
            details=f"Created from chat: {item.title}",
            item_id=item.item_id,
            item_title=item.title,
        )
        return {"action": "create", "item_id": item.item_id, "title": item.title, "applied": True}

    if payload.action == "update":
        if not payload.existing_item_id:
            raise HTTPException(status_code=400, detail="existing_item_id is required for update.")
        existing = workflow_repo.get_workflow_item(payload.existing_item_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Workflow item not found.")
        data = existing.model_dump()
        if payload.update_fields:
            for k, v in payload.update_fields.items():
                if k in data and v is not None:
                    data[k] = v
        data["updated_at"] = datetime.now(UTC)
        updated = WorkflowItem(**data)
        workflow_repo.save_workflow_item(updated)
        changed = [f"{k}: {v}" for k, v in (payload.update_fields or {}).items()]
        _append_activity(
            action="chat_update_item",
            details=f"Updated from chat: {', '.join(changed) if changed else 'fields updated'}",
            item_id=payload.existing_item_id,
            item_title=updated.title,
        )
        return {"action": "update", "item_id": payload.existing_item_id, "applied": True}

    if payload.action == "comment":
        if not payload.existing_item_id:
            raise HTTPException(status_code=400, detail="existing_item_id is required for comment.")
        existing = workflow_repo.get_workflow_item(payload.existing_item_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Workflow item not found.")
        comment_text = payload.comment or ""
        if not comment_text:
            raise HTTPException(status_code=400, detail="comment text is required.")
        data = existing.model_dump()
        data["comments"] = [*data.get("comments", []), comment_text]
        data["updated_at"] = datetime.now(UTC)
        updated = WorkflowItem(**data)
        workflow_repo.save_workflow_item(updated)
        _append_activity(
            action="chat_comment",
            details=f"Comment from chat: {comment_text[:80]}",
            item_id=payload.existing_item_id,
            item_title=updated.title,
        )
        return {"action": "comment", "item_id": payload.existing_item_id, "applied": True}

    if payload.action == "close":
        if not payload.existing_item_id:
            raise HTTPException(status_code=400, detail="existing_item_id is required for close.")
        existing = workflow_repo.get_workflow_item(payload.existing_item_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Workflow item not found.")
        from_stage = existing.stage
        data = existing.model_dump()
        data["stage"] = "Publish"
        data["updated_at"] = datetime.now(UTC)
        updated = WorkflowItem(**data)
        workflow_repo.save_workflow_item(updated)
        _append_activity(
            action="chat_close_item",
            details=f"Closed from chat (was {from_stage})",
            item_id=payload.existing_item_id,
            item_title=updated.title,
        )
        return {"action": "close", "item_id": payload.existing_item_id, "applied": True}

    raise HTTPException(status_code=400, detail=f"Unknown action: {payload.action}")
