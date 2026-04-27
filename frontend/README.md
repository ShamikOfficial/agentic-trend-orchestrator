# Frontend App

Production frontend foundation for `agentic-trend-orchestrator`.

## Stack
- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- shadcn/ui

## Run Locally
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Base URL
Set `NEXT_PUBLIC_API_BASE_URL` when needed. Default is:

`http://127.0.0.1:8000/api/v1`

Copy `frontend/.env.example` for local overrides. On Vercel, set the same variable per **Environment** (Production vs Preview) if staging and production APIs differ; see root `README.md` deploy section.

## Current Goal
Ship and polish authenticated Team/Workflow/Chat modules while preparing ingest/trend/query screens.

## Implemented Pages
- `/` Home dashboard (auth-aware module launcher)
- `/team` Team Assistant workspace
- `/workflow` Workflow board + logs + create/edit
- `/chat` Chat inbox (DM + group conversations)

## API Integration Notes
- Team and Workflow pages use shared `apiRequest` client.
- Chat uses dedicated `chat-api` client and token header handling.
- Backend auth token is stored client-side and sent as `x-auth-token`.

## Next UI Modules
- Trend dashboard
- Video summary explorer
- Query and ideation workspace
- Memory/history view
