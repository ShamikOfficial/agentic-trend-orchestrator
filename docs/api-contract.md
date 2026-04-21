# API Contract (Web MVP)

## Scope
- Web interface integration contract for `agentic-trend-orchestrator`.
- Backend target stack: FastAPI.
- Teammate module source: `trend-detection-content-workflow`.
- Version: `v1`.

## Conventions
- Base path: `/api/v1`
- Content type: `application/json` unless explicitly noted.
- Auth (MVP): no auth for local development; add token auth later.
- Long-running operations return a `job_id` and use polling.

## Standard Error Model
All non-2xx responses should follow:

```json
{
  "error": {
    "code": "string_code",
    "message": "human readable message",
    "details": {}
  }
}
```

Common error codes:
- `validation_error`
- `not_found`
- `dependency_unavailable`
- `processing_failed`
- `internal_error`

## Job Status Model
Used by async ingestion/trend operations.

```json
{
  "job_id": "uuid-or-short-id",
  "status": "queued|running|completed|failed",
  "started_at": "ISO-8601",
  "finished_at": "ISO-8601|null",
  "result": {},
  "error": null
}
```

---

## Endpoint: Health Check
- **ID**: `healthCheck`
- **Method + Path**: `GET /api/v1/health`
- **Purpose**: Verify API is up and dependencies are visible.
- **Status**: `new` (to build)

### Response
```json
{
  "status": "ok",
  "services": {
    "openai_configured": true,
    "milvus_connected": true
  }
}
```

---

## Endpoint: Ingest Video (Async)
- **ID**: `ingestVideo`
- **Method + Path**: `POST /api/v1/ingest`
- **Purpose**: Submit a video for ingestion into caption/summary/trend pipeline.
- **Mapped teammate logic**: `ingest.py::ingest_video`
- **Status**: `wrapped` (existing logic to expose)

### Request Body
```json
{
  "video_path": "C:/absolute/or/workspace/path/video.mp4",
  "platform": "youtube",
  "vlm_prompt": "Describe all visible objects, people, actions and events in detail.",
  "chunk_sec": 5
}
```

### Validation
- `video_path`: required, must exist and have video extension.
- `platform`: optional string, default `"unknown"`.
- `vlm_prompt`: optional string.
- `chunk_sec`: optional integer, min `1`, max `60`.

### Response (Accepted)
```json
{
  "job_id": "job_123",
  "status": "queued"
}
```

---

## Endpoint: Ingest All Videos (Async)
- **ID**: `ingestAllVideos`
- **Method + Path**: `POST /api/v1/ingest/batch`
- **Purpose**: Ingest all videos from configured folder.
- **Mapped teammate logic**: `run.py::cmd_ingest_all` + `ingest.py::ingest_video`
- **Status**: `wrapped` (existing logic to expose)

### Request Body
```json
{
  "videos_dir": "videos",
  "platform": "youtube",
  "vlm_prompt": "Describe all visible objects, people, actions and events in detail."
}
```

### Response
```json
{
  "job_id": "job_batch_456",
  "status": "queued"
}
```

---

## Endpoint: Get Job Status
- **ID**: `getJobStatus`
- **Method + Path**: `GET /api/v1/jobs/{job_id}`
- **Purpose**: Poll status for async operations.
- **Status**: `new` (to build)

### Response
```json
{
  "job_id": "job_123",
  "status": "completed",
  "started_at": "2026-04-20T20:00:00Z",
  "finished_at": "2026-04-20T20:01:30Z",
  "result": {
    "file_id": "ab12cd34"
  },
  "error": null
}
```

---

## Endpoint: Summarize Video
- **ID**: `summarizeVideo`
- **Method + Path**: `GET /api/v1/summary/{file_id}`
- **Purpose**: Return generated summary + detected niche/topic for one video.
- **Mapped teammate logic**: `summarize.py::summarize_video`, `summarize.py::detect_niche_topic`, `db.py`
- **Status**: `wrapped` (existing logic to expose)

### Query Params
- `focus` (optional, string, default: `general`)
- `output_format` (optional, string)

### Response
```json
{
  "file_id": "ab12cd34",
  "summary": "Video summary text...",
  "niche": "cooking",
  "topic": "quick high-protein breakfast",
  "source": "video_summaries"
}
```

---

## Endpoint: Query Videos (Semantic Q&A)
- **ID**: `queryVideos`
- **Method + Path**: `POST /api/v1/query`
- **Purpose**: Ask natural-language questions over all videos or one scoped video.
- **Mapped teammate logic**: `query.py::run_query`, `query.py::answer_question`
- **Status**: `wrapped` (existing logic to expose)

### Request Body
```json
{
  "question": "What are common editing patterns in finance videos?",
  "file_id": "ab12cd34"
}
```

### Validation
- `question`: required, min length 3.
- `file_id`: optional; if omitted, query is global.

