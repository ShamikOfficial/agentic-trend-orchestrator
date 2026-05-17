from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from backend.app.persistence.db import session_scope
from backend.app.persistence.models import SessionToken, User


def _now() -> datetime:
    return datetime.now(UTC)


def create_user_record(user: dict) -> None:
    with session_scope() as session:
        session.add(
            User(
                user_id=user["user_id"],
                email=user.get("email"),
                username=user["username"],
                display_name=user["display_name"],
                password_hash=user.get("password_hash"),
                oauth_provider=user.get("oauth_provider"),
                oauth_subject=user.get("oauth_subject"),
                created_at=datetime.fromisoformat(user["created_at"])
                if isinstance(user.get("created_at"), str)
                else user.get("created_at") or _now(),
            )
        )


def find_user_by_username(username: str) -> dict | None:
    lowered = username.lower()
    with session_scope() as session:
        row = session.scalar(select(User).where(User.username == lowered))
        return _user_to_dict(row) if row else None


def find_user_by_email(email: str) -> dict | None:
    lowered = email.lower()
    with session_scope() as session:
        row = session.scalar(select(User).where(User.email == lowered))
        return _user_to_dict(row) if row else None


def find_user_by_oauth(provider: str, subject: str) -> dict | None:
    with session_scope() as session:
        row = session.scalar(
            select(User).where(
                User.oauth_provider == provider,
                User.oauth_subject == subject,
            )
        )
        return _user_to_dict(row) if row else None


def get_user(user_id: str) -> dict | None:
    with session_scope() as session:
        row = session.get(User, user_id)
        return _user_to_dict(row) if row else None


def list_user_ids() -> list[str]:
    with session_scope() as session:
        rows = session.scalars(select(User.user_id)).all()
        return list(rows)


def search_users(query: str, exclude_user_id: str) -> list[dict]:
    q = query.strip().lower()
    with session_scope() as session:
        stmt = select(User).where(User.user_id != exclude_user_id)
        if q:
            stmt = stmt.where(
                or_(
                    func.lower(User.username).contains(q),
                    func.lower(User.display_name).contains(q),
                )
            )
        rows = session.scalars(stmt).all()
        return [_user_to_dict(row) for row in rows if row]


def save_session(token: str, user_id: str) -> None:
    with session_scope() as session:
        session.merge(
            SessionToken(token=token, user_id=user_id, created_at=_now()),
        )


def resolve_session(token: str | None) -> str | None:
    if not token:
        return None
    with session_scope() as session:
        row = session.get(SessionToken, token)
        return row.user_id if row else None


def upsert_oauth_user(
    *,
    user_id: str,
    email: str | None,
    username: str,
    display_name: str,
    oauth_provider: str,
    oauth_subject: str,
) -> dict:
    with session_scope() as session:
        existing = session.scalar(
            select(User).where(
                User.oauth_provider == oauth_provider,
                User.oauth_subject == oauth_subject,
            )
        )
        if existing:
            if email and not existing.email:
                existing.email = email.lower()
            if display_name:
                existing.display_name = display_name
            session.flush()
            return _user_to_dict(existing)

        if email:
            by_email = session.scalar(select(User).where(User.email == email.lower()))
            if by_email:
                by_email.oauth_provider = oauth_provider
                by_email.oauth_subject = oauth_subject
                session.flush()
                return _user_to_dict(by_email)

        row = User(
            user_id=user_id,
            email=email.lower() if email else None,
            username=username.lower(),
            display_name=display_name,
            password_hash=None,
            oauth_provider=oauth_provider,
            oauth_subject=oauth_subject,
            created_at=_now(),
        )
        session.add(row)
        session.flush()
        return _user_to_dict(row)


def update_password_hash(user_id: str, password_hash: str) -> None:
    with session_scope() as session:
        row = session.get(User, user_id)
        if row:
            row.password_hash = password_hash


def _user_to_dict(row: User) -> dict:
    return {
        "user_id": row.user_id,
        "email": row.email,
        "username": row.username,
        "display_name": row.display_name,
        "password": row.password_hash or "",
        "password_hash": row.password_hash,
        "oauth_provider": row.oauth_provider,
        "oauth_subject": row.oauth_subject,
        "created_at": row.created_at.isoformat(),
    }
