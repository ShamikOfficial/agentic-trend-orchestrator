from __future__ import annotations

import os

from fastapi import APIRouter, Header, HTTPException

from backend.app.persistence import llm_repo

router = APIRouter()


@router.get("/admin/usage/summary")
def usage_summary(x_admin_key: str | None = Header(default=None, alias="x-admin-key")) -> dict:
    expected = os.getenv("ADMIN_API_KEY", "").strip()
    if not expected or x_admin_key != expected:
        raise HTTPException(status_code=403, detail="Forbidden.")
    return {"items": llm_repo.usage_summary_for_month()}
