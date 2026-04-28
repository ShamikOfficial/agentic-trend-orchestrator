from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from backend.app import auth_state
from backend.app.llm import LlmError
from backend.app.services.chat import assistant as chat_assistant
from backend.app.services.team import service as id_service

router = APIRouter()

_dm_messages: dict[tuple[str, str], list[dict]] = {}
_groups: dict[str, dict] = {}


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


def _require_user(x_auth_token: str | None) -> str:
    if not x_auth_token:
        raise HTTPException(status_code=401, detail="Missing auth token.")
    user_id = auth_state.resolve_user_from_token(x_auth_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired auth token.")
    return user_id


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


@router.get("/auth/me")
def me(x_auth_token: str | None = Header(default=None)) -> dict:
    user_id = _require_user(x_auth_token)
    return {"user": auth_state.safe_user(user_id)}


@router.get("/chat/users")
def list_users(x_auth_token: str | None = Header(default=None)) -> dict:
    current_user_id = _require_user(x_auth_token)
    return {"items": auth_state.list_other_users(current_user_id)}


@router.post("/chat/dm/{target_user_id}")
def send_dm(target_user_id: str, payload: SendMessageRequest, x_auth_token: str | None = Header(default=None)) -> dict:
    sender_id = _require_user(x_auth_token)
    try:
        auth_state.safe_user(target_user_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Target user not found.")
    key = tuple(sorted([sender_id, target_user_id]))
    message = {
        "message_id": id_service._make_id("msg"),
        "sender_id": sender_id,
        "content": payload.content,
        "created_at": datetime.now(UTC).isoformat(),
    }
    _dm_messages.setdefault(key, []).append(message)
    return message


@router.get("/chat/dm/{target_user_id}")
def list_dm(target_user_id: str, x_auth_token: str | None = Header(default=None)) -> dict:
    user_id = _require_user(x_auth_token)
    key = tuple(sorted([user_id, target_user_id]))
    return {"items": _dm_messages.get(key, [])}


@router.post("/chat/groups")
def create_group(payload: CreateGroupRequest, x_auth_token: str | None = Header(default=None)) -> dict:
    creator_id = _require_user(x_auth_token)
    group_id = id_service._make_id("grp")
    _groups[group_id] = {
        "group_id": group_id,
        "name": payload.name,
        "description": payload.description,
        "created_by": creator_id,
        "members": [creator_id],
        "pending_requests": [],
        "messages": [],
        "created_at": datetime.now(UTC).isoformat(),
    }
    return _groups[group_id]


@router.get("/chat/groups")
def list_groups(x_auth_token: str | None = Header(default=None)) -> dict:
    user_id = _require_user(x_auth_token)
    items = []
    for group in _groups.values():
        item = {
            "group_id": group["group_id"],
            "name": group["name"],
            "description": group["description"],
            "member_count": len(group["members"]),
            "joined": user_id in group["members"],
            "pending": user_id in group["pending_requests"],
        }
        items.append(item)
    return {"items": items}

@router.get("/chat/search")
def search_chat(q: str = "", x_auth_token: str | None = Header(default=None)) -> dict:
    user_id = _require_user(x_auth_token)
    query = q.strip().lower()
    users = [
        auth_state.safe_user(other_id)
        for other_id in auth_state._users.keys()  # noqa: SLF001
        if other_id != user_id
        and (
            not query
            or query in auth_state._users[other_id]["username"]  # noqa: SLF001
            or query in auth_state._users[other_id]["display_name"].lower()  # noqa: SLF001
        )
    ]
    groups = [
        {
            "group_id": group["group_id"],
            "name": group["name"],
            "description": group["description"],
            "joined": user_id in group["members"],
            "pending": user_id in group["pending_requests"],
        }
        for group in _groups.values()
        if not query or query in group["name"].lower() or query in group["description"].lower()
    ]
    return {"users": users, "groups": groups}


@router.post("/chat/groups/{group_id}/request-join")
def request_join_group(group_id: str, x_auth_token: str | None = Header(default=None)) -> dict:
    user_id = _require_user(x_auth_token)
    group = _groups.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    if user_id in group["members"]:
        return {"group_id": group_id, "status": "already_member"}
    if user_id not in group["pending_requests"]:
        group["pending_requests"].append(user_id)
    return {"group_id": group_id, "status": "requested"}


@router.get("/chat/groups/{group_id}/requests")
def list_group_requests(group_id: str, x_auth_token: str | None = Header(default=None)) -> dict:
    user_id = _require_user(x_auth_token)
    group = _groups.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    if group["created_by"] != user_id:
        raise HTTPException(status_code=403, detail="Only group admin can view requests.")
    items = [auth_state.safe_user(requester_id) for requester_id in group["pending_requests"]]
    return {"items": items}


@router.post("/chat/groups/{group_id}/requests/action")
def handle_group_request(group_id: str, payload: GroupRequestActionRequest, x_auth_token: str | None = Header(default=None)) -> dict:
    user_id = _require_user(x_auth_token)
    group = _groups.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    if group["created_by"] != user_id:
        raise HTTPException(status_code=403, detail="Only group admin can approve requests.")
    requester = payload.requester_user_id
    if requester not in group["pending_requests"]:
        raise HTTPException(status_code=404, detail="Request not found.")
    group["pending_requests"].remove(requester)
    if payload.approve and requester not in group["members"]:
        group["members"].append(requester)
        return {"group_id": group_id, "requester_user_id": requester, "status": "approved"}
    return {"group_id": group_id, "requester_user_id": requester, "status": "rejected"}


@router.post("/chat/groups/{group_id}/messages")
def send_group_message(group_id: str, payload: SendMessageRequest, x_auth_token: str | None = Header(default=None)) -> dict:
    user_id = _require_user(x_auth_token)
    group = _groups.get(group_id)
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
    group["messages"].append(message)
    return message


@router.get("/chat/groups/{group_id}/messages")
def list_group_messages(group_id: str, x_auth_token: str | None = Header(default=None)) -> dict:
    user_id = _require_user(x_auth_token)
    group = _groups.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    if user_id not in group["members"]:
        raise HTTPException(status_code=403, detail="Join group before viewing messages.")
    return {"items": group["messages"]}


def _messages_for_ask_ai(user_id: str, payload: AskChatAiRequest) -> list[dict]:
    if payload.chat_type == "dm":
        try:
            auth_state.safe_user(payload.target_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Target user not found.") from None
        key = tuple(sorted([user_id, payload.target_id]))
        raw = _dm_messages.get(key, [])
    else:
        group = _groups.get(payload.target_id)
        if not group:
            raise HTTPException(status_code=404, detail="Group not found.")
        if user_id not in group["members"]:
            raise HTTPException(status_code=403, detail="Join group before using Ask AI.")
        raw = group.get("messages", [])
    return raw[-200:] if len(raw) > 200 else list(raw)


@router.post("/chat/ask-ai")
def ask_chat_ai(payload: AskChatAiRequest, x_auth_token: str | None = Header(default=None)) -> dict:
    user_id = _require_user(x_auth_token)
    rows = _messages_for_ask_ai(user_id, payload)
    transcript = chat_assistant.format_transcript(rows)
    try:
        answer = chat_assistant.answer_from_transcript(transcript, payload.question)
    except LlmError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"answer": answer.strip()}
