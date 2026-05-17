from __future__ import annotations

import os
import re
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from backend.app.services import trend_analytics_service

router = APIRouter()

_allowed_extensions = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
_trend_root = Path(os.environ.get("TREND_VIDEO_ROOT", "backend/trend_analytics/videos"))
_trend_uploads = _trend_root
_trend_uploads.mkdir(parents=True, exist_ok=True)


def _trend_enabled() -> bool:
    return os.getenv("TREND_ANALYTICS_ENABLED", "false").strip().lower() in ("1", "true", "yes")


def _require_trend_enabled() -> None:
    if not _trend_enabled():
        raise HTTPException(status_code=503, detail="Trend analytics is disabled in this environment.")


def _safe_upload_stem(filename: str) -> str:
    stem = Path(filename).stem
    # Keep only safe ASCII filename characters for ffmpeg/ffprobe on Windows.
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", stem).strip("._-")
    return safe or "video"


class UploadTrendVideoResponse(BaseModel):
    file_id: str
    file_path: str
    platform: str = "upload"
    niche: str | None = None
    topic: str | None = None
    summary: str | None = None
    ingest_status: str


class TrendClusterItem(BaseModel):
    file_id: str
    topic: str
    summary: str


class TrendCluster(BaseModel):
    cluster_index: int
    video_count: int
    trend: str
    why: str
    items: list[TrendClusterItem]


class TrendClustersResponse(BaseModel):
    niche: str
    clusters: list[TrendCluster]
    debug: dict


@router.post("/trend/upload", response_model=UploadTrendVideoResponse)
async def upload_and_ingest_video(
    file: UploadFile = File(...),
    ingest_now: bool = Form(default=True),
    platform: str = Form(default="upload"),
    prompt: str | None = Form(default=None),
) -> UploadTrendVideoResponse:
    _require_trend_enabled()
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in _allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported extension: {suffix or 'none'}. Allowed: {sorted(_allowed_extensions)}",
        )

    destination = _trend_uploads / f"uploaded_{_safe_upload_stem(file.filename or 'video')}{suffix}"
    content = await file.read()
    destination.write_bytes(content)

    if not ingest_now:
        return UploadTrendVideoResponse(
            file_id="pending",
            file_path=str(destination.resolve()),
            platform=platform,
            ingest_status="uploaded_only",
        )

    try:
        result = trend_analytics_service.ingest_uploaded_video(
            destination,
            platform=platform,
            prompt=prompt,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Trend ingest failed. Ensure OPENAI_API_KEY, ffmpeg, and FAISS dependencies are available. "
                f"Root error: {exc}"
            ),
        ) from exc

    return UploadTrendVideoResponse(
        file_id=str(result.get("file_id", "unknown")),
        file_path=str(result.get("file_path", str(destination.resolve()))),
        platform=str(result.get("platform", platform)),
        niche=result.get("niche"),
        topic=result.get("topic"),
        summary=result.get("summary"),
        ingest_status="ingested",
    )


@router.get("/trend/clusters", response_model=TrendClustersResponse)
async def get_trend_clusters(niche: str) -> TrendClustersResponse:
    _require_trend_enabled()
    cleaned_niche = niche.strip()
    if not cleaned_niche:
        raise HTTPException(status_code=400, detail="niche is required")
    try:
        payload = trend_analytics_service.detect_clusters_for_niche(cleaned_niche)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Trend cluster detection failed. Ensure OPENAI_API_KEY and trend analytics dependencies are available. "
                f"Root error: {exc}"
            ),
        ) from exc
    return TrendClustersResponse(**payload)
