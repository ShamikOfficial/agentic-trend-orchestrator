from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import delete, func, or_, select

from backend.app.persistence.db import session_scope
from backend.app.persistence.models import (
    ChatAnalysisState,
    ChatTaskAnalysisBatch,
    DmMessage,
    Group,
    GroupJoinRequest,
    GroupMember,
    GroupMessage,
)


def _now() -> datetime:
    return datetime.now(UTC)


def _dm_key(user_a: str, user_b: str) -> tuple[str, str]:
    return tuple(sorted([user_a, user_b]))


def add_dm_message(user_a: str, user_b: str, message: dict) -> dict:
    ua, ub = _dm_key(user_a, user_b)
    with session_scope() as session:
        row = DmMessage(
            message_id=message["message_id"],
            user_a=ua,
            user_b=ub,
            sender_id=message["sender_id"],
            content=message["content"],
            created_at=datetime.fromisoformat(message["created_at"]),
        )
        session.add(row)
    return message


def list_dm_messages(user_a: str, user_b: str, *, limit: int = 500) -> list[dict]:
    ua, ub = _dm_key(user_a, user_b)
    with session_scope() as session:
        rows = session.scalars(
            select(DmMessage)
            .where(DmMessage.user_a == ua, DmMessage.user_b == ub)
            .order_by(DmMessage.created_at)
            .limit(limit)
        ).all()
        return [_dm_to_dict(row) for row in rows]


def create_group(group: dict) -> dict:
    with session_scope() as session:
        session.add(
            Group(
                group_id=group["group_id"],
                name=group["name"],
                description=group.get("description", ""),
                created_by=group["created_by"],
                created_at=datetime.fromisoformat(group["created_at"]),
            )
        )
        for member_id in group.get("members", []):
            session.add(GroupMember(group_id=group["group_id"], user_id=member_id))
    return group


def list_groups_for_user(user_id: str) -> list[dict]:
    with session_scope() as session:
        groups = session.scalars(select(Group)).all()
        result = []
        for group in groups:
            members = _member_ids(session, group.group_id)
            pending = _pending_ids(session, group.group_id)
            result.append(
                {
                    "group_id": group.group_id,
                    "name": group.name,
                    "description": group.description,
                    "member_count": len(members),
                    "joined": user_id in members,
                    "pending": user_id in pending,
                    "_members": members,
                    "_pending": pending,
                    "created_by": group.created_by,
                }
            )
        return result


def get_group(group_id: str) -> dict | None:
    with session_scope() as session:
        group = session.get(Group, group_id)
        if not group:
            return None
        return {
            "group_id": group.group_id,
            "name": group.name,
            "description": group.description,
            "created_by": group.created_by,
            "members": _member_ids(session, group_id),
            "pending_requests": _pending_ids(session, group_id),
            "created_at": group.created_at.isoformat(),
        }


def _message_preview(content: str, query: str, *, max_len: int = 100) -> str:
    q = query.strip().lower()
    text = content.strip()
    if not q:
        snippet = text[:max_len]
        return snippet + ("…" if len(text) > max_len else "")
    lower = text.lower()
    idx = lower.find(q)
    if idx < 0:
        snippet = text[:max_len]
        return snippet + ("…" if len(text) > max_len else "")
    start = max(0, idx - 24)
    end = min(len(text), idx + len(q) + 48)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return f"{prefix}{text[start:end]}{suffix}"


def search_messages(query: str, user_id: str, *, limit: int = 40) -> list[dict]:
    q = query.strip().lower()
    if not q:
        return []
    with session_scope() as session:
        hits: list[dict] = []

        dm_rows = session.scalars(
            select(DmMessage)
            .where(
                or_(DmMessage.user_a == user_id, DmMessage.user_b == user_id),
                func.lower(DmMessage.content).contains(q),
            )
            .order_by(DmMessage.created_at.desc())
            .limit(limit)
        ).all()
        for row in dm_rows:
            other_id = row.user_b if row.user_a == user_id else row.user_a
            hits.append(
                {
                    "message_id": row.message_id,
                    "content": row.content,
                    "preview": _message_preview(row.content, q),
                    "chat_type": "dm",
                    "target_id": other_id,
                    "created_at": row.created_at.isoformat(),
                    "sender_id": row.sender_id,
                }
            )

        member_group_ids = list(
            session.scalars(
                select(GroupMember.group_id).where(GroupMember.user_id == user_id)
            ).all()
        )
        if member_group_ids:
            group_rows = session.scalars(
                select(GroupMessage)
                .where(
                    GroupMessage.group_id.in_(member_group_ids),
                    func.lower(GroupMessage.content).contains(q),
                )
                .order_by(GroupMessage.created_at.desc())
                .limit(limit)
            ).all()
            for row in group_rows:
                hits.append(
                    {
                        "message_id": row.message_id,
                        "content": row.content,
                        "preview": _message_preview(row.content, q),
                        "chat_type": "group",
                        "target_id": row.group_id,
                        "created_at": row.created_at.isoformat(),
                        "sender_id": row.sender_id,
                    }
                )

        hits.sort(key=lambda item: item["created_at"], reverse=True)
        return hits[:limit]


def search_groups(query: str, user_id: str) -> list[dict]:
    q = query.strip().lower()
    with session_scope() as session:
        groups = session.scalars(select(Group)).all()
        items = []
        for group in groups:
            if q and q not in group.name.lower() and q not in (group.description or "").lower():
                continue
            members = _member_ids(session, group.group_id)
            pending = _pending_ids(session, group.group_id)
            items.append(
                {
                    "group_id": group.group_id,
                    "name": group.name,
                    "description": group.description,
                    "joined": user_id in members,
                    "pending": user_id in pending,
                }
            )
        return items


