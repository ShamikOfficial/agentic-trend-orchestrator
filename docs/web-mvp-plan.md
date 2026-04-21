---
name: Web MVP Plan
overview: Build a web-only MVP by API-enabling the actual trend-detection teammate workflow (ingest/query/summary/trend/export), then layering team/workflow modules and a frontend on top of a documented, living API contract.
todos:
  - id: init-structure
    content: Create monorepo structure (`backend`, `frontend`, `docs`) and baseline FastAPI app with health check.
    status: pending
  - id: teammate-mapping
    content: Map trend-detection workflow modules (`ingest.py`, `query.py`, `summarize.py`, `trend.py`, `export.py`) into backend adapter interfaces.
    status: pending
  - id: api-doc-foundation
    content: Create `docs/api-contract.md` and `docs/api-coverage-matrix.md` with endpoint status taxonomy.
    status: pending
  - id: backend-api-first
    content: Implement first production API set (`/ingest`, `/summary/{file_id}`, `/query`, `/trend/{niche}`) using async job status for long-running tasks.
    status: pending
  - id: feature-endpoints
    content: Add Trend, Ideation, Team, Workflow, and Memory API stubs aligned to PRD MVP scope.
    status: pending
  - id: web-ui-mvp
    content: Build web-only frontend screens wired to backend APIs and async status handling.
    status: pending
  - id: validation-tests
    content: Add schema validation, smoke tests, and update docs as APIs move from planned to done.
    status: pending
  - id: team-assistant-mvp
    content: Define and implement AI Team Assistant APIs for summarize, task extraction, owner assignment, and reminders.
    status: in_progress
  - id: workflow-milestones-mvp
    content: Define and implement Workflow & Milestones APIs for Idea -> Brief -> Production -> Review -> Publish lifecycle.
    status: in_progress
  - id: delivery-tracker
    content: Maintain docs-first progress tracker to mark build/enhance/not-started and capture new features added on the go.
    status: in_progress
isProject: false
---

# Web MVP Integration Plan

## Assumptions
- Backend stack: Python + FastAPI (best fit for teammate Python modules).
- Teammate repo is the primary backend logic source for trend detection workflows.
- Scope is web interface only (no Android integration).

## Current Codebase Reality
- Your current repo is effectively a blank slate (`LICENSE` only): [C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/agentic-trend-orchestrator/LICENSE](C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/agentic-trend-orchestrator/LICENSE)
- Correct teammate repo already implements core creator workflows via CLI commands in [C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/trend-detection-content-workflow/run.py](C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/trend-detection-content-workflow/run.py)
- Core reusable modules and capabilities:
  - Video ingestion pipeline (ffmpeg + Whisper + GPT-4o + embeddings + Milvus): [C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/trend-detection-content-workflow/ingest.py](C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/trend-detection-content-workflow/ingest.py)
  - Video summarization + niche/topic detection: [C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/trend-detection-content-workflow/summarize.py](C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/trend-detection-content-workflow/summarize.py)
  - Semantic Q&A over videos: [C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/trend-detection-content-workflow/query.py](C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/trend-detection-content-workflow/query.py)
  - Trend clustering + content brief generation: [C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/trend-detection-content-workflow/trend.py](C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/trend-detection-content-workflow/trend.py)
  - Milvus schema/upsert helpers: [C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/trend-detection-content-workflow/db.py](C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/trend-detection-content-workflow/db.py)
  - Export/report pipeline: [C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/trend-detection-content-workflow/export.py](C:/Users/SUDHENDU BASU/OneDrive/Documents/Shamik/Coding/Hackathon/trend-detection-content-workflow/export.py)

## MVP Architecture (Web-Only)
```mermaid
flowchart LR
  webUi[WebFrontend] -->|HTTP JSON| apiGateway[FastAPIService]
  apiGateway --> ingestSvc[VideoIngestionModule]
  apiGateway --> summarySvc[VideoSummaryModule]
  apiGateway --> querySvc[SemanticQueryModule]
  apiGateway --> trendSvc[TrendSignalModule]
  apiGateway --> exportSvc[ExportModule]
  apiGateway --> ideationSvc[IdeationModule]
  apiGateway --> teamSvc[TeamAssistantModule]
  apiGateway --> memorySvc[KnowledgeMemoryModule]
  ingestSvc --> teammateAdapters[TeammateWorkflowAdapters]
  summarySvc --> teammateAdapters
  querySvc --> teammateAdapters
  trendSvc --> teammateAdapters
  exportSvc --> teammateAdapters
  teammateAdapters --> openAiApis[OpenAIApis]
  teammateAdapters --> milvusStore[(MilvusLocalDB)]
  apiGateway --> appStore[(AppDataStoreForTasksAndWorkflow)]
```

