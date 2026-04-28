# Product Progress Tracker

Live status board for shipped modules and next milestones.

Status values:
- `not_started`
- `building`
- `enhancing`
- `blocked`
- `done`

## Current Sprint Focus
- Stabilize auth-protected Team/Workflow/Chat web experience
- Tighten API contracts to match implementation
- Prepare persistence + async pipeline follow-up work

## Module Tracker

- **Module**: Authentication + Session Guard
  - **Owner**: Team
  - **Status**: `done`
  - **Shipped**:
    - register/login/me API endpoints
    - token-based request protection middleware (`x-auth-token`)
    - frontend login/register panel + redirect guard flow
  - **Enhance Later**:
    - persistent user/token storage beyond in-memory backend runtime
    - stronger auth model (JWT/refresh/session invalidation)

- **Module**: Team Assistant
  - **Owner**: Team
  - **Status**: `enhancing`
  - **Shipped**:
    - summary generation endpoint
    - task extraction and task update endpoints
    - unified process endpoint (`/team/process`) for classify + summarize + tasks
    - note logs endpoint and reminders endpoint
    - Team workspace UI with task board, logs tab, reminder actions
  - **Enhance Later**:
    - richer categorization taxonomy and confidence output
    - durable storage and filtering/sorting options

- **Module**: Workflow & Milestones
  - **Owner**: Team
  - **Status**: `enhancing`
  - **Shipped**:
    - create/list/get/update/delete workflow items
    - stage transition endpoint with validation
    - create/update milestones
    - file upload endpoint and static file serving
    - activity logs endpoint
    - drag-and-drop dashboard + create/edit flows in frontend
  - **Enhance Later**:
    - milestone listing/filtering endpoints
    - approval policies and SLA alerts

- **Module**: Chat (DM + Group)
  - **Owner**: Team
  - **Status**: `building`
  - **Shipped**:
    - user discovery + DM send/list
    - group create/list/search
    - join-request workflow and admin approve/reject
    - group messaging send/list
    - chat UI with DM/group modes and request management
  - **Enhance Later**:
    - persistent message/group storage
    - unread indicators and notifications

- **Module**: Ingest/Summary/Query/Trend Core
  - **Owner**: Team
  - **Status**: `not_started`
  - **Build Next**:
    - teammate adapter layer for ingest/query/trend/export
    - async job endpoints for long-running tasks

- **Module**: Ideation
  - **Owner**: Team
  - **Status**: `not_started`
  - **Build Next**:
    - `POST /api/v1/ideation/generate`

## Structure Checklist
- `backend/` FastAPI app with health/team/workflow/chat routes
- `frontend/` Next.js app with home, team, workflow, and chat pages
- `uploads/` static file mount for workflow attachments
- `logs/api_calls.log` request logging enabled
- `docs/api-contract.md` maintained
- `docs/api-coverage-matrix.md` maintained
- `docs/progress-tracker.md` maintained
- `docs/figma-ui-status.md` maintained

## Update Protocol
When any feature changes:
1. Update endpoint details in `docs/api-contract.md`.
2. Update status in `docs/api-coverage-matrix.md`.
3. Update module status and notes in `docs/progress-tracker.md`.
4. Add a short dated note below.

## Update Log
- 2026-04-20: Initialized tracker and set Team Assistant + Workflow as active build focus.
- 2026-04-20: Created repository structure and initial backend/frontend foundations.
- 2026-04-20: Implemented standalone Team Assistant and Workflow core services.
- 2026-04-21: Switched UI foundation to Next.js + Tailwind + shadcn/ui.
- 2026-04-27: Added auth + chat APIs, protected middleware, and full Team/Workflow/Chat page wiring; updated docs to reflect implemented state.
- 2026-04-27: Synced Figma screen inventory in `docs/figma-ui-status.md` and confirmed current available screen list.
- 2026-04-27: Implemented basic ScriptHome/Brief/Editor/Variations/Storyboard/Save routes under `/app/*`, wired available backend endpoints, and added development placeholders for missing features.
- 2026-04-27: Implemented basic `ProjectProgress` at `/app/progress` using workflow items/logs with simple placeholder logic for missing deep-link integrations.
- 2026-04-27: Rewired app flow to mirror Figma route map, aligned sidebar order (Chat, Script Generation, Video Upload & Report, Progress Tracker, My Tasks), and added missing `/app/*` bridge screens (`chat`, `tasks`, `upload`, `report`, `chat-brief`, `chat-tasks`, `chat-review`, `report-chat`).
- 2026-04-27: Wired `/app/upload` to FastAPI trend analytics ingest via new `/api/v1/trend/upload` endpoint; uploaded videos now flow into trend analytics processing for downstream summary/trend use.
