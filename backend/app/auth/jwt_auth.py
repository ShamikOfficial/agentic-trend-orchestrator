from __future__ import annotations

import os
from typing import Any

import jwt
from jwt import PyJWTError

from backend.app.env import load_app_env
from backend.app.persistence import auth_repo

load_app_env()


def _secret() -> str:
    secret = os.getenv("AUTH_JWT_SECRET", "").strip() or os.getenv("AUTH_SECRET", "").strip()
    if not secret:
        return ""
    return secret


def _issuer() -> str | None:
    raw = os.getenv("AUTH_JWT_ISSUER", "").strip().rstrip("/")
    return raw or None


def verify_bearer_token(token: str) -> dict[str, Any] | None:
    secret = _secret()
    if not secret:
        return None
    options: dict[str, Any] = {"verify_aud": False}
    kwargs: dict[str, Any] = {"algorithms": ["HS256"], "options": options}
    issuer = _issuer()
    if issuer:
        kwargs["issuer"] = issuer
    try:
        return jwt.decode(token, secret, **kwargs)
    except PyJWTError:
        if not issuer:
            return None
        # Allow deployments that omit AUTH_JWT_ISSUER on the API after setting AUTH_URL on Vercel.
        try:
            return jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_aud": False, "verify_iss": False},
            )
        except PyJWTError:
            return None


def resolve_user_from_bearer(token: str) -> str | None:
    claims = verify_bearer_token(token)
    if not claims:
        return None

    provider = str(claims.get("provider") or "")
    subject = str(claims.get("providerAccountId") or claims.get("sub") or "")
    email = claims.get("email")
    if isinstance(email, str):
        email = email.lower()

    if provider and subject:
        user = auth_repo.find_user_by_oauth(provider, subject)
        if user:
            return user["user_id"]

    if email:
        user = auth_repo.find_user_by_email(email)
        if user:
            return user["user_id"]

    return None
