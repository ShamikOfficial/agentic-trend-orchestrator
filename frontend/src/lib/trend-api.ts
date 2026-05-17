import { ChatApiError } from "@/lib/chat-api";
import { resolveApiAuthHeaders } from "@/lib/auth-session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export type TrendUploadResponse = {
  file_id: string;
  file_path: string;
  platform: string;
  niche?: string | null;
  topic?: string | null;
  summary?: string | null;
  ingest_status: string;
};

export type TrendClusterItem = {
  file_id: string;
  topic: string;
  summary: string;
};

export type TrendCluster = {
  cluster_index: number;
  video_count: number;
  trend: string;
  why: string;
  items: TrendClusterItem[];
};

export type TrendClustersResponse = {
  niche: string;
  clusters: TrendCluster[];
  debug: {
    total_videos: number;
    cluster_count: number;
    duration_ms: number;
    logs: string[];
  };
};

export async function uploadTrendVideo(file: File, options?: { platform?: string; ingestNow?: boolean; prompt?: string }) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("ingest_now", String(options?.ingestNow ?? true));
  formData.append("platform", options?.platform ?? "upload");
  if (options?.prompt?.trim()) {
    formData.append("prompt", options.prompt.trim());
  }

  const response = await fetch(`${API_BASE_URL}/trend/upload`, {
    method: "POST",
    body: formData,
    headers: await resolveApiAuthHeaders(),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new ChatApiError(payload?.detail || `Upload failed: ${response.status}`, response.status);
  }
  return payload as TrendUploadResponse;
}

export async function getTrendClusters(niche: string) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  const response = await fetch(`${API_BASE_URL}/trend/clusters?niche=${encodeURIComponent(niche.trim())}`, {
    headers: await resolveApiAuthHeaders(),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new ChatApiError(payload?.detail || `Trend detection failed: ${response.status}`, response.status);
  }
  return payload as TrendClustersResponse;
}
