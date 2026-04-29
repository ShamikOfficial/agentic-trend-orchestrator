from __future__ import annotations

import os

from dotenv import load_dotenv


def load_app_env() -> str:
    """Load a single root dotenv file for both frontend and backend."""
    load_dotenv(override=False)
    return os.getenv("APP_ENV", "development").strip().lower() or "development"