## Repository Setup Plan
- Initialize monorepo structure in your current repo:
  - `backend/` (FastAPI services + adapters)
  - `frontend/` (web UI)
  - `docs/` (API contracts, integration status, feature map)
- Add teammate repo as a local dependency source via an adapter layer (import module functions, do not shell out to CLI from routes).
- Create explicit service boundaries so future mobile clients can reuse the same backend APIs later.

## Backend Plan (FastAPI)
- Build API modules by product feature:
  - `ingest`: upload/ingest videos and return `file_id` + processing status
  - `summary`: return video summaries and niche/topic metadata
  - `query`: semantic Q&A globally or scoped to one `file_id`
  - `trend`: trend clusters + generated briefs for niche
  - `export`: downloadable CSV of summarized dataset
  - `ideation`: optional wrapper over trend/query outputs for idea generation
  - `team`: task extraction / assignment / milestone endpoints
  - `workflow`: kanban stage transitions and approval states
  - `memory`: content/project history persistence and retrieval
- Add `adapters/teammate_workflow/` to wrap existing teammate functions with safe I/O and timeouts.
- Add async job handling for long-running model calls (queue + job status endpoint).
- Add health checks for API + OpenAI key presence + Milvus connectivity.

## Current Priority Modules
### 1) AI Team Assistant (Priority Now)
- Primary outcomes:
  - Summarize chat/meeting notes.
  - Extract actionable tasks.
  - Assign owners.
  - Track and remind deadlines.
- Initial backend surfaces:
  - `POST /api/v1/team/summaries`
  - `POST /api/v1/team/tasks/extract`
  - `GET /api/v1/team/tasks`
  - `PATCH /api/v1/team/tasks/{task_id}`
  - `POST /api/v1/team/reminders/run`

### 2) Workflow & Milestones (Priority Now)
- Primary outcomes:
  - Move work through stages: `Idea -> Brief -> Production -> Review -> Publish`.
  - Track milestone status and ownership.
  - Enforce transition rules and approval states.
- Initial backend surfaces:
  - `POST /api/v1/workflow/items`
  - `GET /api/v1/workflow/items`
  - `PATCH /api/v1/workflow/items/{item_id}/stage`
  - `POST /api/v1/workflow/milestones`
  - `PATCH /api/v1/workflow/milestones/{milestone_id}`

## API Documentation Strategy (Living Contract)
Create and maintain two docs under `docs/`:
- `docs/api-contract.md`
  - Canonical endpoint list, request schema, response schema, error model.
  - Include versioning and deprecation notes.
- `docs/api-coverage-matrix.md`
  - Track each endpoint with status: `exists_in_teammate`, `wrapped`, `new_required`, `in_progress`, `done`.
  - Map each endpoint to product feature (Ingest, Summary, Query, Trend, Export, Ideation, Team, Workflow, Memory).

Suggested section format for each endpoint in `api-contract.md`:
- Endpoint ID
- Method + Path
- Purpose
- Request params/body
- Response fields
- Validation rules
- Example request/response
- Status tag (`existing`, `new`, `planned`)

## Documentation Update Rules (Always On)
- For every new endpoint:
  1. Add/modify endpoint contract in `docs/api-contract.md`.
  2. Add/update status row in `docs/api-coverage-matrix.md`.
  3. Mark module progress in `docs/progress-tracker.md`.
- Use status values in progress tracker:
  - `not_started`
  - `building`
  - `enhancing`
  - `blocked`
  - `done`
- If a feature is invented during development, add it immediately as:
  - new endpoint in API contract,
  - new row in coverage matrix,
  - new line in progress tracker with rationale.

## Frontend Plan (Web Interface)
- Build web app against API-first contracts only (no direct model/script calls).
- Deliver web MVP pages:
  - Video ingestion/upload + processing status
  - Trend dashboard
  - Search/query + ideation workspace
  - Video summary explorer
  - Team task board + milestones
  - Knowledge history view
- Add API client module with typed request/response contracts matching `docs/api-contract.md`.
- Add status indicators for async jobs and model latency.

## Incremental Delivery Phases
1. **Foundation**: repo scaffold, backend skeleton, docs skeleton, health endpoint.
2. **First integration**: teammate ingest/summary/query/trend adapters + API wrappers + job status APIs.
3. **Core creator flows (current focus)**: team assistant + workflow/milestones endpoints.
4. **Frontend web MVP**: connect all pages to APIs with loading/error states.
5. **Hardening**: tests, validation, API contract updates, demo data.

## Risks and Mitigations
- **External dependency failures**: add retries/timeouts around OpenAI calls and explicit error surface in API responses.
- **Long inference runtime**: async job queue + polling endpoints + cached results.
- **Changing endpoint requirements**: enforce docs-first updates in `api-contract.md` before implementation.
- **Data inconsistency**: add strict pydantic request/response schemas across modules and stable `file_id`/job-id lifecycles.
