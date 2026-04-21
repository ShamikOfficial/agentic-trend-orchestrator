from pathlib import Path
from time import perf_counter

from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.routes import health, team, workflow


app = FastAPI(title="Web MVP API", version="0.1.0")
_api_log_path = Path("logs/api_calls.log")
_api_log_path.parent.mkdir(parents=True, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(team.router, prefix="/api/v1", tags=["team"])
app.include_router(workflow.router, prefix="/api/v1", tags=["workflow"])


@app.middleware("http")
async def log_api_calls(request: Request, call_next):
    start = perf_counter()
    response = await call_next(request)
    elapsed_ms = (perf_counter() - start) * 1000
    line = (
        f"{request.method} {request.url.path} "
        f"status={response.status_code} duration_ms={elapsed_ms:.2f}\n"
    )
    with _api_log_path.open("a", encoding="utf-8") as f:
        f.write(line)
    return response
