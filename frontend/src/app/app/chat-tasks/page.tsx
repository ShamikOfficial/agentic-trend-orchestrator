"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { extractTasks } from "@/lib/team-api";

export default function ExtractTasksPage() {
  const [chatText, setChatText] = useState("");
  const [tasks, setTasks] = useState<Array<{ task_id: string; title: string }>>([]);
  const [flash, setFlash] = useState("Ready.");

  async function handleExtract(event: FormEvent) {
    event.preventDefault();
    if (!chatText.trim()) {
      setFlash("Paste chat text first.");
      return;
    }
    try {
      const response = await extractTasks({ content: chatText });
      const mapped = (response.tasks || []).map((task) => ({ task_id: task.task_id, title: task.title }));
      setTasks(mapped);
      setFlash(`Extracted ${mapped.length} task(s).`);
    } catch (error) {
      setFlash(`Task extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <main className="min-h-full bg-[#f8fafc] px-6 py-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-[#e2e8f0] bg-white p-6">
        <h1 className="text-2xl font-bold text-[#0f172a]">Extract Tasks</h1>
        <form onSubmit={handleExtract} className="mt-4 space-y-3">
          <textarea
            value={chatText}
            onChange={(event) => setChatText(event.target.value)}
            placeholder="Paste chat conversation..."
            className="min-h-40 w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-semibold text-white">
              Extract
            </button>
            <Link href="/app/tasks" className="rounded-lg border border-[#9810fa] bg-[#faf5ff] px-4 py-2 text-sm font-semibold text-[#9810fa]">
              Open My Tasks
            </Link>
            <Link href="/app/chat" className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#364153]">
              Back to Chat
            </Link>
          </div>
        </form>
        <div className="mt-5 space-y-2">
          {tasks.length ? (
            tasks.map((task) => (
              <div key={task.task_id} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                <p className="text-sm font-semibold text-[#0f172a]">{task.title}</p>
                <p className="text-xs text-[#64748b]">{task.task_id}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-[#64748b]">No extracted tasks yet.</p>
          )}
        </div>
        <p className="mt-3 text-xs text-[#64748b]">{flash}</p>
      </div>
    </main>
  );
}
