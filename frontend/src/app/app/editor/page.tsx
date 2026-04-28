"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { summarizeTeamContent } from "@/lib/team-api";

export default function ScriptEditorPage() {
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [flashMessage, setFlashMessage] = useState("Ready.");

  async function getAiSuggestion(event: FormEvent) {
    event.preventDefault();
    if (!script.trim()) {
      setFlashMessage("Add draft script text first.");
      return;
    }
    setIsBusy(true);
    try {
      const response = await summarizeTeamContent({
        source_type: "chat",
        title: title || "Untitled Script Draft",
        content: `Improve this draft while keeping meaning:\n\n${script}`,
      });
      setSuggestion(response.summary || "No suggestion returned.");
      setFlashMessage("AI suggestion generated.");
    } catch (error) {
      setFlashMessage(`Suggestion failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  function saveLocalDraft() {
    window.localStorage.setItem(
      "ato_script_draft",
      JSON.stringify({ title, script, updatedAt: new Date().toISOString() }),
    );
    setFlashMessage("Draft saved locally in browser storage.");
  }

  return (
    <main className="min-h-full bg-[#f8fafc] px-6 py-8">
      <div className="mx-auto max-w-5xl rounded-2xl border border-[#e2e8f0] bg-white p-6">
        <h1 className="text-2xl font-bold text-[#0f172a]">Script Editor</h1>
        <p className="mt-1 text-sm text-[#64748b]">Edit script draft and request a basic AI rewrite suggestion.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/app/chat-review" className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-[#364153]">
            Script Review
          </Link>
          <Link href="/app/chat-tasks" className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-[#364153]">
            Extract Tasks
          </Link>
          <Link href="/app/progress" className="rounded-lg border border-[#9810fa] bg-[#faf5ff] px-3 py-1.5 text-xs font-semibold text-[#9810fa]">
            Update Progress
          </Link>
        </div>

        <form onSubmit={getAiSuggestion} className="mt-5 space-y-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Script title"
            className="h-10 w-full rounded-lg border border-[#cbd5e1] px-3 text-sm"
          />
          <textarea
            value={script}
            onChange={(event) => setScript(event.target.value)}
            placeholder="Write your script draft here..."
            className="min-h-56 w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isBusy}
              className="rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isBusy ? "Generating..." : "Get AI Suggestion"}
            </button>
            <button
              type="button"
              onClick={saveLocalDraft}
              className="rounded-lg border border-[#cbd5e1] px-4 py-2 text-sm font-semibold text-[#0f172a]"
            >
              Save Draft
            </button>
            <Link href="/app/variations" className="rounded-lg border border-[#9810fa] bg-[#faf5ff] px-4 py-2 text-sm font-semibold text-[#9810fa]">
              Variations
            </Link>
            <Link href="/app/storyboard" className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-semibold text-white">
              Storyboard
            </Link>
          </div>
        </form>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-[#0f172a]">Suggestion</h2>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-xs text-[#334155]">
            {suggestion || "No suggestions yet."}
          </pre>
        </section>

        <p className="mt-4 rounded-lg border border-[#fde68a] bg-[#fefce8] px-3 py-2 text-xs text-[#854d0e]">
          Feature in development: real-time collaborative editing and tracked changes.
        </p>
        <p className="mt-3 text-xs text-[#64748b]">{flashMessage}</p>
      </div>
    </main>
  );
}
