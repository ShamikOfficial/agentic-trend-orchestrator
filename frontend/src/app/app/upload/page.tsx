"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useState } from "react";
import { uploadTrendVideo } from "@/lib/trend-api";

export default function VideoUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<{
    file_id: string;
    niche?: string | null;
    topic?: string | null;
    summary?: string | null;
    ingest_status: string;
  } | null>(null);
  const [flash, setFlash] = useState("Ready.");

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setFlash(file ? `Selected ${file.name}` : "Ready.");
  }

  async function handlePick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setFlash("Select a video file first.");
      return;
    }
    setIsBusy(true);
    try {
      const response = await uploadTrendVideo(selectedFile, {
        ingestNow: true,
        platform: "upload",
        prompt: prompt || undefined,
      });
      setResult(response);
      setFlash("Upload complete and trend analytics ingest finished.");
    } catch (error) {
      setFlash(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="min-h-full bg-[#f8fafc] px-6 py-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-[#e2e8f0] bg-white p-6">
        <h1 className="text-2xl font-bold text-[#0f172a]">Video Upload</h1>
        <p className="mt-1 text-sm text-[#64748b]">Upload video and ingest directly into trend analytics pipeline.</p>
        <form onSubmit={handlePick} className="mt-5 space-y-3">
          <input
            type="file"
            accept="video/mp4,video/mov,video/x-msvideo,video/x-matroska,video/webm"
            onChange={handleFileSelect}
            className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm"
          />
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Optional vision prompt override"
            className="h-10 w-full rounded-lg border border-[#cbd5e1] px-3 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isBusy || !selectedFile}
              className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isBusy ? "Uploading + Processing..." : "Upload & Process"}
            </button>
            <Link href="/app/report" className="rounded-lg border border-[#9810fa] bg-[#faf5ff] px-4 py-2 text-sm font-semibold text-[#9810fa]">
              Open Report
            </Link>
            <Link href="/app/editor" className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#364153]">
              Open Script
            </Link>
          </div>
        </form>
        {result ? (
          <section className="mt-5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <p className="text-sm font-semibold text-[#0f172a]">Ingest Result</p>
            <p className="mt-1 text-xs text-[#334155]">file_id: {result.file_id}</p>
            <p className="text-xs text-[#334155]">status: {result.ingest_status}</p>
            <p className="text-xs text-[#334155]">niche: {result.niche || "unknown"}</p>
            <p className="text-xs text-[#334155]">topic: {result.topic || "unknown"}</p>
            <p className="mt-2 text-xs text-[#64748b]">{result.summary || "Summary not returned."}</p>
          </section>
        ) : null}
        <p className="mt-4 text-xs text-[#64748b]">{flash}</p>
      </div>
    </main>
  );
}
