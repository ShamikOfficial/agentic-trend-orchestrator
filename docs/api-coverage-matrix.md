# API Coverage Matrix

This document tracks API scope, teammate coverage, and build status.

Status values:
- `exists_in_teammate`: logic exists in teammate repo module/CLI.
- `wrapped`: selected to expose via backend API first.
- `new_required`: required by web UI but not directly present as callable service.
- `planned`: future module in MVP plan, not started.
- `building`: currently being implemented.
- `enhancing`: implemented baseline, now improving behavior/quality.

## Core Pipeline APIs

- **Feature**: Ingest
  - **Endpoint**: `POST /api/v1/ingest`
  - **Teammate Source**: `ingest.py::ingest_video`
  - **Status**: `wrapped`
  - **Notes**: Long-running; must use async jobs.

- **Feature**: Ingest
  - **Endpoint**: `POST /api/v1/ingest/batch`
  - **Teammate Source**: `run.py::cmd_ingest_all`
  - **Status**: `wrapped`
  - **Notes**: Uses folder-level processing; add input validation for directory.

- **Feature**: Summary
  - **Endpoint**: `GET /api/v1/summary/{file_id}`
  - **Teammate Source**: `summarize.py::summarize_video`, `summarize.py::detect_niche_topic`
  - **Status**: `wrapped`
  - **Notes**: If summary exists in `video_summaries`, prefer cached read.

- **Feature**: Query
  - **Endpoint**: `POST /api/v1/query`
  - **Teammate Source**: `query.py` (embed + search + answer)
  - **Status**: `wrapped`
  - **Notes**: Support global and `file_id` scoped modes.

- **Feature**: Trend
  - **Endpoint**: `POST /api/v1/trend/{niche}`
  - **Teammate Source**: `trend.py::run_trend`
  - **Status**: `wrapped`
  - **Notes**: Prefer async and persist job output for retrieval.

- **Feature**: Trend
  - **Endpoint**: `GET /api/v1/trend/jobs/{job_id}`
  - **Teammate Source**: none (API orchestration)
  - **Status**: `new_required`
  - **Notes**: Needed to fetch async results in frontend.

- **Feature**: Export
  - **Endpoint**: `POST /api/v1/export`
  - **Teammate Source**: `export.py::export_all`
  - **Status**: `wrapped`
  - **Notes**: Expose as async job due to potential runtime.

- **Feature**: Platform
  - **Endpoint**: `GET /api/v1/health`
  - **Teammate Source**: none
  - **Status**: `new_required`
  - **Notes**: Should include OpenAI and Milvus checks.

- **Feature**: Platform
  - **Endpoint**: `GET /api/v1/jobs/{job_id}`
  - **Teammate Source**: none
  - **Status**: `new_required`
  - **Notes**: Shared async polling contract.

## Web UI Support APIs

- **Feature**: Memory
  - **Endpoint**: `GET /api/v1/videos`
  - **Teammate Source**: `video_summaries` query via `db.py`
  - **Status**: `new_required`
  - **Notes**: Needed for dashboard list/filter/pagination.

- **Feature**: Memory
  - **Endpoint**: `GET /api/v1/videos/{file_id}`
  - **Teammate Source**: `video_summaries` query
  - **Status**: `new_required`
  - **Notes**: Needed for detail drawer/page.

- **Feature**: Ideation
  - **Endpoint**: `POST /api/v1/ideation/generate`
  - **Teammate Source**: combines `trend.py` + `query.py` context
  - **Status**: `planned`
  - **Notes**: Wrapper endpoint for frontend ideation panel.

- **Feature**: Team
  - **Endpoint**: `POST /api/v1/team/summaries`
  - **Teammate Source**: none
  - **Status**: `building`
  - **Notes**: Priority module for chat/meeting summarization.

- **Feature**: Team
  - **Endpoint**: `POST /api/v1/team/tasks/extract`
  - **Teammate Source**: none
  - **Status**: `building`
  - **Notes**: Extract structured tasks from summary/transcript.

- **Feature**: Team
  - **Endpoint**: `GET /api/v1/team/tasks`, `PATCH /api/v1/team/tasks/{task_id}`
  - **Teammate Source**: none
  - **Status**: `building`
  - **Notes**: Ownership, due-date, priority, and status updates.

- **Feature**: Team
  - **Endpoint**: `POST /api/v1/team/reminders/run`
  - **Teammate Source**: none
  - **Status**: `building`
  - **Notes**: Detect near-due/overdue tasks and generate reminder payloads.

- **Feature**: Workflow
  - **Endpoint**: `POST /api/v1/workflow/items`, `GET /api/v1/workflow/items`
  - **Teammate Source**: none
  - **Status**: `building`
  - **Notes**: Board model for Idea -> Brief -> Production -> Review -> Publish.

- **Feature**: Workflow
  - **Endpoint**: `PATCH /api/v1/workflow/items/{item_id}/stage`
  - **Teammate Source**: none
  - **Status**: `building`
  - **Notes**: Transition validation and optional rollback rules.

- **Feature**: Workflow
  - **Endpoint**: `POST /api/v1/workflow/milestones`, `PATCH /api/v1/workflow/milestones/{milestone_id}`
  - **Teammate Source**: none
  - **Status**: `building`
  - **Notes**: Deadline checkpoints and completion tracking.

## Suggested Build Order
1. `GET /api/v1/health`
2. Async infra: `GET /api/v1/jobs/{job_id}`
3. `POST /api/v1/ingest`
4. `GET /api/v1/summary/{file_id}`
5. `POST /api/v1/query`
6. `POST /api/v1/trend/{niche}` + `GET /api/v1/trend/jobs/{job_id}`
7. `GET /api/v1/videos`
8. `POST /api/v1/export`
9. Team Assistant APIs: summaries, task extraction, task updates, reminders
10. Workflow APIs: items, stage transitions, milestones
11. Planned module after current focus: ideation

## Change Log
- 2026-04-20: Initial matrix created from teammate repo `trend-detection-content-workflow`.
- 2026-04-20: Prioritized Team Assistant + Workflow & Milestones APIs and marked as `building`.
