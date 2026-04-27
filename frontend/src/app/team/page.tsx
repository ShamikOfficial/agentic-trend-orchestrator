"use client";

import { DragEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { clearAuthToken } from "@/lib/auth-store";
import { loginPathWithReason } from "@/lib/auth-redirect";
import { createWorkflowItem } from "@/lib/workflow-api";
import {
  listTeamNotesLogs,
  listTeamTasks,
  processTeamInput,
  runDeadlineReminders,
  updateTeamTask,
} from "@/lib/team-api";
import type { TeamNoteLog, TeamTask, TeamTaskStatus } from "@/types/api";

export default function TeamPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"tasks" | "logs">("tasks");
  const [content, setContent] = useState("");
  const [summaryText, setSummaryText] = useState("");
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [noteLogs, setNoteLogs] = useState<TeamNoteLog[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [remindersText, setRemindersText] = useState("");
  const [sourceType, setSourceType] = useState<"chat" | "meeting">("meeting");
  const [flashMessage, setFlashMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  function handleApiError(error: unknown, fallbackPrefix: string) {
    if (error instanceof ApiError && error.status === 401) {
      clearAuthToken();
      window.dispatchEvent(new Event("auth-changed"));
      setFlashMessage("Session expired. Please sign in again on the home page.");
      router.replace(loginPathWithReason("session_expired"));
      return;
    }
    setFlashMessage(`${fallbackPrefix}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const disabled = useMemo(() => isBusy || !content.trim(), [isBusy, content]);

  function handleDrop(event: DragEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    const text = event.dataTransfer.getData("text/plain");
    if (text) setContent((prev) => `${prev}\n${text}`.trim());
  }

  async function refreshTasks() {
    setIsBusy(true);
    try {
      const response = await listTeamTasks();
      setTasks(response.items);
      setFlashMessage("Task board refreshed.");
    } catch (error) {
      handleApiError(error, "Failed to load tasks");
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshLogs() {
    setIsBusy(true);
    try {
      const response = await listTeamNotesLogs();
      setNoteLogs(response.items);
      setFlashMessage("Notes logs refreshed.");
    } catch (error) {
      handleApiError(error, "Failed to load logs");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleGenerate() {
    setIsBusy(true);
    try {
      const response = await processTeamInput({
        source_type: sourceType,
        content,
        title: "Team Assistant Input",
        owner_candidates: [],
        default_due_days: 3,
      });
      setSummaryText(response.summary.summary ?? "");
      setTasks(response.tasks);
      setSelectedTaskIds(response.tasks.map((task) => task.task_id));
      setNoteLogs((prev) => [response.note_log, ...prev]);
      setFlashMessage(`Processed input. Category: ${response.note_log.category}`);
    } catch (error) {
      handleApiError(error, "Generate failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemindAll() {
    setIsBusy(true);
    try {
      const response = await runDeadlineReminders({ window_hours: 24 });
      setRemindersText(
        response.reminders.length
          ? response.reminders.map((item) => `${item.task_id}: ${item.message}`).join("\n")
          : "No reminders triggered.",
      );
      setFlashMessage("Reminders generated for all tasks.");
    } catch (error) {
      handleApiError(error, "Reminders failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemindSelected() {
    if (!selectedTaskIds.length) {
      setFlashMessage("Select at least one task first.");
      return;
    }
    setIsBusy(true);
    try {
      const response = await runDeadlineReminders({ window_hours: 24, task_ids: selectedTaskIds });
      setRemindersText(
        response.reminders.length
          ? response.reminders.map((item) => `${item.task_id}: ${item.message}`).join("\n")
          : "No reminders for selected tasks.",
      );
      setFlashMessage("Reminders generated for selected tasks.");
    } catch (error) {
      handleApiError(error, "Reminders failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleTaskStatus(taskId: string, status: TeamTaskStatus) {
    setIsBusy(true);
    try {
      await updateTeamTask(taskId, { status });
      await refreshTasks();
    } catch (error) {
      handleApiError(error, "Task update failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleMoveToWorkItem() {
    if (!selectedTaskIds.length) {
      setFlashMessage("Select tasks to move first.");
      return;
    }
    setIsBusy(true);
    try {
      const selected = tasks.filter((task) => selectedTaskIds.includes(task.task_id));
      for (const task of selected) {
        await createWorkflowItem({
          title: task.title,
          description: task.description,
          owner: task.owner,
          stage: "Idea",
          due_date: task.due_date,
          comments: task.notes ? [task.notes] : [],
          links: [],
          project: "Team Assistant",
        });
      }
      setFlashMessage("Selected tasks moved to workflow work items.");
    } catch (error) {
      handleApiError(error, "Move failed");
    } finally {
      setIsBusy(false);
    }
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Team Assistant Workspace</h1>
        <p className="text-muted-foreground">
          Drop any raw text, auto-categorize it, and convert it into structured tasks.
        </p>
      </section>

      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">Input Zone</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <select
            className="h-11 rounded-md border bg-background px-3 text-sm"
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value as "chat" | "meeting")}
          >
            <option value="meeting">Meeting</option>
            <option value="chat">Chat</option>
          </select>
        </div>
        <div className="mt-3">
          <textarea
            className="min-h-56 w-full rounded-md border bg-background p-3 text-sm"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            placeholder="Paste or drop meeting notes / chats / tasks here..."
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button className={buttonVariants()} type="button" disabled={disabled} onClick={() => void handleGenerate()}>
            Generate Summary + Tasks
          </button>
          <button className={buttonVariants({ variant: "outline" })} type="button" disabled={isBusy} onClick={() => void refreshTasks()}>
            Refresh Tasks
          </button>
          <button className={buttonVariants({ variant: "outline" })} type="button" disabled={isBusy} onClick={() => void refreshLogs()}>
            Refresh Logs
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{flashMessage || "Ready."}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border bg-card p-5 md:col-span-2">
          <h3 className="font-semibold">Generated Summary</h3>
          <p className="mt-3 min-h-24 rounded bg-muted p-3 text-sm">{summaryText || "No summary yet."}</p>
        </article>
        <article className="rounded-xl border bg-card p-5">
          <h3 className="font-semibold">Reminder Output</h3>
          <pre className="mt-3 min-h-24 overflow-auto rounded bg-muted p-3 text-xs">
            {remindersText || "No reminders yet."}
          </pre>
        </article>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex gap-2">
          <button className={buttonVariants({ variant: activeTab === "tasks" ? "default" : "outline" })} type="button" onClick={() => setActiveTab("tasks")}>
            Extracted Tasks
          </button>
          <button className={buttonVariants({ variant: activeTab === "logs" ? "default" : "outline" })} type="button" onClick={() => setActiveTab("logs")}>
            Notes Logs
          </button>
        </div>

        {activeTab === "tasks" ? (
          <>
            <h2 className="mb-3 text-xl font-semibold">Task Board</h2>
            <div className="flex flex-wrap gap-2">
              <button className={buttonVariants({ variant: "outline" })} type="button" onClick={() => void handleRemindAll()} disabled={isBusy}>
                Remind All
              </button>
              <button className={buttonVariants({ variant: "outline" })} type="button" onClick={() => void handleRemindSelected()} disabled={isBusy}>
                Remind Selected
              </button>
              <button className={buttonVariants()} type="button" onClick={() => void handleMoveToWorkItem()} disabled={isBusy}>
                Move Selected to Work Items
              </button>
            </div>
            <div className="mt-4 overflow-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2">Select</th>
                    <th className="px-3 py-2">Task</th>
                    <th className="px-3 py-2">Owner</th>
                    <th className="px-3 py-2">Due</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.task_id} className="border-t">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selectedTaskIds.includes(task.task_id)} onChange={() => toggleTaskSelection(task.task_id)} />
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">{task.task_id}</p>
                      </td>
                      <td className="px-3 py-2">{task.owner || "-"}</td>
                      <td className="px-3 py-2">{task.due_date || "-"}</td>
                      <td className="px-3 py-2">
                        <select
                          className="h-9 rounded-md border bg-background px-2 text-xs"
                          value={task.status}
                          onChange={(event) => void handleTaskStatus(task.task_id, event.target.value as TeamTaskStatus)}
                        >
                          <option value="todo">todo</option>
                          <option value="in_progress">in_progress</option>
                          <option value="blocked">blocked</option>
                          <option value="done">done</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {tasks.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={5}>
                        No tasks yet. Generate from notes above.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-3 text-xl font-semibold">Raw Text Logs</h2>
            <div className="max-h-[60vh] overflow-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-muted/60">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Category Result</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Raw Text</th>
                  </tr>
                </thead>
                <tbody>
                  {noteLogs.map((log) => (
                    <tr key={log.note_id} className="border-t align-top">
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2">{log.category}</td>
                      <td className="px-3 py-2">{log.category_result}</td>
                      <td className="px-3 py-2">{log.source_type}</td>
                      <td className="max-w-xl px-3 py-2 text-xs text-muted-foreground">{log.raw_text}</td>
                    </tr>
                  ))}
                  {noteLogs.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={5}>
                        No logs yet. Generate from input zone.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
