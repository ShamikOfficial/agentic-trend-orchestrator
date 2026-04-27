from __future__ import annotations

from datetime import UTC, datetime

from backend.app.services.team import service as id_service

_users: dict[str, dict] = {}
_sessions: dict[str, str] = {}


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def create_user(username: str, password: str, display_name: str | None = None) -> dict:
    lowered = username.lower()
    if any(user["username"] == lowered for user in _users.values()):
        raise ValueError("Username already exists.")
    user_id = id_service._make_id("usr")
    user = {
        "user_id": user_id,
        "username": lowered,
        "password": password,
        "display_name": display_name or username,
        "created_at": now_iso(),
    }
    _users[user_id] = user
    return user


def login_user(username: str, password: str) -> tuple[str, dict] | None:
    lowered = username.lower()
    match = next(
        (
            user
            for user in _users.values()
            if user["username"] == lowered and user["password"] == password
        ),
        None,
    )
    if not match:
        return None
    token = id_service._make_id("tok")
    _sessions[token] = match["user_id"]
    return token, match


def resolve_user_from_token(token: str | None) -> str | None:
    if not token:
        return None
    return _sessions.get(token)


def safe_user(user_id: str) -> dict:
    return {k: v for k, v in _users[user_id].items() if k != "password"}


def list_other_users(current_user_id: str) -> list[dict]:
    return [
        safe_user(user_id)
        for user_id in _users
        if user_id != current_user_id
    ]
