# Web MVP Workspace

This repository currently focuses on standalone core modules for:
- AI Team Assistant
- Workflow and Milestones

These modules are implemented as pure Python services and tested without API coupling.

## Project Structure
- `backend/` core models, services, and tests
- `frontend/` placeholder UI structure
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

## Run Web Test UI
```powershell
python -m streamlit run frontend/app.py
```
This starts a simple frontend to test Team Assistant and Workflow/Milestones behavior.

## Notes
- Root `requirements.txt` is for local development, notebook testing, and Streamlit UI testing.
- `backend/requirements.txt` is kept for backend-specific dependency tracking.
