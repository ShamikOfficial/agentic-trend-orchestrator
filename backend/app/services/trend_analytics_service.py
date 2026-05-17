from __future__ import annotations

import sys
from time import perf_counter
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


def detect_clusters_for_niche(niche: str) -> dict:
    from src.trend.trend import cluster_summaries, detect_trends, fetch_summaries

    started_at = perf_counter()
    logs: list[str] = [f"[start] trend detection requested for niche='{niche}'"]
    summaries = fetch_summaries(niche)
    logs.append(f"[fetch] loaded {len(summaries)} summary row(s) from store")
    if not summaries:
        logs.append("[done] no videos found for this niche")
        return {
            "niche": niche,
            "clusters": [],
            "debug": {
                "total_videos": 0,
                "cluster_count": 0,
                "duration_ms": round((perf_counter() - started_at) * 1000, 2),
                "logs": logs,
            },
        }

    clusters = cluster_summaries(summaries)
    logs.append(f"[cluster] formed {len(clusters)} cluster(s)")
    trends = detect_trends(niche, clusters)
    logs.append("[label] generated trend labels and why-explanations")
    payload_clusters: list[dict] = []
    for idx, (trend, cluster) in enumerate(zip(trends, clusters), 1):
        logs.append(f"[cluster#{idx}] {len(cluster)} video(s), trend='{trend.get('trend', 'unknown')}'")
        payload_clusters.append(
            {
                "cluster_index": idx,
                "video_count": len(cluster),
                "trend": str(trend.get("trend", "unknown")),
                "why": str(trend.get("why", "")),
                "items": [
                    {
                        "file_id": str(item.get("file_id", "")),
                        "topic": str(item.get("topic", "")),
                        "summary": str(item.get("summary", "")),
                    }
                    for item in cluster
                ],
            }
        )
    logs.append("[done] trend detection response built")
    return {
        "niche": niche,
        "clusters": payload_clusters,
        "debug": {
            "total_videos": len(summaries),
            "cluster_count": len(payload_clusters),
            "duration_ms": round((perf_counter() - started_at) * 1000, 2),
            "logs": logs,
        },
    }
