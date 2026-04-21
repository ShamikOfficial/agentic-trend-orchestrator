from fastapi import FastAPI

from app.api.routes import health, team, workflow


app = FastAPI(title="Web MVP API", version="0.1.0")

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(team.router, prefix="/api/v1", tags=["team"])
app.include_router(workflow.router, prefix="/api/v1", tags=["workflow"])
