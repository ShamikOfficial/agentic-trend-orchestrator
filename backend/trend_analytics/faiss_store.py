from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import faiss
import numpy as np

EMBED_DIM = 1536
_DATA_DIR = Path(__file__).resolve().parent / "data"
_DATA_DIR.mkdir(parents=True, exist_ok=True)


def _records_path(name: str) -> Path:
    return _DATA_DIR / f"{name}.json"


def _load_records(name: str) -> list[dict[str, Any]]:
    path = _records_path(name)
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _save_records(name: str, records: list[dict[str, Any]]) -> None:
    _records_path(name).write_text(json.dumps(records, ensure_ascii=True), encoding="utf-8")


def _normalize_vectors(vectors: np.ndarray) -> np.ndarray:
    v = vectors.astype("float32", copy=True)
    faiss.normalize_L2(v)
    return v


def _search(
    records: list[dict[str, Any]],
    embedding_key: str,
    query_embedding: list[float],
    *,
    top_k: int,
) -> list[tuple[float, dict[str, Any]]]:
    if not records:
        return []

    matrix = np.array([row[embedding_key] for row in records], dtype="float32")
    if matrix.size == 0:
        return []

    matrix = _normalize_vectors(matrix)
    query = _normalize_vectors(np.array([query_embedding], dtype="float32"))
    index = faiss.IndexFlatIP(matrix.shape[1])
    index.add(matrix)

    k = min(max(top_k, 1), len(records))
    scores, indices = index.search(query, k)
    out: list[tuple[float, dict[str, Any]]] = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0:
            continue
        out.append((float(score), records[int(idx)]))
    return out


def add_captions(captions: list[dict[str, Any]]) -> None:
    rows = _load_records("captions")
    rows.extend(captions)
    _save_records("captions", rows)


def get_captions(file_id: str) -> list[dict[str, Any]]:
    rows = [row for row in _load_records("captions") if row.get("file_id") == file_id]
    return sorted(rows, key=lambda row: int(row.get("chunk_index", 0)))


def search_captions(
    embedding: list[float],
    *,
    top_k: int,
    file_id: str | None = None,
) -> list[dict[str, Any]]:
    rows = _load_records("captions")
    if file_id:
        rows = [row for row in rows if row.get("file_id") == file_id]
    hits = _search(rows, "embedding", embedding, top_k=top_k)
    return [{**row, "score": score} for score, row in hits]


def upsert_summary(summary: dict[str, Any]) -> None:
    rows = _load_records("summaries")
    rows = [row for row in rows if row.get("file_id") != summary.get("file_id")]
    rows.append(summary)
    _save_records("summaries", rows)


def get_summary(file_id: str) -> dict[str, Any] | None:
    for row in _load_records("summaries"):
        if row.get("file_id") == file_id:
            return row
    return None


def list_summaries_by_niche(niche: str) -> list[dict[str, Any]]:
    return [row for row in _load_records("summaries") if row.get("niche") == niche]


def list_niches() -> list[str]:
    niches = {str(row.get("niche", "")).strip() for row in _load_records("summaries")}
    niches.discard("")
    return sorted(niches)


def search_summaries(embedding: list[float], *, top_k: int) -> list[dict[str, Any]]:
    hits = _search(_load_records("summaries"), "summary_embedding", embedding, top_k=top_k)
    return [{**row, "score": score} for score, row in hits]
