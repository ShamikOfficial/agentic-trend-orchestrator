from __future__ import annotations

import sys
from pathlib import Path


_BACKEND_DIR = Path(__file__).resolve().parents[2]
_TREND_DIR = _BACKEND_DIR / "trend_analytics"
if str(_TREND_DIR) not in sys.path:
    sys.path.insert(0, str(_TREND_DIR))


def ingest_uploaded_video(
    video_path: Path,
    *,
    platform: str = "upload",
    prompt: str | None = None,
) -> dict:
    from db import fetch_summary_by_file_id
    from src.ingest.ingest import ingest_video

    file_id = ingest_video(
        str(video_path),
        vlm_prompt=prompt
        or "Describe all visible objects, people, actions and events in detail.",
        platform=platform,
    )

    row = fetch_summary_by_file_id(file_id)
    if row:
        return row
    return {"file_id": file_id, "platform": platform, "file_path": str(video_path)}
