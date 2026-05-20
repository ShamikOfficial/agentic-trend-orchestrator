from __future__ import annotations

import os
from datetime import UTC, date, datetime

from fastapi import HTTPException
from sqlalchemy import func, select

from backend.app.persistence.db import session_scope
from backend.app.persistence.models import LlmUsageEvent, UserLlmQuota


class QuotaExceededError(Exception):
    def __init__(self, tokens_used: int, token_budget: int, detail: str) -> None:
        super().__init__(detail)
        self.tokens_used = tokens_used
        self.token_budget = token_budget
        self.detail = detail


def _month_start(today: date | None = None) -> date:
    d = today or datetime.now(UTC).date()
    return d.replace(day=1)


def _default_budget() -> int:
    return int(os.getenv("LLM_MONTHLY_TOKEN_BUDGET", "200000"))


def _max_requests_per_day() -> int:
    return int(os.getenv("LLM_MAX_REQUESTS_PER_DAY", "50"))


def _quota_enforced() -> bool:
    """Skip trial limits locally unless explicitly enabled."""
    if os.getenv("LLM_QUOTA_DISABLED", "").strip().lower() in ("1", "true", "yes"):
        return False
    if os.getenv("APP_ENV", "").strip().lower() == "development":
        enforce = os.getenv("LLM_QUOTA_ENFORCE_IN_DEV", "").strip().lower()
        if enforce not in ("1", "true", "yes"):
            return False
    return True


def _ensure_quota_row(session, user_id: str) -> UserLlmQuota:
    period = _month_start()
    row = session.get(UserLlmQuota, user_id)
    if row is None or row.period_start != period:
        if row is None:
            row = UserLlmQuota(
                user_id=user_id,
                period_start=period,
                token_budget=_default_budget(),
                tokens_used=0,
                max_requests_per_day=_max_requests_per_day(),
                requests_today=0,
                requests_day=None,
            )
            session.add(row)
        else:
            row.period_start = period
            row.token_budget = _default_budget()
            row.tokens_used = 0
            row.requests_today = 0
            row.requests_day = None
    row.token_budget = _default_budget()
    row.max_requests_per_day = _max_requests_per_day()
    session.flush()
    return row


def check_and_reserve_quota(user_id: str, estimated_tokens: int = 4000) -> None:
    if not _quota_enforced():
        return
    today = datetime.now(UTC).date()
    with session_scope() as session:
        row = _ensure_quota_row(session, user_id)
        if row.requests_day != today:
            row.requests_day = today
            row.requests_today = 0
        if row.requests_today >= row.max_requests_per_day:
            raise QuotaExceededError(
                int(row.tokens_used),
                int(row.token_budget),
                "Daily AI request limit reached.",
            )
        if int(row.tokens_used) + estimated_tokens > int(row.token_budget):
            raise QuotaExceededError(
                int(row.tokens_used),
                int(row.token_budget),
                "Monthly AI trial limit reached.",
            )
        row.requests_today += 1
        session.flush()


def record_usage(
    user_id: str,
    *,
    feature: str,
    model: str,
    prompt_tokens: int,
    output_tokens: int,
    total_tokens: int,
) -> None:
    with session_scope() as session:
        row = _ensure_quota_row(session, user_id)
        row.tokens_used = int(row.tokens_used) + total_tokens
        session.add(
            LlmUsageEvent(
                user_id=user_id,
                feature=feature,
                model=model,
                prompt_tokens=prompt_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                created_at=datetime.now(UTC),
            )
        )


def usage_summary_for_month() -> list[dict]:
    period = _month_start()
    with session_scope() as session:
        rows = session.execute(
            select(
                LlmUsageEvent.user_id,
                func.sum(LlmUsageEvent.total_tokens).label("total_tokens"),
                func.count().label("call_count"),
            )
            .where(LlmUsageEvent.created_at >= datetime.combine(period, datetime.min.time(), tzinfo=UTC))
            .group_by(LlmUsageEvent.user_id)
        ).all()
        return [
            {"user_id": user_id, "total_tokens": int(total or 0), "call_count": int(count or 0)}
            for user_id, total, count in rows
        ]


def quota_exceeded_http(exc: QuotaExceededError) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail={
            "detail": exc.detail,
            "tokens_used": exc.tokens_used,
            "token_budget": exc.token_budget,
        },
    )
