# Figma UI Design Coverage Matrix

This file tracks available Figma screens, implementation status in the Next.js app, and UI actions that are intentionally click-only because backend logic is not yet available.

## Available Figma Screens (Current Inventory)

Based on the current design coverage matrix, these screens are still present in the Figma flow:

- `LoginPage`
- `ScriptHome`
- `ScriptBrief`
- `ScriptEditor`
- `ScriptVariations`
- `Storyboard`
- `SaveProject`
- `MyTasks`
- `ProjectProgress`
- `VideoUpload`
- `VideoReport`
- `ChatMain`
- `ScriptReview`
- `ChatScriptBrief`
- `ExtractTasks`
- `ReportInChat`

## UI Coverage Table

| Figma Screen | Figma Route | App Route | Status | Notes |
|---|---|---|---|---|
| LoginPage | `/login` | `/` (logged-out view) | Implemented | Restyled to match Figma login card and branding. |
| ScriptHome | `/app` | `/app` | Implemented (basic) | Added script workspace entry with navigation and recent workflow feed. |
| ScriptBrief | `/app/brief` | `/app/brief` | Implemented (basic) | Added brief form wired to backend summarizer endpoint with development placeholders. |
| ScriptEditor | `/app/editor` | `/app/editor` | Implemented (basic) | Added draft editor with AI suggestion call and local draft save. |
| ScriptVariations | `/app/variations` | `/app/variations` | Implemented (basic) | Added tone-based variation generation using summary backend. |
| Storyboard | `/app/storyboard` | `/app/storyboard` | Implemented (basic) | Added local scene card generation from script lines with development placeholders. |
| SaveProject | `/app/save` | `/app/save` | Implemented (basic) | Added save form wired to workflow item creation as basic persistence bridge. |
| MyTasks | `/app/tasks` | `/workflow` | Implemented (UI aligned) | Workflow page restyled to the Figma tasks board structure. |
| ProjectProgress | `/app/progress` | `/app/progress` | Implemented (basic) | Added project-level progress dashboard based on workflow tasks and activity logs, with development placeholders for missing deep links. |
| VideoUpload | `/app/upload` | `/app/upload` | Implemented (backend-wired) | Upload now calls FastAPI `/api/v1/trend/upload` and ingests video into trend analytics pipeline (Milvus/OpenAI) for downstream trend features. |
| VideoReport | `/app/report` | `/app/report` | Implemented (basic) | Added report screen shell and rewired actions to report-chat/progress/tasks. |
| ChatMain | `/app/chat` | `/chat` | Implemented (UI aligned) | Restyled toward the Figma header/composer/right-panel pattern while preserving available backend wiring. |
| ScriptReview | `/app/chat-review` | `/app/chat-review` | Implemented (basic) | Added placeholder review screen and rewired navigation to editor/tasks. |
| ChatScriptBrief | `/app/chat-brief` | `/app/chat-brief` | Implemented (basic) | Added chat-to-brief extraction screen wired to team summary endpoint. |
| ExtractTasks | `/app/chat-tasks` | `/app/chat-tasks` | Implemented (basic) | Added chat-to-task extraction screen wired to team task extraction endpoint. |
| ReportInChat | `/app/report-chat` | `/app/report-chat` | Implemented (basic) | Added report sharing bridge screen and rewired related navigation. |

## Existing Backend-Backed Features (Workflow `/workflow`)

The following controls are wired to real backend endpoints:

- Load workflow board items (`GET /workflow/items`)
- Create task in modal (`POST /workflow/items`)
- Mark selected task done (`PATCH /workflow/items/{item_id}/stage`)
- Load activity logs (`GET /workflow/logs`)
- Filtering in UI by project/owner (client-side over fetched items)

## Existing Backend-Backed Features (Chat `/chat`)

The following controls are wired to real backend endpoints:

- Auth-protected chat bootstrap (`/auth/*`, token session handling)
- DM send/list (`POST/GET /chat/dm/{target_user_id}`)
- Group list/create/join/send/list (`/chat/groups*`)
- Group join-request moderation (`/chat/groups/{group_id}/requests*`)
- Search (`GET /chat/search`)
- Ask AI in chat scope (`POST /chat/ask-ai`) via `@chat` and Ask AI button

## Clickable UI-Only Controls (No Backend Yet)

These are intentionally clickable but show a no-backend message in the flash line:

- `Open Source Chat`
- `Open Related Script`
- `Call controls` (phone/video)
- `Voice input` and emoji composer picker
- `Sync Latest Chat`
- `Assign tasks`, `Generate script`, `Update project progress`, `Send video report` AI action entries

## Missing Backend Features by Page

### LoginPage
- OAuth social sign-in (`Google`, `Apple`) endpoints are not available.
- Forgot password flow endpoint is not available.
- Terms/Privacy deep-link policy pages are not wired.

### Workflow / MyTasks
- Source-specific deep links (`Open Source Chat`, `Open Related Script`) are not backed by workflow-to-chat/script relational APIs.
- Rich task taxonomy (explicit source type, script id, video report id/timestamps) is not modeled in workflow API schema.

### ProjectProgress
- Upload/report deep links from progress rows are placeholder actions with in-development notices.
- Cross-module entity mapping (workflow item -> specific video upload/report objects) is not available yet.

### VideoUpload
- Ingestion is synchronous and can take time for longer videos (transcribe + frame caption + embedding).
- Requires backend runtime dependencies (`OPENAI_API_KEY`, ffmpeg, Milvus config) to complete processing.

### ChatMain
- Group QR code backend generation is not available.
- Group notice announcement API is not available.
- Shared media indexing/filtering endpoint is not available.
- Invite member flow endpoint is not available.

### Team Assistant
- No backend endpoint exists for task-history analytics widgets (placeholder dashboard metrics).
- Multi-user assignment suggestions are heuristic only; no dedicated assignment service.
