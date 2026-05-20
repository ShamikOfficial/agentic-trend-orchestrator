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
from backend.app.services.chat import orchestrator as chat_orchestrator
from backend.app.services.chat import schedule_slots, task_analysis_batches, task_extractor
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


class ExternalBusyEvent(BaseModel):
    summary: str = ""
    start: str
    end: str


class AskChatAiRequest(BaseModel):
    chat_type: Literal["dm", "group"]
    target_id: str = Field(min_length=1)
    question: str = Field(min_length=1, max_length=8000)
    external_events: list[ExternalBusyEvent] = Field(default_factory=list)


class GroupRequestActionRequest(BaseModel):
    requester_user_id: str
    approve: bool = True


class ChatExtractTasksRequest(BaseModel):
    chat_type: Literal["dm", "group"]
    target_id: str = Field(min_length=1)
    force: bool = False
    client_timezone: str | None = None


class SuggestTimeSlotsRequest(BaseModel):
    chat_type: Literal["dm", "group"]
    target_id: str = Field(min_length=1)
    task_title: str = Field(min_length=1)
    task_description: str = ""
    duration_minutes: int = 60
    preferred_date: str | None = None
    message_text: str | None = None
    external_events: list[ExternalBusyEvent] = Field(default_factory=list)


class ApplyTaskActionRequest(BaseModel):
    action: Literal["create", "update", "comment", "close"]
    title: str | None = None
    description: str | None = None
    owner: str | None = None
    priority: str | None = None
    existing_item_id: str | None = None
    update_fields: dict | None = None
    comment: str | None = None
    chat_type: Literal["dm", "group"] | None = None
    target_id: str | None = None
    source_message_batch_index: int | None = None
    source_message_ids: list[str] | None = None
    source_first_message_id: str | None = None
    source_last_message_id: str | None = None


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


def _delete_dm_message_impl(user_id: str, target_user_id: str, message_id: str) -> dict:
    row = chat_repo.get_dm_message(message_id)
    if not row:
        return {"deleted": True, "message_id": message_id, "already_gone": True}
    pair = tuple(sorted([user_id, target_user_id]))
    if pair != tuple(sorted([row["user_a"], row["user_b"]])):
        raise HTTPException(status_code=403, detail="Message is not in this conversation.")
    if row["sender_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages.")
    chat_repo.delete_dm_message(message_id)
    return {"deleted": True, "message_id": message_id}


