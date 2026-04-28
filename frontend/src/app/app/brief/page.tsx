"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { summarizeTeamContent } from "@/lib/team-api";

export default function ScriptBriefPage() {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [brief, setBrief] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [flashMessage, setFlashMessage] = useState("Ready.");

  async function generateBrief(event: FormEvent) {
    event.preventDefault();
    if (!topic.trim()) {
      setFlashMessage("Topic is required.");
      return;
    }
    setIsBusy(true);
    try {
      const payload = [
        `Topic: ${topic}`,
        `Audience: ${audience || "General audience"}`,
        `Goal: ${goal || "Create engaging short-form video script"}`,
      ].join("\n");
      const response = await summarizeTeamContent({
        source_type: "meeting",
        title: `Script Brief - ${topic}`,
        content: payload,
      });
      setBrief(response.summary || "No summary returned.");
      setFlashMessage("Brief generated from backend summarizer.");
    } catch (error) {
      setFlashMessage(`Brief generation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="min-h-full bg-[#f8fafc] px-6 py-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-[#e2e8f0] bg-white p-6">
        <h1 className="text-2xl font-bold text-[#0f172a]">Script Brief</h1>
        <p className="mt-1 text-sm text-[#64748b]">Basic brief builder with backend summary wiring.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/app/chat" className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-[#364153]">
            Open Chat
          </Link>
          <Link href="/app/editor" className="rounded-lg border border-[#9810fa] bg-[#faf5ff] px-3 py-1.5 text-xs font-semibold text-[#9810fa]">
            Go to Editor
          </Link>
        </div>

        <form onSubmit={generateBrief} className="mt-5 grid gap-3">
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Topic"
            className="h-10 rounded-lg border border-[#cbd5e1] px-3 text-sm"
          />
          <input
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
            placeholder="Target audience"
            className="h-10 rounded-lg border border-[#cbd5e1] px-3 text-sm"
          />
          <textarea
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="Campaign/video objective"
            className="min-h-24 rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isBusy}
            className="w-fit rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isBusy ? "Generating..." : "Generate Brief"}
          </button>
        </form>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-[#0f172a]">Brief Output</h2>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-xs text-[#334155]">
            {brief || "No brief yet."}
          </pre>
        </section>

        <p className="mt-4 rounded-lg border border-[#fde68a] bg-[#fefce8] px-3 py-2 text-xs text-[#854d0e]">
          Feature in development: auto-save brief versions and collaborative comments.
        </p>
        <p className="mt-3 text-xs text-[#64748b]">{flashMessage}</p>
      </div>
    </main>
  );
}
