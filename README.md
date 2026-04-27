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
4. Create local env file:
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

## Run Frontend Web App (separate terminal)
```powershell
cd frontend
npm run dev
```
Then open `http://localhost:3000` in your browser.

## Notes
- Root `requirements.txt` is the single Python dependency source for backend services and tests.
- Frontend dependencies are managed in `frontend/package.json`.
- API base URL defaults to `http://127.0.0.1:8000/api/v1`.
- Most `/api/v1` routes require `x-auth-token`; register/login routes are public.
