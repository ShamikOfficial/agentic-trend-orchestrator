"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { summarizeTeamContent } from "@/lib/team-api";

export default function ChatScriptBriefPage() {
  const [chatText, setChatText] = useState("");
  const [brief, setBrief] = useState("");
  const [flash, setFlash] = useState("Ready.");

  async function handleExtract(event: FormEvent) {
    event.preventDefault();
    if (!chatText.trim()) {
      setFlash("Paste chat text first.");
      return;
    }
    try {
      const response = await summarizeTeamContent({
        source_type: "chat",
        title: "Brief from chat",
        content: chatText,
      });
      setBrief(response.summary || "No summary returned.");
      setFlash("Script brief extracted from chat.");
    } catch (error) {
      setFlash(`Extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <main className="min-h-full bg-[#f8fafc] px-6 py-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-[#e2e8f0] bg-white p-6">
        <h1 className="text-2xl font-bold text-[#0f172a]">Chat Script Brief</h1>
        <form onSubmit={handleExtract} className="mt-4 space-y-3">
          <textarea
            value={chatText}
            onChange={(event) => setChatText(event.target.value)}
            placeholder="Paste group chat conversation..."
            className="min-h-40 w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-semibold text-white">
              Extract Brief
            </button>
            <Link href="/app/brief" className="rounded-lg border border-[#9810fa] bg-[#faf5ff] px-4 py-2 text-sm font-semibold text-[#9810fa]">
              Open Script Brief
            </Link>
            <Link href="/app/editor" className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#364153]">
              Open Editor
            </Link>
          </div>
        </form>
        <pre className="mt-5 whitespace-pre-wrap rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-xs text-[#334155]">
          {brief || "No brief extracted yet."}
        </pre>
        <p className="mt-3 text-xs text-[#64748b]">{flash}</p>
      </div>
    </main>
  );
}
