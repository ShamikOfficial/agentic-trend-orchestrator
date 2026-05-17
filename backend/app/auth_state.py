from __future__ import annotations

import hashlib
import os
import re
from datetime import UTC, datetime

import bcrypt

from backend.app.persistence import auth_repo
from backend.app.services.team import service as id_service


def _password_digest(password: str) -> str:
    """SHA-256 prehash so bcrypt never sees >72 raw bytes (bcrypt 4.x limit)."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _hash_password(password: str) -> str:
    secret = _password_digest(password).encode("utf-8")
    return bcrypt.hashpw(secret, bcrypt.gensalt()).decode("ascii")


def _verify_password(password: str, password_hash: str) -> bool:
    stored = password_hash.encode("ascii")
    if bcrypt.checkpw(_password_digest(password).encode("utf-8"), stored):
        return True
    # Legacy: bcrypt of raw password (passlib era; only valid for <=72 bytes).
    raw = password.encode("utf-8")
    if len(raw) > 72:
        return False
    try:
        return bcrypt.checkpw(raw, stored)
    except ValueError:
        return False


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _password_auth_enabled() -> bool:
    flag = os.getenv("ALLOW_PASSWORD_AUTH", "true").strip().lower()
    return flag not in ("0", "false", "no")


def create_user(username: str, password: str, display_name: str | None = None) -> dict:
    if not _password_auth_enabled():
        raise ValueError("Password registration is disabled.")
    lowered = username.lower()
    if auth_repo.find_user_by_username(lowered):
        raise ValueError("Username already exists.")
    user_id = id_service._make_id("usr")
    user = {
        "user_id": user_id,
        "username": lowered,
        "email": lowered if "@" in lowered else None,
        "display_name": display_name or username,
        "password_hash": _hash_password(password),
        "created_at": now_iso(),
    }
    auth_repo.create_user_record(user)
    return user


def login_user(username: str, password: str) -> tuple[str, dict] | None:
    if not _password_auth_enabled():
        return None
    match = auth_repo.find_user_by_username(username)
    if not match or not match.get("password_hash"):
        return None
    if not _verify_password(password, match["password_hash"]):
        return None
    token = id_service._make_id("tok")
    auth_repo.save_session(token, match["user_id"])
    return token, match


def resolve_user_from_token(token: str | None) -> str | None:
    return auth_repo.resolve_session(token)


def safe_user(user_id: str) -> dict:
    user = auth_repo.get_user(user_id)
    if not user:
        raise KeyError(user_id)
    return {k: v for k, v in user.items() if k not in ("password", "password_hash")}


def list_other_users(current_user_id: str) -> list[dict]:
    return [
        safe_user(uid)
        for uid in auth_repo.list_user_ids()
        if uid != current_user_id
    ]


def iter_users() -> list[dict]:
    return [
        safe_user(uid)
        for uid in auth_repo.list_user_ids()
        if auth_repo.get_user(uid)
    ]


def upsert_oauth_from_claims(claims: dict) -> dict:
    email = claims.get("email")
    if isinstance(email, str):
        email = email.lower()
    name = str(claims.get("name") or claims.get("display_name") or email or "User")
    provider = str(claims.get("provider") or "oauth")
    subject = str(claims.get("providerAccountId") or claims.get("sub") or "")
    if not subject:
        raise ValueError("OAuth token missing subject.")

    base_username = (email.split("@")[0] if email else re.sub(r"[^a-z0-9]", "", name.lower()) or "user")[:20]
    username = base_username
    suffix = 0
    while auth_repo.find_user_by_username(username):
        suffix += 1
        username = f"{base_username}{suffix}"

    user_id = id_service._make_id("usr")
    return auth_repo.upsert_oauth_user(
        user_id=user_id,
        email=email,
        username=username,
        display_name=name,
        oauth_provider=provider,
        oauth_subject=subject,
    )
