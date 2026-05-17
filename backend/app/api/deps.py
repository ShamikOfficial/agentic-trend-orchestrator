from __future__ import annotations

from fastapi import HTTPException, Request


def current_user_id(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required.")
    return str(user_id)
