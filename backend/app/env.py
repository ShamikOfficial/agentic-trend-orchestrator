from __future__ import annotations

import os

from dotenv import load_dotenv


def load_app_env() -> str:
    """Load a single root dotenv file for both frontend and backend."""
    # Project .env must win over stale shell variables (e.g. old GEMINI_FALLBACK_MODELS with flash).
    load_dotenv(override=True)
    return os.getenv("APP_ENV", "development").strip().lower() or "development"
