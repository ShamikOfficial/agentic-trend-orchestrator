# Web MVP Workspace

This repository contains a web MVP for:
- Auth + session-guarded workspace access
- Team Assistant (notes -> summary -> tasks -> reminders)
- Workflow management (board + stage moves + milestones + uploads)
- Chat (DM + groups + join requests)

## Project Structure
- `backend/` FastAPI app, routes, services, and models
- `frontend/` Next.js web application (React + Tailwind + shadcn/ui)
- `docs/` API contract, coverage matrix, and progress tracking
- `uploads/` attachment files served by backend
- `logs/` API call logs

## Environment Setup (Windows PowerShell)
1. Create virtual environment:
   ```powershell
   python -m venv .venv
   ```
2. Activate virtual environment:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```
3. Install dependencies:
   ```powershell
   python -m pip install -r requirements.txt
   ```
4. Create local env file (single file for backend + frontend):
   ```powershell
   Copy-Item .env.example .env
   ```

## Run Tests
```powershell
python -m pytest backend/tests
```

## Run Backend API
```powershell
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend and frontend both use root `.env`.
Set `APP_ENV=development` for local mode and `APP_ENV=production` for hosted mode.

## Run Frontend Web App (separate terminal)
```powershell
cd frontend
npm run dev
```
Then open `http://localhost:3000` in your browser.

## Deploy frontend on Vercel (Production + Preview)

1. Push this repository to GitHub (or GitLab / Bitbucket).
2. In [Vercel](https://vercel.com/new), import the repo and set **Root Directory** to `frontend`.
3. Under **Environment Variables**, add `NEXT_PUBLIC_API_BASE_URL` with your public API base URL (must end with `/api/v1`). Scope it separately for **Production** and **Preview** if you use different APIs for staging vs production.
4. Deploy the **production** branch (often `main`). Every pull request and non-production branch gets a **Preview** URL automatically.
5. On the machine that runs the FastAPI backend, CORS allows `https://*.vercel.app` by default (`CORS_ALLOW_VERCEL` defaults to on). Add domains to `CORS_ORIGINS` for custom hostnames, or set `CORS_ALLOW_VERCEL=false` to allow only `CORS_ORIGINS` + localhost (see root `.env.example`).

Frontend also reads root `.env` (via `frontend/next.config.ts`), so you keep one env source.

## Notes
- Auth users are saved under `data/auth_store.json` (gitignored) so logins survive `uvicorn --reload`. Delete that file to reset accounts. Passwords are stored in plaintext for local MVP only.
- Root `requirements.txt` is the single Python dependency source for backend services and tests.
- Frontend dependencies are managed in `frontend/package.json`.
- API base URL defaults to `http://127.0.0.1:8000/api/v1`.
- Most `/api/v1` routes require `x-auth-token`; register/login routes are public.
