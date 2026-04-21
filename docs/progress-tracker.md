# Product Progress Tracker

Use this as the live status board for what to build, enhance, or start next.

Status values:
- `not_started`
- `building`
- `enhancing`
- `blocked`
- `done`

## Current Sprint Focus
- AI Team Assistant
- Workflow & Milestones

## Module Tracker

- **Module**: AI Team Assistant
  - **Owner**: Team
  - **Status**: `building`
  - **Build Now**:
    - `POST /api/v1/team/summaries`
    - `POST /api/v1/team/tasks/extract`
    - `GET /api/v1/team/tasks`
    - `PATCH /api/v1/team/tasks/{task_id}`
    - `POST /api/v1/team/reminders/run`
  - **Enhance Later**:
    - owner auto-suggestion confidence scoring
    - recurring reminders and digest mode
  - **Blocked By**:
    - none

- **Module**: Workflow & Milestones
  - **Owner**: Team
  - **Status**: `building`
  - **Build Now**:
    - `POST /api/v1/workflow/items`
    - `GET /api/v1/workflow/items`
    - `PATCH /api/v1/workflow/items/{item_id}/stage`
    - `POST /api/v1/workflow/milestones`
    - `PATCH /api/v1/workflow/milestones/{milestone_id}`
  - **Enhance Later**:
    - SLA breach alerts
    - approval policy templates by content type
  - **Blocked By**:
    - none

- **Module**: Ingest/Summary/Query/Trend Core
  - **Owner**: Team
  - **Status**: `building`
  - **Build Now**:
    - health + jobs API
    - ingest, summary, query, trend wrappers
  - **Enhance Later**:
    - richer source citations and analytics

- **Module**: Ideation
  - **Owner**: Team
  - **Status**: `not_started`
  - **Build Now**:
    - `POST /api/v1/ideation/generate`
  - **Enhance Later**:
    - style/persona presets

## Structure Checklist
- `backend/` scaffold created
- `frontend/` scaffold created
- `docs/api-contract.md` maintained
- `docs/api-coverage-matrix.md` maintained
- `docs/progress-tracker.md` maintained
- API route placeholders created for team/workflow/health
- backend model and service placeholders created
- frontend page placeholders created for team and workflow

## Update Protocol
When any feature changes:
1. Update endpoint details in `docs/api-contract.md`.
2. Update status in `docs/api-coverage-matrix.md`.
3. Update module status and notes in `docs/progress-tracker.md`.
4. Add a short dated note below.

## Update Log
- 2026-04-20: Initialized tracker and set Team Assistant + Workflow as active build focus.
- 2026-04-20: Created initial repository structure and placeholder files for backend routes, models, services, tests, and frontend pages.
