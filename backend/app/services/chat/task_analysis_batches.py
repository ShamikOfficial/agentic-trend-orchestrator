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
    """Messages per auto extract pass (default 5)."""
    return max(1, int(os.getenv("TASK_EXTRACT_BATCH_SIZE", "5")))


def task_extract_force_count() -> int:
    raw = os.getenv("TASK_EXTRACT_FORCE_COUNT", "").strip()
    if raw:
        return max(1, int(raw))
    return task_extract_batch_size()


def analyzed_message_ids_from_batches(batches: list[dict]) -> set[str]:
    ids: set[str] = set()
    for batch in batches:
        for mid in batch.get("message_ids") or []:
            if mid:
                ids.add(str(mid))
    return ids


def unanalyzed_messages(all_messages: list[dict], analyzed_ids: set[str]) -> list[dict]:
    """Chat lines never sent to task extraction yet."""
    if not analyzed_ids:
        return list(all_messages)
    return [
        m
        for m in all_messages
        if str(m.get("message_id") or "") and str(m.get("message_id")) not in analyzed_ids
    ]


def build_batch_meta(messages: list[dict], batch_index: int) -> AnalysisBatchMeta:
    ids = [str(m["message_id"]) for m in messages if m.get("message_id")]
    return {
        "batch_index": batch_index,
        "first_message_id": ids[0],
        "last_message_id": ids[-1],
        "message_ids": ids,
        "message_count": len(ids),
    }


def attach_message_source_to_suggestions(
    suggestions: list[dict[str, Any]],
    batch: AnalysisBatchMeta,
    batch_messages: list[dict],
) -> list[dict[str, Any]]:
    """Link each suggestion to the exact chat message that triggered it."""
    valid_ids = {str(m.get("message_id")) for m in batch_messages if m.get("message_id")}
    default_id = batch["last_message_id"] if len(batch["message_ids"]) == 1 else ""
    out: list[dict[str, Any]] = []
    for s in suggestions:
        enriched = dict(s)
        mid = str(s.get("source_message_id") or "").strip()
        if mid not in valid_ids:
            mid = default_id or (batch["message_ids"][-1] if batch["message_ids"] else "")
        enriched["source_message_id"] = mid
        enriched["source_message_ids"] = [mid] if mid else list(batch["message_ids"])
        enriched["source_message_batch_index"] = batch["batch_index"]
        enriched["source_first_message_id"] = mid or batch["first_message_id"]
        enriched["source_last_message_id"] = mid or batch["last_message_id"]
        out.append(enriched)
    return out


def message_order_index(messages: list[dict]) -> dict[str, int]:
    return {str(m["message_id"]): i for i, m in enumerate(messages) if m.get("message_id")}


def select_messages_for_extraction(
    all_messages: list[dict],
    *,
    last_analyzed_id: str | None,
    next_batch_index: int,
    force: bool,
    prior_batches: list[dict] | None = None,
) -> tuple[list[dict], AnalysisBatchMeta] | None:
    """
    Pick the next unanalyzed message(s). Already-analyzed lines are never sent again.
    """
    _ = last_analyzed_id  # kept for API compat; selection uses batch message_ids only
    batches = prior_batches or []
    analyzed_ids = analyzed_message_ids_from_batches(batches)
    unanalyzed = unanalyzed_messages(all_messages, analyzed_ids)
    batch_size = task_extract_force_count() if force else task_extract_batch_size()

    if not unanalyzed:
        return None
    if len(unanalyzed) < batch_size:
        return None

    batch_messages = unanalyzed[:batch_size]
    return batch_messages, build_batch_meta(batch_messages, next_batch_index)


# Backward-compatible alias
def attach_batch_to_suggestions(
    suggestions: list[dict[str, Any]],
    batch: AnalysisBatchMeta,
) -> list[dict[str, Any]]:
    return attach_message_source_to_suggestions(suggestions, batch, [])
