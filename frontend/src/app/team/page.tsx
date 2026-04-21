"use client";

import { FormEvent, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { extractTasks, listTeamTasks, runDeadlineReminders, summarizeTeamContent, updateTeamTask } from "@/lib/team-api";
import type { TeamTaskStatus } from "@/types/api";

export default function TeamPage() {
  const [content, setContent] = useState("");
  const [summaryResult, setSummaryResult] = useState<string>("");
  const [extractResult, setExtractResult] = useState<string>("");
  const [tasksResult, setTasksResult] = useState<string>("");
  const [remindersResult, setRemindersResult] = useState<string>("");
  const [updateTaskId, setUpdateTaskId] = useState("");
  const [updateStatus, setUpdateStatus] = useState<TeamTaskStatus>("in_progress");
  const [isBusy, setIsBusy] = useState(false);

  const disabled = useMemo(() => isBusy || !content.trim(), [isBusy, content]);

  async function handleSummarize(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    try {
      const response = await summarizeTeamContent({
        source_type: "meeting",
        content,
        title: "Frontend Team Form",
      });
      setSummaryResult(JSON.stringify(response, null, 2));
    } catch (error) {
      setSummaryResult(`Error: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleExtractTasks() {
    setIsBusy(true);
    try {
      const response = await extractTasks({
        content,
        owner_candidates: ["Shamik", "Batu", "Shufen"],
        default_due_days: 3,
      });
      setExtractResult(JSON.stringify(response, null, 2));
    } catch (error) {
      setExtractResult(`Error: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleListTasks() {
    setIsBusy(true);
    try {
      const response = await listTeamTasks();
      setTasksResult(JSON.stringify(response, null, 2));
    } catch (error) {
      setTasksResult(`Error: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRunReminders() {
    setIsBusy(true);
    try {
      const response = await runDeadlineReminders({ window_hours: 24 });
      setRemindersResult(JSON.stringify(response, null, 2));
    } catch (error) {
      setRemindersResult(`Error: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUpdateTask() {
    if (!updateTaskId.trim()) {
      setTasksResult("Provide a task id to update.");
      return;
    }
    setIsBusy(true);
    try {
      const response = await updateTeamTask(updateTaskId.trim(), { status: updateStatus });
      setTasksResult(JSON.stringify(response, null, 2));
    } catch (error) {
      setTasksResult(`Error: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-12 md:px-10">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Team Assistant</h1>
        <p className="text-muted-foreground">
          Frontend module wired to current Team API endpoints.
        </p>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 font-semibold">Input Content</h2>
        <form className="space-y-3" onSubmit={handleSummarize}>
          <textarea
            className="min-h-40 w-full rounded-md border bg-background p-3 text-sm"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Paste chat logs or meeting notes..."
          />
          <div className="flex flex-wrap gap-2">
            <button className={buttonVariants()} type="submit" disabled={disabled}>
              Summarize
            </button>
            <button
              className={buttonVariants({ variant: "outline" })}
              type="button"
              onClick={handleExtractTasks}
              disabled={disabled}
            >
              Extract Tasks
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold">Summary Response</h3>
          <pre className="mt-3 overflow-auto rounded bg-muted p-3 text-xs">
            {summaryResult || "No response yet."}
          </pre>
        </article>
        <article className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold">Extract Tasks Response</h3>
          <pre className="mt-3 overflow-auto rounded bg-muted p-3 text-xs">
            {extractResult || "No response yet."}
          </pre>
        </article>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 font-semibold">Task and Reminder Operations</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className={buttonVariants({ variant: "outline" })}
            type="button"
            onClick={handleListTasks}
            disabled={isBusy}
          >
            List Tasks
          </button>
          <button
            className={buttonVariants({ variant: "outline" })}
            type="button"
            onClick={handleRunReminders}
            disabled={isBusy}
          >
            Run Reminders
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={updateTaskId}
            onChange={(event) => setUpdateTaskId(event.target.value)}
            placeholder="task_id"
          />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={updateStatus}
            onChange={(event) => setUpdateStatus(event.target.value as TeamTaskStatus)}
          >
            <option value="todo">todo</option>
            <option value="in_progress">in_progress</option>
            <option value="blocked">blocked</option>
            <option value="done">done</option>
          </select>
          <button
            className={buttonVariants()}
            type="button"
            onClick={handleUpdateTask}
            disabled={isBusy}
          >
            Update Task Status
          </button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <pre className="overflow-auto rounded bg-muted p-3 text-xs">
            {tasksResult || "Task responses appear here."}
          </pre>
          <pre className="overflow-auto rounded bg-muted p-3 text-xs">
            {remindersResult || "Reminder responses appear here."}
          </pre>
        </div>
      </section>
    </main>
  );
}