### Response
```json
{
  "answer": "Based on the indexed videos...",
  "mode": "scoped|global",
  "file_id": "ab12cd34",
  "citations": [
    {
      "file_id": "ab12cd34",
      "start_sec": 10.0,
      "end_sec": 15.0,
      "score": 0.87
    }
  ]
}
```

---

## Endpoint: Detect Trends By Niche (Async)
- **ID**: `detectTrends`
- **Method + Path**: `POST /api/v1/trend/{niche}`
- **Purpose**: Cluster summaries in a niche and generate trend briefs.
- **Mapped teammate logic**: `trend.py::run_trend`, `trend.py::detect_trends`, `trend.py::generate_brief`
- **Status**: `wrapped` (existing logic to expose)

### Path Params
- `niche` (required, string)

### Request Body
```json
{
  "max_clusters": 10
}
```

### Response
```json
{
  "job_id": "job_trend_789",
  "status": "queued"
}
```

---

## Endpoint: Get Trend Result
- **ID**: `getTrendResult`
- **Method + Path**: `GET /api/v1/trend/jobs/{job_id}`
- **Purpose**: Fetch completed trend detection payload.
- **Status**: `new` (to build)

### Response
```json
{
  "job_id": "job_trend_789",
  "status": "completed",
  "niche": "fitness",
  "trends": [
    {
      "trend": "morning mobility",
      "why": "Short low-equipment routines are rising...",
      "brief": {
        "title": "5-Minute Morning Mobility Reset",
        "hook": "Start your day pain-free in 5 minutes.",
        "key_points": ["..."],
        "format": "Short-form video, 45-60 seconds"
      }
    }
  ]
}
```

---

## Endpoint: Export Video Database
- **ID**: `exportVideoDatabase`
- **Method + Path**: `POST /api/v1/export`
- **Purpose**: Trigger CSV export of ingested videos and summaries.
- **Mapped teammate logic**: `export.py::export_all`
- **Status**: `wrapped` (existing logic to expose)

### Request Body
```json
{
  "csv_path": "video_database.csv"
}
```

### Response
```json
{
  "job_id": "job_export_222",
  "status": "queued"
}
```

---

## Endpoint: List Videos (Memory Base)
- **ID**: `listVideos`
- **Method + Path**: `GET /api/v1/videos`
- **Purpose**: Return indexed videos with niche/topic metadata for web dashboard.
- **Mapped teammate logic**: `db.py::ensure_summaries_collection` + collection queries
- **Status**: `new_required` (not explicit in teammate CLI, needed for UI)

### Query Params
- `niche` (optional)
- `platform` (optional)
- `limit` (optional, default `50`, max `500`)
- `offset` (optional, default `0`)

### Response
```json
{
  "items": [
    {
      "file_id": "ab12cd34",
      "file_path": "C:/videos/a.mp4",
      "niche": "finance",
      "topic": "budgeting basics",
      "platform": "youtube",
      "ingested_at": 1713630000
    }
  ],
  "total": 1
}
```

---

## Endpoint: Team Tasks (Planned)
- **ID**: `teamTasks`
- **Method + Path**: `GET/POST /api/v1/team/tasks`
- **Purpose**: MVP task extraction and assignment tracking.
- **Status**: `planned` (new module)

## Endpoint: Workflow Stages (Planned)
- **ID**: `workflowStages`
- **Method + Path**: `GET/POST /api/v1/workflow/items`
- **Purpose**: Move content through Idea -> Brief -> Production -> Review -> Publish.
- **Status**: `planned` (new module)

## Endpoint: Ideation Assist (Planned)
- **ID**: `ideationAssist`
- **Method + Path**: `POST /api/v1/ideation/generate`
- **Purpose**: Generate ideas from trend + query context.
- **Status**: `planned` (new wrapper module)

---

## Endpoint: Summarize Team Content
- **ID**: `summarizeTeamContent`
- **Method + Path**: `POST /api/v1/team/summaries`
- **Purpose**: Summarize raw chat or meeting transcript into concise team context.
- **Status**: `new_required` (priority)

### Request Body
```json
{
  "source_type": "chat|meeting",
  "content": "Raw transcript or chat export text...",
  "title": "Weekly planning sync"
}
```

### Response
```json
{
  "summary_id": "sum_001",
  "summary": "Team discussed trend experiments, editing bottlenecks, and deadlines.",
  "action_items_preview": [
    "Create 3 trend-backed concepts",
    "Finalize brief by Friday"
  ]
}
```

---

## Endpoint: Extract Tasks
- **ID**: `extractTasks`
- **Method + Path**: `POST /api/v1/team/tasks/extract`
- **Purpose**: Extract structured tasks from transcript/chat and optionally assign owners.
- **Status**: `new_required` (priority)

### Request Body
```json
{
  "source_ref": "sum_001",
  "content": "Optional raw content when no source_ref exists",
  "owner_candidates": ["Batu", "Shamik", "Shufen"],
  "default_due_days": 3
}
```

### Response
```json
{
  "tasks": [
    {
      "task_id": "tsk_001",
      "title": "Prepare trend shortlist",
      "description": "Identify top 5 trend signals in finance niche",
      "owner": "Shamik",
      "due_date": "2026-04-23",
      "priority": "high",
      "status": "todo"
    }
  ]
}
```

