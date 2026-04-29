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
Frontend reads API URL from root `.env`:

- `APP_ENV=development` => `API_BASE_URL_DEV`
- `APP_ENV=production` => `API_BASE_URL_PROD`

Optional override: set `NEXT_PUBLIC_API_BASE_URL` directly.
On Vercel, set root-env equivalent variables in project Environment settings; see root `README.md` deploy section.

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
