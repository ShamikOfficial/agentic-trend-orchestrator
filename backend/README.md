# Backend Setup

FastAPI backend for the web MVP.

## Current Entrypoints
- `app/main.py` - app bootstrap, CORS, auth middleware, API logging, static uploads mount
- `app/api/routes/health.py` - health endpoint
- `app/api/routes/chat.py` - auth + chat APIs
- `app/api/routes/team.py` - team assistant APIs
- `app/api/routes/workflow.py` - workflow and milestone APIs
- `app/services/` - module business logic
- `app/models/` - pydantic schemas

## Implemented API Modules
- Health
- Auth
- Team Assistant
- Workflow + Milestones + Uploads
- Chat (DM + Groups)

## Current Storage Model
- In-memory stores for users, tokens, messages, tasks, workflow items, milestones, and logs.
- Upload files stored under repository `uploads/`.

## Run
```bash
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

## Next Backend Milestones
- Add persistent data layer (DB-backed models)
- Add async jobs for ingest/query/trend/export pipeline
- Add teammate workflow adapters for video processing modules
