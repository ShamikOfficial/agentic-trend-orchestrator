# API Contract (Web MVP)

## Scope
- Backend API for `agentic-trend-orchestrator`
- Base path: `/api/v1`
- Current stack: FastAPI + in-memory stores for auth/chat/team/workflow state
- Version: `v1`

## Conventions
- Content type: `application/json` unless noted
- Auth header: `x-auth-token: <token>`
- Protected routes: all `/api/v1/*` except:
  - `GET /api/v1/health`
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`

## Error Shape (current)
Most route errors return FastAPI `HTTPException` shape:

```json
{
  "detail": "message"
}
```

---

## Health

### `GET /api/v1/health`
- **Purpose**: service liveness/dependency flags
- **Status**: `implemented`

Response example:
```json
{
  "status": "ok",
  "services": {
    "openai_configured": false,
    "faiss_ready": true
  }
}
```

---

## Auth

### `POST /api/v1/auth/register`
- **Purpose**: create user account
- **Status**: `implemented`

Request:
```json
{
  "username": "shamik",
  "password": "secret123",
  "display_name": "Shamik"
}
```

Response:
```json
{
  "user_id": "usr_123",
  "username": "shamik"
}
```

### `POST /api/v1/auth/login`
- **Purpose**: authenticate and return token
- **Status**: `implemented`

Request:
```json
{
  "username": "shamik",
  "password": "secret123"
}
```

Response:
```json
{
  "token": "token_abc",
  "user": {
    "user_id": "usr_123",
    "username": "shamik",
    "display_name": "Shamik"
  }
}
```

### `GET /api/v1/auth/me`
- **Purpose**: validate current token and return user
- **Status**: `implemented`

Response:
```json
{
  "user": {
    "user_id": "usr_123",
    "username": "shamik",
    "display_name": "Shamik"
  }
}
```

---

## Team

### `POST /api/v1/team/summaries`
- **Purpose**: summarize chat/meeting content
- **Status**: `implemented`

### `POST /api/v1/team/tasks/extract`
- **Purpose**: extract tasks from content or summary reference
- **Status**: `implemented`

### `POST /api/v1/team/process`
- **Purpose**: unified category + summary + tasks flow
- **Status**: `implemented`

### `GET /api/v1/team/notes/logs`
- **Purpose**: list classified note logs
- **Status**: `implemented`

### `GET /api/v1/team/tasks`
- **Purpose**: list all team tasks
- **Status**: `implemented`

### `PATCH /api/v1/team/tasks/{task_id}`
- **Purpose**: update task fields (owner/status/due_date/notes)
- **Status**: `implemented`

### `POST /api/v1/team/reminders/run`
- **Purpose**: generate reminder payloads for due-soon/overdue tasks
- **Status**: `implemented`

Reminder request example:
```json
{
  "window_hours": 24,
  "task_ids": ["tsk_1", "tsk_2"]
}
```

---

## Workflow

### `POST /api/v1/workflow/items`
- **Purpose**: create workflow item
- **Status**: `implemented`

### `POST /api/v1/workflow/uploads` (multipart/form-data)
- **Purpose**: upload workflow attachment file
- **Status**: `implemented`
- **Response**:
```json
{
  "name": "brief.pdf",
  "url": "/uploads/att_123.pdf"
}
```

### `GET /api/v1/workflow/items`
- **Purpose**: list workflow items
- **Status**: `implemented`

### `GET /api/v1/workflow/items/{item_id}`
- **Purpose**: fetch single workflow item
- **Status**: `implemented`

### `PATCH /api/v1/workflow/items/{item_id}`
- **Purpose**: update workflow item fields
- **Status**: `implemented`

### `DELETE /api/v1/workflow/items/{item_id}`
- **Purpose**: delete workflow item and linked milestones
- **Status**: `implemented`

### `PATCH /api/v1/workflow/items/{item_id}/stage`
- **Purpose**: move item across allowed stages
- **Status**: `implemented`

### `GET /api/v1/workflow/logs`
- **Purpose**: list workflow activity logs
- **Status**: `implemented`

### `POST /api/v1/workflow/milestones`
- **Purpose**: create milestone for workflow item
- **Status**: `implemented`

### `PATCH /api/v1/workflow/milestones/{milestone_id}`
- **Purpose**: update milestone fields/status
- **Status**: `implemented`

---

## Chat

### `GET /api/v1/chat/users`
- **Purpose**: list users (excluding current user)
- **Status**: `implemented`

### `POST /api/v1/chat/dm/{target_user_id}`
- **Purpose**: send direct message
- **Status**: `implemented`

### `GET /api/v1/chat/dm/{target_user_id}`
- **Purpose**: list direct messages with target user
- **Status**: `implemented`

### `POST /api/v1/chat/groups`
- **Purpose**: create group
- **Status**: `implemented`

### `GET /api/v1/chat/groups`
- **Purpose**: list groups and membership status
- **Status**: `implemented`

### `GET /api/v1/chat/search?q=<query>`
- **Purpose**: search users and groups
- **Status**: `implemented`

### `POST /api/v1/chat/groups/{group_id}/request-join`
- **Purpose**: request group join
- **Status**: `implemented`

### `GET /api/v1/chat/groups/{group_id}/requests`
- **Purpose**: list pending join requests (admin only)
- **Status**: `implemented`

### `POST /api/v1/chat/groups/{group_id}/requests/action`
- **Purpose**: approve/reject join requests (admin only)
- **Status**: `implemented`

### `POST /api/v1/chat/groups/{group_id}/messages`
- **Purpose**: send group message (member only)
- **Status**: `implemented`

### `GET /api/v1/chat/groups/{group_id}/messages`
- **Purpose**: list group messages (member only)
- **Status**: `implemented`

---

## Planned (Not Yet Implemented)

- `POST /api/v1/ingest`
- `POST /api/v1/ingest/batch`
- `GET /api/v1/jobs/{job_id}`
- `GET /api/v1/summary/{file_id}`
- `POST /api/v1/query`
- `POST /api/v1/trend/{niche}`
- `GET /api/v1/trend/jobs/{job_id}`
- `POST /api/v1/export`
- `GET /api/v1/videos`
- `GET /api/v1/videos/{file_id}`
- `POST /api/v1/ideation/generate`
