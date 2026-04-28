"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createWorkflowItem } from "@/lib/workflow-api";

export default function SaveProjectPage() {
  const [projectName, setProjectName] = useState("");
  const [scriptTitle, setScriptTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [flashMessage, setFlashMessage] = useState("Ready.");

  async function saveProject(event: FormEvent) {
    event.preventDefault();
    if (!projectName.trim() || !scriptTitle.trim()) {
      setFlashMessage("Project name and script title are required.");
      return;
    }
    setIsBusy(true);
    try {
      await createWorkflowItem({
        title: `Saved Script: ${scriptTitle.trim()}`,
        description: notes.trim() || "Saved from Script Save screen",
        project: projectName.trim(),
        stage: "Brief",
      });
      setFlashMessage("Project save record created in workflow backend.");
    } catch (error) {
      setFlashMessage(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="min-h-full bg-[#f8fafc] px-6 py-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#e2e8f0] bg-white p-6">
        <h1 className="text-2xl font-bold text-[#0f172a]">Save Project</h1>
        <p className="mt-1 text-sm text-[#64748b]">Create a basic saved-project entry in workflow.</p>
        <div className="mt-3 flex gap-2">
          <Link href="/app/storyboard" className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-[#364153]">
            Back to Storyboard
          </Link>
          <Link href="/app" className="rounded-lg border border-[#9810fa] bg-[#faf5ff] px-3 py-1.5 text-xs font-semibold text-[#9810fa]">
            Back to Script Home
          </Link>
        </div>

        <form onSubmit={saveProject} className="mt-5 space-y-3">
          <input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Project name"
            className="h-10 w-full rounded-lg border border-[#cbd5e1] px-3 text-sm"
          />
          <input
            value={scriptTitle}
            onChange={(event) => setScriptTitle(event.target.value)}
            placeholder="Script title"
            className="h-10 w-full rounded-lg border border-[#cbd5e1] px-3 text-sm"
          />
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes (optional)"
            className="min-h-24 w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isBusy}
            className="rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isBusy ? "Saving..." : "Save Project"}
          </button>
        </form>

        <p className="mt-4 rounded-lg border border-[#fde68a] bg-[#fefce8] px-3 py-2 text-xs text-[#854d0e]">
          Feature in development: version history, cloud export, and media package save.
        </p>
        <p className="mt-3 text-xs text-[#64748b]">{flashMessage}</p>
      </div>
    </main>
  );
}