---

## Endpoint: List Team Tasks
- **ID**: `listTeamTasks`
- **Method + Path**: `GET /api/v1/team/tasks`
- **Purpose**: Return task list with filtering for owner/status/deadline.
- **Status**: `new_required` (priority)

### Query Params
- `owner` (optional)
- `status` (optional: `todo|in_progress|blocked|done`)
- `due_before` (optional date `YYYY-MM-DD`)

### Response
```json
{
  "items": [
    {
      "task_id": "tsk_001",
      "title": "Prepare trend shortlist",
      "owner": "Shamik",
      "due_date": "2026-04-23",
      "priority": "high",
      "status": "in_progress"
    }
  ],
  "total": 1
}
```

---

## Endpoint: Update Team Task
- **ID**: `updateTeamTask`
- **Method + Path**: `PATCH /api/v1/team/tasks/{task_id}`
- **Purpose**: Reassign owner, change due date/priority/status, append notes.
- **Status**: `new_required` (priority)

### Request Body
```json
{
  "owner": "Shufen",
  "status": "blocked",
  "due_date": "2026-04-25",
  "notes": "Waiting on trend API output."
}
```

### Response
```json
{
  "task_id": "tsk_001",
  "updated": true
}
```

---

## Endpoint: Run Deadline Reminders
- **ID**: `runDeadlineReminders`
- **Method + Path**: `POST /api/v1/team/reminders/run`
- **Purpose**: Identify overdue or near-due tasks and return reminder payloads.
- **Status**: `new_required` (priority)

### Request Body
```json
{
  "window_hours": 24
}
```

### Response
```json
{
  "generated_at": "2026-04-20T21:00:00Z",
  "reminders": [
    {
      "task_id": "tsk_001",
      "owner": "Shamik",
      "due_date": "2026-04-21",
      "severity": "due_soon",
      "message": "Task is due within 24 hours."
    }
  ]
}
```

---

## Endpoint: Create Workflow Item
- **ID**: `createWorkflowItem`
- **Method + Path**: `POST /api/v1/workflow/items`
- **Purpose**: Create a content item and initialize it at `Idea` stage.
- **Status**: `new_required` (priority)

### Request Body
```json
{
  "title": "Budgeting Mythbuster Reel",
  "description": "Short-form script based on emerging finance myths",
  "owner": "Batu",
  "linked_trend": "budgeting basics"
}
```

### Response
```json
{
  "item_id": "wf_001",
  "stage": "Idea"
}
```

---

## Endpoint: List Workflow Items
- **ID**: `listWorkflowItems`
- **Method + Path**: `GET /api/v1/workflow/items`
- **Purpose**: Return workflow board data for all stages.
- **Status**: `new_required` (priority)

### Query Params
- `stage` (optional: `Idea|Brief|Production|Review|Publish`)
- `owner` (optional)

### Response
```json
{
  "items": [
    {
      "item_id": "wf_001",
      "title": "Budgeting Mythbuster Reel",
      "stage": "Brief",
      "owner": "Batu",
      "updated_at": "2026-04-20T20:20:00Z"
    }
  ]
}
```

---

## Endpoint: Update Workflow Stage
- **ID**: `updateWorkflowStage`
- **Method + Path**: `PATCH /api/v1/workflow/items/{item_id}/stage`
- **Purpose**: Move item between allowed stages with transition validation.
- **Status**: `new_required` (priority)

### Request Body
```json
{
  "to_stage": "Production",
  "note": "Brief approved by product lead."
}
```

### Validation
- Allowed transitions only:
  - `Idea -> Brief`
  - `Brief -> Production`
  - `Production -> Review`
  - `Review -> Publish`
  - optional backward move: one step back with reason.

### Response
```json
{
  "item_id": "wf_001",
  "from_stage": "Brief",
  "to_stage": "Production",
  "updated": true
}
```

---

## Endpoint: Create Milestone
- **ID**: `createMilestone`
- **Method + Path**: `POST /api/v1/workflow/milestones`
- **Purpose**: Attach milestone checkpoints and deadlines to workflow items.
- **Status**: `new_required` (priority)

### Request Body
```json
{
  "item_id": "wf_001",
  "title": "Script lock",
  "owner": "Shufen",
  "due_date": "2026-04-24",
  "criteria": ["Hook approved", "CTA defined"]
}
```

### Response
```json
{
  "milestone_id": "ms_001",
  "status": "open"
}
```

---

## Endpoint: Update Milestone
- **ID**: `updateMilestone`
- **Method + Path**: `PATCH /api/v1/workflow/milestones/{milestone_id}`
- **Purpose**: Update milestone status/owner/date/notes.
- **Status**: `new_required` (priority)

### Request Body
```json
{
  "status": "completed",
  "notes": "Script reviewed and approved."
}
```

### Response
```json
{
  "milestone_id": "ms_001",
  "updated": true
}
```
