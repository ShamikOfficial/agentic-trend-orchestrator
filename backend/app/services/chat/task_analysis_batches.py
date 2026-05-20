"""Fixed-size message batches for chat task extraction."""

from __future__ import annotations

import os
from typing import Any, TypedDict


class AnalysisBatchMeta(TypedDict):
    batch_index: int
    first_message_id: str
    last_message_id: str
    message_ids: list[str]
    message_count: int


def task_extract_batch_size() -> int:
    return max(1, int(os.getenv("TASK_EXTRACT_BATCH_SIZE", "5")))


def task_extract_force_count() -> int:
    """Manual analyze uses the same section size as auto by default."""
    raw = os.getenv("TASK_EXTRACT_FORCE_COUNT", "").strip()
    if raw:
        return max(1, int(raw))
    return task_extract_batch_size()


def messages_after_id(messages: list[dict], last_id: str | None) -> list[dict]:
    if not last_id:
        return list(messages)
    found = False
    result: list[dict] = []
    for msg in messages:
        if found:
            result.append(msg)
        elif msg.get("message_id") == last_id:
            found = True
    if not found:
        return list(messages)
    return result


def build_batch_meta(messages: list[dict], batch_index: int) -> AnalysisBatchMeta:
    ids = [str(m["message_id"]) for m in messages if m.get("message_id")]
    return {
        "batch_index": batch_index,
        "first_message_id": ids[0],
        "last_message_id": ids[-1],
        "message_ids": ids,
        "message_count": len(ids),
    }


def attach_batch_to_suggestions(
    suggestions: list[dict[str, Any]],
    batch: AnalysisBatchMeta,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for s in suggestions:
        enriched = dict(s)
        enriched["source_message_batch_index"] = batch["batch_index"]
        enriched["source_message_ids"] = list(batch["message_ids"])
        enriched["source_first_message_id"] = batch["first_message_id"]
        enriched["source_last_message_id"] = batch["last_message_id"]
        out.append(enriched)
    return out


def select_messages_for_extraction(
    all_messages: list[dict],
    *,
    last_analyzed_id: str | None,
    next_batch_index: int,
    force: bool,
) -> tuple[list[dict], AnalysisBatchMeta] | None:
    """
    Pick the next section of N messages to analyze.

    Auto (force=False): only when at least N unanalyzed messages exist; takes the oldest N.
    Manual (force=True): same batch rules but uses TASK_EXTRACT_FORCE_COUNT as section size
    when set, otherwise TASK_EXTRACT_BATCH_SIZE.
    """
    batch_size = task_extract_force_count() if force else task_extract_batch_size()
    unanalyzed = messages_after_id(all_messages, last_analyzed_id)

    if len(unanalyzed) < batch_size:
        return None

    batch_messages = unanalyzed[:batch_size]
    return batch_messages, build_batch_meta(batch_messages, next_batch_index)
