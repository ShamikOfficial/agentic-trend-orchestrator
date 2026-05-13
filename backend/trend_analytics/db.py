"""db.py — compatibility wrappers backed by local FAISS + JSON storage."""

import time

from faiss_store import get_summary, upsert_summary


def ensure_summaries_collection():
    """Kept for compatibility with older callers."""
    return None


def insert_summary(
    file_id: str,
    file_path: str,
    full_transcript: str,
    summary: str,
    summary_embedding: list[float],
    platform: str = "unknown",
    niche: str = "unknown",
    topic: str = "unknown",
    ingested_at: int | None = None,
) -> None:
    upsert_summary(
        {
            "file_id": file_id,
            "file_path": file_path,
            "full_transcript": full_transcript[:65535],
            "summary": summary[:4096],
            "platform": platform,
            "niche": niche,
            "topic": topic,
            "ingested_at": ingested_at or int(time.time()),
            "summary_embedding": summary_embedding,
        }
    )


def fetch_summary_by_file_id(file_id: str) -> dict | None:
    return get_summary(file_id)
