import os
import re
from pathlib import Path
from time import perf_counter

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.app import auth_state
from backend.app.api.routes import chat, health, team, trend_analytics, workflow


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


app = FastAPI(title="Web MVP API", version="0.1.0")
_api_log_path = Path("logs/api_calls.log")
_api_log_path.parent.mkdir(parents=True, exist_ok=True)

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
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.middleware("http")
async def log_api_calls(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    is_auth_endpoint = path in ("/api/v1/auth/register", "/api/v1/auth/login")
    protected_api = path.startswith("/api/v1") and not is_auth_endpoint and path != "/api/v1/health"
    token = request.headers.get("x-auth-token")
    user_id = auth_state.resolve_user_from_token(token)

    if protected_api and not user_id:
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
