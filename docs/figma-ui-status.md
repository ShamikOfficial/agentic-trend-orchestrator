# Figma UI Design Coverage Matrix

This file tracks available Figma screens, implementation status in the Next.js app, and UI actions that are intentionally click-only because backend logic is not yet available.

## UI Coverage Table

| Figma Screen | Figma Route | App Route | Status | Notes |
|---|---|---|---|---|
| LoginPage | `/login` | `/` (logged-out view) | Implemented | Restyled to match Figma login card and branding. |
| ScriptHome | `/app` | `/` (logged-in home) | Not implemented | Current home is a functional module launcher, not the Figma discovery dashboard. |
| ScriptBrief | `/app/brief` | N/A | Not implemented | No frontend route yet in Next app. |
| ScriptEditor | `/app/editor` | N/A | Not implemented | No frontend route yet in Next app. |
| ScriptVariations | `/app/variations` | N/A | Not implemented | No frontend route yet in Next app. |
| Storyboard | `/app/storyboard` | N/A | Not implemented | No frontend route yet in Next app. |
| SaveProject | `/app/save` | N/A | Not implemented | No frontend route yet in Next app. |
| MyTasks | `/app/tasks` | `/workflow` | Implemented (UI aligned) | Workflow page restyled to the Figma tasks board structure. |
| ProjectProgress | `/app/progress` | N/A | Not implemented | No frontend route yet in Next app. |
| VideoUpload | `/app/upload` | N/A | Not implemented | No frontend route yet in Next app. |
| VideoReport | `/app/report` | N/A | Not implemented | No frontend route yet in Next app. |
| ChatMain | `/app/chat` | `/chat` | Implemented (UI aligned) | Restyled toward the Figma header/composer/right-panel pattern while preserving available backend wiring. |
| ScriptReview | `/app/chat-review` | N/A | Not implemented | No frontend route yet in Next app. |
| ChatScriptBrief | `/app/chat-brief` | N/A | Not implemented | No frontend route yet in Next app. |
| ExtractTasks | `/app/chat-tasks` | N/A | Not implemented | No frontend route yet in Next app. |
| ReportInChat | `/app/report-chat` | N/A | Not implemented | No frontend route yet in Next app. |

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

### ChatMain
- Group QR code backend generation is not available.
- Group notice announcement API is not available.
- Shared media indexing/filtering endpoint is not available.
- Invite member flow endpoint is not available.

### Team Assistant
- No backend endpoint exists for task-history analytics widgets (placeholder dashboard metrics).
- Multi-user assignment suggestions are heuristic only; no dedicated assignment service.