@router.delete("/chat/dm/{target_user_id}/messages/{message_id}")
def delete_dm_message(
    target_user_id: str,
    message_id: str,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    return _delete_dm_message_impl(user_id, target_user_id, message_id)


@router.post("/chat/dm/{target_user_id}/messages/{message_id}/delete")
def delete_dm_message_post(
    target_user_id: str,
    message_id: str,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    """POST fallback when DELETE is blocked or an old proxy strips the method."""
    user_id = _legacy_user(x_auth_token, request)
    return _delete_dm_message_impl(user_id, target_user_id, message_id)


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
    messages = chat_repo.search_messages(q, user_id)
    for hit in messages:
        if hit["chat_type"] == "dm":
            peer = auth_repo.get_user(hit["target_id"])
            hit["chat_name"] = peer["display_name"] if peer else hit["target_id"]
        else:
            group = chat_repo.get_group(hit["target_id"])
            hit["chat_name"] = group["name"] if group else hit["target_id"]
    return {"users": safe_users, "groups": groups, "messages": messages}


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


@router.delete("/chat/conversation")
def delete_conversation(
    chat_type: Literal["dm", "group"],
    target_id: str,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    chat_key = _resolve_chat_key(user_id, chat_type, target_id)

    if chat_type == "dm":
        try:
            auth_state.safe_user(target_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Target user not found.") from None
        deleted = chat_repo.delete_dm_conversation(user_id, target_id)
    else:
        group = chat_repo.get_group(target_id)
        if not group:
            raise HTTPException(status_code=404, detail="Group not found.")
        if user_id not in group["members"]:
            raise HTTPException(status_code=403, detail="Join group before deleting chat history.")
        deleted = chat_repo.delete_group_messages(target_id)

    chat_repo.clear_analysis_state(chat_key)
    return {"deleted": True, "messages_removed": deleted, "chat_key": chat_key}


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


def _delete_group_message_impl(user_id: str, group_id: str, message_id: str) -> dict:
    group = chat_repo.get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    if user_id not in group["members"]:
        raise HTTPException(status_code=403, detail="Join group before deleting messages.")
    row = chat_repo.get_group_message(message_id)
    if not row or row["group_id"] != group_id:
        return {"deleted": True, "message_id": message_id, "already_gone": True}
    is_admin = group["created_by"] == user_id
    if row["sender_id"] != user_id and not is_admin:
        raise HTTPException(status_code=403, detail="You can only delete your own messages.")
    chat_repo.delete_group_message(message_id)
    return {"deleted": True, "message_id": message_id}


@router.delete("/chat/groups/{group_id}/messages/{message_id}")
def delete_group_message(
    group_id: str,
    message_id: str,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    return _delete_group_message_impl(user_id, group_id, message_id)


@router.post("/chat/groups/{group_id}/messages/{message_id}/delete")
def delete_group_message_post(
    group_id: str,
    message_id: str,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    return _delete_group_message_impl(user_id, group_id, message_id)


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
    question = payload.question.strip()
    chat_key = _resolve_chat_key(user_id, payload.chat_type, payload.target_id)
    external = [ev.model_dump() for ev in payload.external_events]

    try:
        result = chat_orchestrator.run_chat_orchestrator(
            messages=rows,
            question=question,
            user_id=user_id,
            chat_key=chat_key,
            external_events=external,
        )
    except (LlmError, LlmQuotaError) as exc:
        raise _llm_http_error(exc) from exc

    return {
        "answer": result.get("answer", ""),
        "show_schedule_picker": bool(result.get("show_schedule_picker")),
        "intent": result.get("intent", "ask"),
        "task_suggestions": result.get("task_suggestions") or [],
    }


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


def _stamp_message_source(data: dict, payload: ApplyTaskActionRequest) -> None:
    if payload.source_message_batch_index is not None:
        data["source_message_batch_index"] = payload.source_message_batch_index
    if payload.source_message_ids:
        data["source_message_ids"] = payload.source_message_ids
    if payload.source_first_message_id:
        data["source_first_message_id"] = payload.source_first_message_id
    if payload.source_last_message_id:
        data["source_last_message_id"] = payload.source_last_message_id


def _chat_source_key(user_id: str, chat_type: str | None, target_id: str | None) -> str | None:
    if not chat_type or not target_id:
        return None
    return _resolve_chat_key(user_id, chat_type, target_id)


def _item_linked_to_chat(item, chat_key: str) -> bool:
    if getattr(item, "source_chat_key", None) == chat_key:
        return True
    linked = (item.linked_trend or "").lower()
    return chat_key.lower() in linked or linked.startswith("chat:")


@router.get("/chat/work-items")
def list_chat_work_items(
    chat_type: Literal["dm", "group"],
    target_id: str,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    chat_key = _resolve_chat_key(user_id, chat_type, target_id)
    items = [
        item.model_dump(mode="json")
        for item in workflow_repo.list_workflow_items()
        if _item_linked_to_chat(item, chat_key)
    ]
    item_ids = {row["item_id"] for row in items}
    milestones = [
        ms.model_dump(mode="json")
        for ms in workflow_repo.list_milestones()
        if ms.item_id in item_ids
    ]
    return {"chat_key": chat_key, "items": items, "milestones": milestones}


def _require_schedule_fields(sched: dict, *, action: str) -> None:
    """Create/update tasks must include a scheduled window."""
    if not sched.get("scheduled_start") or not sched.get("scheduled_end"):
        raise HTTPException(
            status_code=400,
            detail=(
                f"scheduled_start and scheduled_end are required for {action}. "
                "Pick a time slot in the task panel before accepting."
            ),
        )
    if not sched.get("due_date"):
        start = sched["scheduled_start"]
        sched["due_date"] = start.date() if hasattr(start, "date") else start


def _parse_schedule_update_fields(update_fields: dict | None) -> dict:
    from datetime import date as date_type

    if not update_fields:
        return {}
    out: dict = {}
    for key in ("due_date", "scheduled_start", "scheduled_end"):
        raw = update_fields.get(key)
        if raw is None:
            continue
        if key == "due_date":
            try:
                out["due_date"] = date_type.fromisoformat(str(raw)[:10])
            except ValueError:
                pass
        else:
            try:
                normalized = str(raw).replace("Z", "+00:00")
                out[key] = datetime.fromisoformat(normalized)
            except ValueError:
                pass
    return out


@router.post("/chat/suggest-time-slots")
def suggest_chat_time_slots(
    payload: SuggestTimeSlotsRequest,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    chat_key = _resolve_chat_key(user_id, payload.chat_type, payload.target_id)
    linked_items = [
        item
        for item in workflow_repo.list_workflow_items()
        if _item_linked_to_chat(item, chat_key)
    ]
    item_ids = {item.item_id for item in linked_items}
    linked_milestones = [
        ms for ms in workflow_repo.list_milestones() if ms.item_id in item_ids
    ]
    all_items = workflow_repo.list_workflow_items()
    external = [ev.model_dump() for ev in payload.external_events]
    result = schedule_slots.suggest_time_slots(
        task_title=payload.task_title,
        task_description=payload.task_description,
        duration_minutes=payload.duration_minutes,
        preferred_date=payload.preferred_date,
        items=all_items,
        milestones=linked_milestones,
        external_events=external,
    )
    result["needs_scheduling"] = schedule_slots.message_needs_scheduling(
        payload.message_text or payload.task_title
    )
    return result


@router.get("/chat/task-analysis-sections")
def list_task_analysis_sections(
    chat_type: Literal["dm", "group"],
    target_id: str,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    """Completed analysis sections and how many messages are waiting for the next batch."""
    user_id = _legacy_user(x_auth_token, request)
    chat_key = _resolve_chat_key(user_id, chat_type, target_id)
    all_messages = _get_messages_for_chat(user_id, chat_type, target_id)
    last_analyzed_id = chat_repo.get_analysis_state(chat_key)
    sections = chat_repo.list_analysis_batches(chat_key)
    analyzed_ids = task_analysis_batches.analyzed_message_ids_from_batches(sections)
    unanalyzed = task_analysis_batches.unanalyzed_messages(all_messages, analyzed_ids)
    batch_size = task_analysis_batches.task_extract_batch_size()
    return {
        "batch_size": batch_size,
        "sections": sections,
        "pending_count": len(unanalyzed),
        "pending_until_analyze": max(0, batch_size - len(unanalyzed)),
    }


@router.post("/chat/extract-tasks")
def extract_tasks(
    payload: ChatExtractTasksRequest,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)
    chat_key = _resolve_chat_key(user_id, payload.chat_type, payload.target_id)
    all_messages = _get_messages_for_chat(user_id, payload.chat_type, payload.target_id)
    last_analyzed_id = chat_repo.get_analysis_state(chat_key)
    next_batch_index = chat_repo.count_analysis_batches(chat_key)
    prior_batches = chat_repo.list_analysis_batches(chat_key)
    batch_size = (
        task_analysis_batches.task_extract_force_count()
        if payload.force
        else task_analysis_batches.task_extract_batch_size()
    )
    analyzed_ids = task_analysis_batches.analyzed_message_ids_from_batches(prior_batches)
    unanalyzed = task_analysis_batches.unanalyzed_messages(all_messages, analyzed_ids)

    if not unanalyzed and prior_batches:
        return {
            "status": "already_analyzed",
            "unanalyzed_count": 0,
            "threshold": batch_size,
            "pending_until_analyze": 0,
            "suggestions": [],
            "analysis_batch": None,
            "message": "All chat messages were already analyzed for tasks. Send a new message first.",
        }

    selected = task_analysis_batches.select_messages_for_extraction(
        all_messages,
        last_analyzed_id=last_analyzed_id,
        next_batch_index=next_batch_index,
        force=payload.force,
        prior_batches=prior_batches,
    )

    if selected is None:
        return {
            "status": "pending",
            "unanalyzed_count": len(unanalyzed),
            "threshold": batch_size,
            "pending_until_analyze": max(0, batch_size - len(unanalyzed)),
            "suggestions": [],
            "analysis_batch": None,
        }

    new_messages, batch_meta = selected

    linked_items = [
        item
        for item in workflow_repo.list_workflow_items()
        if _item_linked_to_chat(item, chat_key)
    ]

    try:
        suggestions = task_extractor.extract_tasks_from_chat(
            new_messages,
            linked_items,
            user_id=user_id,
            client_timezone=payload.client_timezone,
        )
    except (LlmError, LlmQuotaError) as exc:
        raise _llm_http_error(exc) from exc

    fresh_linked = []
    for item in linked_items:
        loaded = workflow_repo.get_workflow_item(item.item_id)
        if loaded:
            fresh_linked.append(loaded)

    suggestions = task_analysis_batches.attach_message_source_to_suggestions(
        suggestions,
        batch_meta,
        new_messages,
    )
    suggestions = task_extractor.finalize_task_suggestions(
        suggestions,
        fresh_linked,
        batch_messages=new_messages,
        all_messages=all_messages,
        client_timezone=payload.client_timezone,
    )

    chat_repo.set_analysis_state(chat_key, batch_meta["last_message_id"])
    chat_repo.add_analysis_batch(
        chat_key,
        batch_index=batch_meta["batch_index"],
        first_message_id=batch_meta["first_message_id"],
        last_message_id=batch_meta["last_message_id"],
        message_ids=batch_meta["message_ids"],
    )

    remaining = len(unanalyzed) - batch_meta["message_count"]

    return {
        "status": "analyzed",
        "unanalyzed_count": remaining,
        "threshold": batch_size,
        "analysis_batch": batch_meta,
        "suggestions": suggestions,
    }


@router.post("/chat/apply-task-action")
def apply_task_action(
    payload: ApplyTaskActionRequest,
    request: Request,
    x_auth_token: str | None = Header(default=None),
) -> dict:
    user_id = _legacy_user(x_auth_token, request)

    from backend.app.api.routes.workflow import _append_activity
    from backend.app.models.workflow import VALID_WORKFLOW_STAGES, WorkflowItem
    from backend.app.services.workflow import service as wf_service

    if payload.update_fields and "stage" in payload.update_fields:
        raw_stage = payload.update_fields["stage"]
        if raw_stage not in VALID_WORKFLOW_STAGES:
            payload.update_fields.pop("stage")

    chat_key = _chat_source_key(user_id, payload.chat_type, payload.target_id)

    if payload.action == "create":
        if not payload.title:
            raise HTTPException(status_code=400, detail="title is required for create action.")
        sched = _parse_schedule_update_fields(payload.update_fields)
        _require_schedule_fields(sched, action="create")
        item = wf_service.create_workflow_item(
            title=payload.title,
            description=payload.description or "",
            owner=payload.owner,
            linked_trend=f"chat:{chat_key}" if chat_key else "chat",
            source_chat_key=chat_key,
            source_message_batch_index=payload.source_message_batch_index,
            source_message_ids=payload.source_message_ids or [],
            source_first_message_id=payload.source_first_message_id,
            source_last_message_id=payload.source_last_message_id,
            due_date=sched.get("due_date"),
            scheduled_start=sched.get("scheduled_start"),
            scheduled_end=sched.get("scheduled_end"),
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
        desc = (payload.description or "").strip()
        if not desc and payload.update_fields:
            desc = str(payload.update_fields.get("description") or "").strip()
        if desc:
            data["description"] = desc
        if payload.update_fields:
            sched = _parse_schedule_update_fields(payload.update_fields)
            uf = payload.update_fields or {}
            if any(k in uf for k in ("due_date", "scheduled_start", "scheduled_end")):
                _require_schedule_fields(sched, action="update")
            for k, v in sched.items():
                data[k] = v
            for k, v in payload.update_fields.items():
                if k in data and v is not None and k not in sched:
                    if k in ("due_date", "scheduled_start", "scheduled_end"):
                        continue
                    data[k] = v
        if chat_key and not data.get("source_chat_key"):
            data["source_chat_key"] = chat_key
            if not (data.get("linked_trend") or "").lower().startswith("chat"):
                data["linked_trend"] = f"chat:{chat_key}"
        _stamp_message_source(data, payload)
        mid = (payload.source_last_message_id or "").strip()
        if mid:
            data["source_message_ids"] = [mid]
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
