import os
import re
from pathlib import Path
from time import perf_counter

from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.app import auth_state
from backend.app.api.routes import admin, chat, health, team, trend_analytics, workflow
from backend.app.auth import jwt_auth
from backend.app.env import load_app_env
from backend.app.persistence.db import get_engine
from backend.app.persistence.models import Base

load_app_env()


def _cors_allow_origins() -> list[str]:
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    extra = os.environ.get("CORS_ORIGINS", "").strip()
    for part in extra.split(","):
        o = part.strip()
        if o and o not in origins:
            origins.append(o)
    return origins


def _cors_allow_origin_regex() -> str | None:
    raw = os.environ.get("CORS_ORIGIN_REGEX", "").strip()
    if raw:
        re.compile(raw)
        return raw
    flag = os.environ.get("CORS_ALLOW_VERCEL", "true").strip().lower()
    if flag in ("0", "false", "no"):
        return None
    return r"https://.*\.vercel\.app$"


def _upload_root() -> Path:
    root = Path(os.environ.get("UPLOAD_ROOT", "uploads"))
    root.mkdir(parents=True, exist_ok=True)
    return root


def _resolve_user_id(request: Request) -> str | None:
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        bearer = auth_header[7:].strip()
        if bearer:
            claims = jwt_auth.verify_bearer_token(bearer)
            if claims:
                request.state.jwt_claims = claims
                uid = jwt_auth.resolve_user_from_bearer(bearer)
                if uid:
                    return uid
    token = request.headers.get("x-auth-token")
    return auth_state.resolve_user_from_token(token)


def _is_public_path(path: str, method: str) -> bool:
    if path == "/api/v1/health":
        return True
    if path in ("/api/v1/auth/register", "/api/v1/auth/login") and method == "POST":
        return True
    return False


def _allows_jwt_only(path: str, method: str) -> bool:
    return path == "/api/v1/auth/oauth/sync" and method == "POST"


app = FastAPI(title="Web MVP API", version="0.1.0")
_api_log_path = Path("logs/api_calls.log")
_api_log_path.parent.mkdir(parents=True, exist_ok=True)

_upload_dir = _upload_root()

_cors_regex = _cors_allow_origin_regex()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allow_origins(),
    allow_origin_regex=_cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(team.router, prefix="/api/v1", tags=["team"])
app.include_router(workflow.router, prefix="/api/v1", tags=["workflow"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(trend_analytics.router, prefix="/api/v1", tags=["trend-analytics"])
app.include_router(admin.router, prefix="/api/v1", tags=["admin"])
app.mount("/uploads", StaticFiles(directory=str(_upload_dir)), name="uploads")


@app.on_event("startup")
def on_startup() -> None:
    engine = get_engine()
    Base.metadata.create_all(bind=engine)


@app.middleware("http")
async def log_api_calls(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    user_id = _resolve_user_id(request)
    if user_id:
        request.state.user_id = user_id

    protected_api = path.startswith("/api/v1") and not _is_public_path(path, request.method)
    if protected_api:
        if _allows_jwt_only(path, request.method):
            if not getattr(request.state, "jwt_claims", None):
                return JSONResponse(status_code=401, content={"detail": "Valid OAuth JWT required."})
        elif not user_id:
            return JSONResponse(status_code=401, content={"detail": "Login required."})

    start = perf_counter()
    response = await call_next(request)
    elapsed_ms = (perf_counter() - start) * 1000
    line = (
        f"{request.method} {request.url.path} "
        f"status={response.status_code} duration_ms={elapsed_ms:.2f} "
        f"user={user_id or 'anonymous'}\n"
    )
    with _api_log_path.open("a", encoding="utf-8") as f:
        f.write(line)
    return response