def request_join(group_id: str, user_id: str) -> None:
    with session_scope() as session:
        if user_id in _member_ids(session, group_id):
            return
        session.merge(GroupJoinRequest(group_id=group_id, user_id=user_id))


def list_pending_requests(group_id: str) -> list[str]:
    with session_scope() as session:
        return _pending_ids(session, group_id)


def handle_join_request(group_id: str, requester_id: str, approve: bool) -> None:
    with session_scope() as session:
        session.execute(
            delete(GroupJoinRequest).where(
                GroupJoinRequest.group_id == group_id,
                GroupJoinRequest.user_id == requester_id,
            )
        )
        if approve:
            session.merge(GroupMember(group_id=group_id, user_id=requester_id))


def add_group_message(group_id: str, message: dict) -> dict:
    with session_scope() as session:
        session.add(
            GroupMessage(
                message_id=message["message_id"],
                group_id=group_id,
                sender_id=message["sender_id"],
                content=message["content"],
                created_at=datetime.fromisoformat(message["created_at"]),
            )
        )
    return message


def list_group_messages(group_id: str, *, limit: int = 500) -> list[dict]:
    with session_scope() as session:
        rows = session.scalars(
            select(GroupMessage)
            .where(GroupMessage.group_id == group_id)
            .order_by(GroupMessage.created_at)
            .limit(limit)
        ).all()
        return [_group_msg_to_dict(row) for row in rows]


def get_analysis_state(chat_key: str) -> str | None:
    with session_scope() as session:
        row = session.get(ChatAnalysisState, chat_key)
        return row.last_message_id if row else None


def set_analysis_state(chat_key: str, last_message_id: str) -> None:
    with session_scope() as session:
        session.merge(
            ChatAnalysisState(chat_key=chat_key, last_message_id=last_message_id),
        )


def clear_analysis_state(chat_key: str) -> None:
    with session_scope() as session:
        row = session.get(ChatAnalysisState, chat_key)
        if row:
            session.delete(row)
        session.execute(delete(ChatTaskAnalysisBatch).where(ChatTaskAnalysisBatch.chat_key == chat_key))


def count_analysis_batches(chat_key: str) -> int:
    with session_scope() as session:
        rows = session.scalars(
            select(ChatTaskAnalysisBatch.batch_index).where(
                ChatTaskAnalysisBatch.chat_key == chat_key,
            ),
        ).all()
        return len(rows)


def list_analysis_batches(chat_key: str) -> list[dict]:
    with session_scope() as session:
        rows = session.scalars(
            select(ChatTaskAnalysisBatch)
            .where(ChatTaskAnalysisBatch.chat_key == chat_key)
            .order_by(ChatTaskAnalysisBatch.batch_index),
        ).all()
        return [
            {
                "batch_index": row.batch_index,
                "first_message_id": row.first_message_id,
                "last_message_id": row.last_message_id,
                "message_ids": list(row.message_ids or []),
                "message_count": len(row.message_ids or []),
                "analyzed_at": row.analyzed_at.isoformat(),
            }
            for row in rows
        ]


def add_analysis_batch(
    chat_key: str,
    *,
    batch_index: int,
    first_message_id: str,
    last_message_id: str,
    message_ids: list[str],
) -> None:
    with session_scope() as session:
        session.merge(
            ChatTaskAnalysisBatch(
                chat_key=chat_key,
                batch_index=batch_index,
                first_message_id=first_message_id,
                last_message_id=last_message_id,
                message_ids=message_ids,
                analyzed_at=_now(),
            ),
        )


def delete_dm_conversation(user_a: str, user_b: str) -> int:
    ua, ub = _dm_key(user_a, user_b)
    with session_scope() as session:
        result = session.execute(
            delete(DmMessage).where(DmMessage.user_a == ua, DmMessage.user_b == ub)
        )
        return int(result.rowcount or 0)


def delete_group_messages(group_id: str) -> int:
    with session_scope() as session:
        result = session.execute(delete(GroupMessage).where(GroupMessage.group_id == group_id))
        return int(result.rowcount or 0)


def get_dm_message(message_id: str) -> dict | None:
    with session_scope() as session:
        row = session.get(DmMessage, message_id)
        if not row:
            return None
        return {
            **_dm_to_dict(row),
            "user_a": row.user_a,
            "user_b": row.user_b,
        }


def get_group_message(message_id: str) -> dict | None:
    with session_scope() as session:
        row = session.get(GroupMessage, message_id)
        if not row:
            return None
        return {**_group_msg_to_dict(row), "group_id": row.group_id}


def delete_dm_message(message_id: str) -> bool:
    with session_scope() as session:
        row = session.get(DmMessage, message_id)
        if not row:
            return False
        session.delete(row)
        return True


def delete_group_message(message_id: str) -> bool:
    with session_scope() as session:
        row = session.get(GroupMessage, message_id)
        if not row:
            return False
        session.delete(row)
        return True


def _member_ids(session, group_id: str) -> list[str]:
    return list(
        session.scalars(
            select(GroupMember.user_id).where(GroupMember.group_id == group_id)
        ).all()
    )


def _pending_ids(session, group_id: str) -> list[str]:
    return list(
        session.scalars(
            select(GroupJoinRequest.user_id).where(GroupJoinRequest.group_id == group_id)
        ).all()
    )


def _dm_to_dict(row: DmMessage) -> dict:
    return {
        "message_id": row.message_id,
        "sender_id": row.sender_id,
        "content": row.content,
        "created_at": row.created_at.isoformat(),
    }


def _group_msg_to_dict(row: GroupMessage) -> dict:
    return {
        "message_id": row.message_id,
        "sender_id": row.sender_id,
        "content": row.content,
        "created_at": row.created_at.isoformat(),
    }
