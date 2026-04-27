# API Coverage Matrix

Tracks API scope and real implementation status in this repository.

Status values:
- `done`: implemented and used by frontend or verified callable
- `building`: implemented baseline but still evolving
- `planned`: not implemented yet

## Platform + Auth

- **Feature**: Platform
  - **Endpoint**: `GET /api/v1/health`
  - **Status**: `done`
  - **Notes**: returns API status and dependency flags (currently static false values for external services).

- **Feature**: Auth
  - **Endpoint**: `POST /api/v1/auth/register`
  - **Status**: `done`
  - **Notes**: in-memory user creation.

- **Feature**: Auth
  - **Endpoint**: `POST /api/v1/auth/login`
  - **Status**: `done`
  - **Notes**: returns token + safe user payload.

- **Feature**: Auth
  - **Endpoint**: `GET /api/v1/auth/me`
  - **Status**: `done`
  - **Notes**: requires `x-auth-token`.

- **Feature**: Security
  - **Endpoint**: middleware guard over `/api/v1/**`
  - **Status**: `done`
  - **Notes**: all protected routes require token except `/health`, `/auth/register`, `/auth/login`.

## Team Assistant APIs

- **Feature**: Team
  - **Endpoint**: `POST /api/v1/team/summaries`
  - **Status**: `done`
  - **Notes**: summarize input and seed task objects.

- **Feature**: Team
  - **Endpoint**: `POST /api/v1/team/tasks/extract`
  - **Status**: `done`
  - **Notes**: extract tasks from raw content or summary reference.

- **Feature**: Team
  - **Endpoint**: `POST /api/v1/team/process`
  - **Status**: `done`
  - **Notes**: unified classify + summarize + task extraction; used in UI.

- **Feature**: Team
  - **Endpoint**: `GET /api/v1/team/notes/logs`
  - **Status**: `done`
  - **Notes**: returns structured note processing logs.

- **Feature**: Team
  - **Endpoint**: `GET /api/v1/team/tasks`
  - **Status**: `done`
  - **Notes**: list extracted tasks.

- **Feature**: Team
  - **Endpoint**: `PATCH /api/v1/team/tasks/{task_id}`
  - **Status**: `done`
  - **Notes**: update owner/status/due_date/notes.

- **Feature**: Team
  - **Endpoint**: `POST /api/v1/team/reminders/run`
  - **Status**: `done`
  - **Notes**: computes due-soon/overdue reminders.

## Workflow APIs

- **Feature**: Workflow
  - **Endpoint**: `POST /api/v1/workflow/items`
  - **Status**: `done`
  - **Notes**: create work item with metadata.

- **Feature**: Workflow
  - **Endpoint**: `POST /api/v1/workflow/uploads`
  - **Status**: `done`
  - **Notes**: upload attachment and return `/uploads/...` URL.

- **Feature**: Workflow
  - **Endpoint**: `GET /api/v1/workflow/items`
  - **Status**: `done`
  - **Notes**: list all workflow items.

- **Feature**: Workflow
  - **Endpoint**: `GET /api/v1/workflow/items/{item_id}`
  - **Status**: `done`
  - **Notes**: fetch one workflow item.

- **Feature**: Workflow
  - **Endpoint**: `PATCH /api/v1/workflow/items/{item_id}`
  - **Status**: `done`
  - **Notes**: update work item fields.

- **Feature**: Workflow
  - **Endpoint**: `DELETE /api/v1/workflow/items/{item_id}`
  - **Status**: `done`
  - **Notes**: deletes item and linked milestones.

- **Feature**: Workflow
  - **Endpoint**: `PATCH /api/v1/workflow/items/{item_id}/stage`
  - **Status**: `done`
  - **Notes**: validates transitions via workflow service.

- **Feature**: Workflow
  - **Endpoint**: `GET /api/v1/workflow/logs`
  - **Status**: `done`
  - **Notes**: activity log stream.

- **Feature**: Workflow
  - **Endpoint**: `POST /api/v1/workflow/milestones`
  - **Status**: `done`
  - **Notes**: create milestone for existing item.

- **Feature**: Workflow
  - **Endpoint**: `PATCH /api/v1/workflow/milestones/{milestone_id}`
  - **Status**: `done`
  - **Notes**: update milestone fields.

## Chat APIs

- **Feature**: Chat
  - **Endpoint**: `GET /api/v1/chat/users`
  - **Status**: `done`
  - **Notes**: list users excluding current user.

- **Feature**: Chat
  - **Endpoint**: `POST /api/v1/chat/dm/{target_user_id}`, `GET /api/v1/chat/dm/{target_user_id}`
  - **Status**: `done`
  - **Notes**: direct message send/list.

- **Feature**: Chat
  - **Endpoint**: `POST /api/v1/chat/groups`, `GET /api/v1/chat/groups`
  - **Status**: `done`
  - **Notes**: group create/list with joined/pending info.

- **Feature**: Chat
  - **Endpoint**: `GET /api/v1/chat/search`
  - **Status**: `done`
  - **Notes**: search users and groups.

- **Feature**: Chat
  - **Endpoint**: `POST /api/v1/chat/groups/{group_id}/request-join`
  - **Status**: `done`
  - **Notes**: submit join request.

- **Feature**: Chat
  - **Endpoint**: `GET /api/v1/chat/groups/{group_id}/requests`
  - **Status**: `done`
  - **Notes**: admin-only request list.

- **Feature**: Chat
  - **Endpoint**: `POST /api/v1/chat/groups/{group_id}/requests/action`
  - **Status**: `done`
  - **Notes**: admin approve/reject join requests.

- **Feature**: Chat
  - **Endpoint**: `POST /api/v1/chat/groups/{group_id}/messages`, `GET /api/v1/chat/groups/{group_id}/messages`
  - **Status**: `done`
  - **Notes**: group messaging for members.

## Planned Next APIs

- **Feature**: Ingest/Summary/Query/Trend/Export
  - **Endpoint**: `POST /api/v1/ingest`, `GET /api/v1/summary/{file_id}`, `POST /api/v1/query`, `POST /api/v1/trend/{niche}`, `POST /api/v1/export`
  - **Status**: `planned`
  - **Notes**: teammate workflow adapters not wired yet.

- **Feature**: Async Jobs
  - **Endpoint**: `GET /api/v1/jobs/{job_id}`, `GET /api/v1/trend/jobs/{job_id}`
  - **Status**: `planned`
  - **Notes**: needed for long-running LLM/video tasks.

- **Feature**: Ideation
  - **Endpoint**: `POST /api/v1/ideation/generate`
  - **Status**: `planned`
  - **Notes**: depends on trend/query integration.

## Change Log
- 2026-04-20: Initial matrix created.
- 2026-04-27: Rebased matrix on implemented endpoints in `health`, `team`, `workflow`, and `chat` route modules.
