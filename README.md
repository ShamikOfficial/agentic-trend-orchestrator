# Web MVP Workspace

This repository currently focuses on standalone core modules for:
- AI Team Assistant
- Workflow and Milestones

These modules are implemented as pure Python services and tested without API coupling.

## Project Structure
- `backend/` core models, services, and tests
- `frontend/` Next.js web application (React + Tailwind + shadcn/ui)
- `docs/` planning, API docs, and progress tracking
- `cli_runner.ipynb` notebook runner for module testing

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

## Run Notebook CLI Tester
```powershell
python -m jupyter notebook
```
Then open `cli_runner.ipynb` and run cells top-to-bottom.

## Run Frontend Web App
```powershell
cd frontend
npm run dev
```
Then open `http://localhost:3000` in your browser.

## Notes
- Root `requirements.txt` is the single Python dependency source for backend services, tests, and notebooks.
- Frontend dependencies are managed in `frontend/package.json`.
