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
- Core domain services (no API integration for now)

## Module Tracker

- **Module**: AI Team Assistant
  - **Owner**: Team
  - **Status**: `building`
  - **Build Now**:
    - standalone summarization service
    - standalone task extraction and owner assignment
    - standalone deadline reminder generation
  - **Enhance Later**:
    - owner auto-suggestion confidence scoring
    - recurring reminders and digest mode
  - **Blocked By**:
    - none

- **Module**: Workflow & Milestones
  - **Owner**: Team
  - **Status**: `building`
  - **Build Now**:
    - standalone workflow item lifecycle service
    - stage transition validator (Idea -> Brief -> Production -> Review -> Publish)
    - standalone milestone create/update tracking
  - **Enhance Later**:
    - SLA breach alerts
    - approval policy templates by content type
  - **Blocked By**:
    - none

- **Module**: Ingest/Summary/Query/Trend Core
  - **Owner**: Team
  - **Status**: `not_started`
  - **Build Now**:
    - deferred while Team + Workflow module is being built
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
- 2026-04-20: Implemented standalone Team Assistant and Workflow core services with tests; API integration intentionally deferred.
- 2026-04-20: Added root requirements, environment template, root README, and created local `.venv`.
- 2026-04-21: Added a simple Streamlit frontend (`frontend/app.py`) to test Team Assistant and Workflow/Milestones modules end-to-end.
